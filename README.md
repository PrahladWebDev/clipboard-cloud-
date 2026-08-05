# 📋☁️ Clipboard Cloud

Instant, cross-device clipboard sync. Pair two devices with a QR code or a
6-digit code and anything copied on one appears on the other in real time —
no login required, with an optional account for permanent saved snippets.

## Tech stack

| Layer        | Choice                                   |
|--------------|-------------------------------------------|
| Frontend     | Next.js 14 (App Router) + TypeScript       |
| Backend      | NestJS 10 + TypeScript                     |
| Real-time    | Socket.IO                                  |
| Cache        | Redis (pairing sessions + clipboard history, TTL-based) |
| Storage      | Local disk storage (multer) for uploaded files/images |
| Database     | MongoDB, via Mongoose — accounts + permanently saved snippets |
| Auth         | JWT (passport-jwt), bcrypt password hashing |

## Features

- 📋 Sync copied text in real time · 🔗 URLs · 🖼️ images · 📁 arbitrary files
- 📂 Drag & drop upload, plus paste-an-image-from-OS-clipboard directly (Ctrl/Cmd+V)
- 📱🖥️ Any device ↔ any device (mobile, desktop, tablet — anything with a browser)
- ⏳ Auto-delete clipboard history after a configurable time (Redis TTL)
- 📜 Clipboard history (last 20 items, capped server-side) · ⭐ pin · 🔍 search
- 🔒 **End-to-end encryption (optional, per session)** — AES-256-GCM, key
  generated in the browser and never sent to the server (see below)
- 🕸️ **Offline queue** — clipboard pushes made while disconnected are queued
  in `localStorage` and sent automatically on reconnect
- 👥 **Device list** — see every paired device by name, remove ("kick") one
- 👤 **Optional accounts** (JWT + MongoDB) — save clipboard items permanently
  to "My saved snippets", independent of any session's expiry
- 🛡️ **Hardening**: rate limiting (`@nestjs/throttler`, tighter on
  code-pairing and auth routes), Helmet security headers, per-session file
  ownership checks on downloads, blocked executable file extensions, payload
  size caps
- ✅ Unit + e2e tests (Jest, `supertest`) on the backend; component tests
  (Jest + React Testing Library) on the frontend

## How end-to-end encryption works

When you toggle **"End-to-end encrypt this session"** before creating a
session:

1. The browser generates a random AES-256-GCM key with the Web Crypto API.
   **This key is never sent to the backend.**
2. The QR code is generated **client-side** and encodes the key as a URL
   fragment (`#k=...`). Fragments are never included in HTTP requests, so
   scanning the QR hands the joining device the key without the server ever
   seeing it.
3. If you're pairing with the manual 6-digit code instead (no link/fragment
   to carry the key), the joining device is prompted to paste the key, which
   you copy from a button on the creating device.
4. Text/URL clipboard content is encrypted client-side before being emitted
   over the socket; the server only stores/relays ciphertext + a per-item
   IV. Files/images are encrypted as raw bytes before upload the same way.
5. Devices without the key see "🔒 Could not decrypt" instead of content.

This gives real confidentiality against the server operator for the session
duration. It intentionally does **not** try to protect against a malicious
client with the key, or against someone who intercepts both the QR code and
the code (the manual-code flow's key exchange is out-of-band and only as
secure as how you share it).

## Project layout

```
clipboard-cloud/
├── backend/
│   └── src/
│       ├── redis/       # Redis wrapper (in-memory dev fallback), tests
│       ├── pairing/      # Session creation, 6-digit code, QR, tests
│       ├── clipboard/    # History storage, pin/delete/search, gateway, tests
│       ├── files/        # Disk-storage upload/download, ownership checks
│       ├── auth/         # Register/login, JWT strategy/guard, User schema
│       └── account/      # Saved snippets (Mongo), guarded by JWT
│   └── test/              # e2e tests (supertest against the real HTTP app)
├── frontend/
│   └── src/
│       ├── app/            # Landing, /clipboard/[sessionId], /login,
│       │                   #  /register, /snippets
│       ├── components/     # QRPairing, PasteBox, FileDrop, ClipboardHistory,
│       │                   #  DeviceList
│       ├── context/        # AuthContext
│       ├── lib/            # REST client, socket client, crypto (E2EE),
│       │                   #  offlineQueue, auth client, device detection
│       └── __tests__/      # Component + crypto unit tests
└── docker-compose.yml       # Redis + MongoDB
```

## Running it locally

### 1. Start infra

```bash
docker compose up -d redis mongo
```

(Redis is optional for a quick demo of the core sync flow — if it's
unreachable, the backend transparently falls back to an in-memory store.
**MongoDB is currently required for the backend to start at all** — NestJS
awaits the Mongo connection during bootstrap, since `AuthModule`/`AccountModule`
are wired into the root `AppModule`. If Mongo is unreachable, the backend
retries for ~15 seconds then exits with a clear connection error rather than
hanging forever. If you only want the core pairing/clipboard-sync flow and
don't care about accounts, the quickest fix is to comment out `AuthModule`,
`AccountModule`, and the `MongooseModule.forRoot(...)` line in
`backend/src/app.module.ts`.)

### 2. Backend

```bash
cd backend
cp .env.example .env   # set a real JWT_SECRET before deploying anywhere real
npm install
npm run start:dev
```

Runs on `http://localhost:4000`, REST under `/api`, Socket.IO on the same port.

### 3. Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Runs on `http://localhost:3000`.

### 4. Try it

Open `http://localhost:3000` in two browser windows. Generate a code on one,
join with it on the other, and copy/paste between them. Toggle "End-to-end
encrypt this session" to try E2EE; open "Connected devices" to see/remove
paired devices; disconnect your network briefly and send an item to see the
offline queue kick in; register an account and hit "Save" on a history item
to see it show up under "My saved snippets" later.

## Testing

```bash
# Backend — unit tests (no infra needed)
cd backend && npm test

# Backend — e2e tests (needs Redis + Mongo running)
docker compose up -d redis mongo
cd backend && npm run test:e2e

# Frontend — component/unit tests
cd frontend && npm test
```

## Production hardening notes

- **Rate limiting**: global default via `@nestjs/throttler`, with much
  tighter limits on `/pairing/join` (guessing a 6-digit code), `/pairing/create`,
  `/auth/register`, `/auth/login`, and `/files/upload`.
- **File download authorization**: each uploaded file is tied to the
  `sessionId` that uploaded it (Redis, same TTL as the session); downloads
  require that `sessionId` OR a valid account JWT (so snippets saved to an
  account stay retrievable after the original session expires).
- **Blocked extensions**: obviously executable file types (`.exe`, `.sh`,
  `.jar`, etc.) are rejected at upload time. This is not a substitute for
  real malware scanning in a production deployment.
- **Helmet** security headers are applied; CORS is restricted to the
  configured frontend origin.
- **Payload size caps**: clipboard text/links are capped at 500KB at the
  DTO-validation layer (both REST and the WebSocket gateway, validated
  manually there since Nest's global `ValidationPipe` doesn't cover
  `@MessageBody()` automatically).
- Passwords are hashed with `bcrypt` (12 rounds); JWTs expire after 7 days
  by default (`JWT_EXPIRES_IN`).

### Still worth doing before a real production deployment

- HTTPS/TLS termination (put this behind a real reverse proxy / load balancer)
- A real virus/malware scan on uploaded files
- Structured logging + monitoring/alerting
- A periodic disk-cleanup job for uploaded files (currently they persist on
  disk indefinitely — only the Redis *ownership* pointer expires — since
  saved account snippets rely on the file still existing on disk)

## Known limitations

- **Saved encrypted snippets**: to keep the design honest, "Save to my
  account" is disabled for E2E-encrypted items — persisting ciphertext to
  Mongo without also persisting/sharing the key defeats the point, and the
  key is deliberately never sent to or stored by the server.
- **True "universal clipboard"** (silent, always-on OS-level clipboard
  watching) isn't possible from a plain browser for very good security
  reasons. The "Watch clipboard" toggle polls `navigator.clipboard.readText()`
  on an interval while the tab is focused and permission has been granted —
  a reasonable demo approximation, not a native OS integration. A production
  "universal clipboard" product would pair this web app with a small native
  helper (menu-bar app, Android accessibility service, etc.).
