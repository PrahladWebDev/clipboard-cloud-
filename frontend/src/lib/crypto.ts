/**
 * Client-side end-to-end encryption for clipboard content.
 *
 * The AES-GCM key is generated in the browser and NEVER sent to the server.
 * It travels between paired devices in one of two ways:
 *  - Via the QR code / deep link, as a URL fragment (`#k=...`) — fragments
 *    are never transmitted in HTTP requests, so the server never sees it.
 *  - Via manual out-of-band copy/paste, for the 6-digit-code pairing flow
 *    where there's no link/fragment to carry it automatically.
 *
 * The server only ever stores/relays ciphertext + a per-item IV; it cannot
 * decrypt clipboard content for an encrypted session.
 */

const ALGO = 'AES-GCM';

export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: ALGO, length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

export async function exportKeyToBase64(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(raw);
}

export async function importKeyFromBase64(b64: string): Promise<CryptoKey> {
  const raw = base64ToArrayBuffer(b64);
  return crypto.subtle.importKey('raw', raw, ALGO, true, ['encrypt', 'decrypt']);
}

/** Encrypts a UTF-8 string. Returns a single base64 string: iv || ciphertext. */
export async function encryptText(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: ALGO, iv }, key, encoded);
  return packIvAndData(iv, new Uint8Array(ciphertext));
}

export async function decryptText(key: CryptoKey, packed: string): Promise<string> {
  const { iv, data } = unpackIvAndData(packed);
  const plainBuf = await crypto.subtle.decrypt(
    { name: ALGO, iv: iv as BufferSource },
    key,
    data as BufferSource,
  );
  return new TextDecoder().decode(plainBuf);
}

/** Encrypts raw binary (e.g. a file/image) into a Blob ready to upload. */
export async function encryptBlob(key: CryptoKey, blob: Blob): Promise<Blob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buf = await blob.arrayBuffer();
  const ciphertext = await crypto.subtle.encrypt({ name: ALGO, iv }, key, buf);
  // Prepend the 12-byte IV to the ciphertext bytes for self-contained files.
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return new Blob([combined], { type: 'application/octet-stream' });
}

export async function decryptBlob(
  key: CryptoKey,
  encryptedBlob: Blob,
  originalMimeType: string,
): Promise<Blob> {
  const buf = new Uint8Array(await encryptedBlob.arrayBuffer());
  const iv = buf.slice(0, 12);
  const data = buf.slice(12);
  const plainBuf = await crypto.subtle.decrypt(
    { name: ALGO, iv: iv as BufferSource },
    key,
    data as BufferSource,
  );
  return new Blob([plainBuf], { type: originalMimeType || 'application/octet-stream' });
}

function packIvAndData(iv: Uint8Array, data: Uint8Array): string {
  const combined = new Uint8Array(iv.length + data.length);
  combined.set(iv, 0);
  combined.set(data, iv.length);
  return arrayBufferToBase64(combined.buffer);
}

function unpackIvAndData(packed: string): { iv: Uint8Array; data: Uint8Array } {
  const combined = new Uint8Array(base64ToArrayBuffer(packed));
  return { iv: combined.slice(0, 12), data: combined.slice(12) };
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
