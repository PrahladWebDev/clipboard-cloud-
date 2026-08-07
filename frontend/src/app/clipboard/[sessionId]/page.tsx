'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import { fetchHistory, getSession } from '@/lib/api';
import { detectDeviceLabel, getOrCreateDeviceId } from '@/lib/device';
import { importKeyFromBase64, encryptText } from '@/lib/crypto';
import * as offlineQueue from '@/lib/offlineQueue';
import QRPairing from '@/components/QRPairing';
import PasteBox from '@/components/PasteBox';
import FileDrop from '@/components/FileDrop';
import ClipboardHistory, { ClipboardItem } from '@/components/ClipboardHistory';
import DeviceList, { Device } from '@/components/DeviceList';

interface PairingInfo {
  code: string;
  qrDataUrl: string;
  encryptionKeyB64?: string | null;
}

export default function ClipboardSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [pairing, setPairing] = useState<PairingInfo | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [mySocketId, setMySocketId] = useState<string | null>(null);
  const [items, setItems] = useState<ClipboardItem[]>([]);
  const [connected, setConnected] = useState(false);
  const [notice, setNotice] = useState('');
  const [watchClipboard, setWatchClipboard] = useState(false);
  const [description, setDescription] = useState('');
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState('');
  const [kicked, setKicked] = useState(false);
  const lastClipboardRef = useRef('');
  const deviceLabel = useRef(detectDeviceLabel());
  const deviceId = useRef(getOrCreateDeviceId());

  // Load pairing info (only present on the device that created the session),
  // then resolve whether this session is encrypted and — if so — the key.
  useEffect(() => {
    const raw = sessionStorage.getItem(`pairing:${sessionId}`);
    const info: PairingInfo | null = raw ? JSON.parse(raw) : null;
    setPairing(info);

    (async () => {
      // 1) Key from the creating device's own sessionStorage.
      if (info?.encryptionKeyB64) {
        setIsEncrypted(true);
        setEncryptionKey(await importKeyFromBase64(info.encryptionKeyB64));
        return;
      }
      // 2) Key from a QR-link URL fragment (never sent to the server).
      if (typeof window !== 'undefined' && window.location.hash.startsWith('#k=')) {
        const keyB64 = decodeURIComponent(window.location.hash.slice(3));
        setIsEncrypted(true);
        setEncryptionKey(await importKeyFromBase64(keyB64));
        return;
      }
      // 3) Otherwise ask the session record whether encryption is expected —
      // if so, a manual-code joiner needs to paste the key themselves.
      try {
        const session = await getSession(sessionId);
        setIsEncrypted(!!session.encrypted);
      } catch {
        // session may not exist yet on first render; ignore
      }
    })();
  }, [sessionId]);

  async function submitManualKey() {
    setKeyError('');
    try {
      const key = await importKeyFromBase64(keyInput.trim());
      setEncryptionKey(key);
    } catch {
      setKeyError('That doesn\u2019t look like a valid key. Copy it exactly from the other device.');
    }
  }

  function flushOfflineQueue() {
    const queued = offlineQueue.getQueue(sessionId);
    if (queued.length === 0) return;
    const socket = getSocket();
    queued.forEach((q) => {
      socket.emit('clipboard:push', {
        sessionId: q.sessionId,
        type: q.type,
        content: q.content,
        fileName: q.fileName,
        fileUrl: q.fileUrl,
        mimeType: q.mimeType,
        encrypted: q.encrypted,
        deviceLabel: q.deviceLabel,
        description: q.description,
      });
    });
    offlineQueue.clearQueue(sessionId);
    setNotice(`Sent ${queued.length} item(s) queued while offline.`);
    setTimeout(() => setNotice(''), 3000);
  }

  // Socket connection + event wiring.
  useEffect(() => {
    const socket = getSocket();

    function join() {
      socket.emit('room:join', { sessionId, deviceLabel: deviceLabel.current, deviceId: deviceId.current });
    }

    if (socket.connected) {
      setMySocketId(socket.id);
      join();
    }
    socket.on('connect', () => {
      setConnected(true);
      setMySocketId(socket.id);
      join();
      flushOfflineQueue();
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on('history:sync', (history: ClipboardItem[]) => setItems(history));
    socket.on('clipboard:new', (item: ClipboardItem) => {
      setItems((prev) => [item, ...prev.filter((i) => i.id !== item.id)]);
      if (item.deviceLabel !== deviceLabel.current) {
        setNotice(`New item from ${item.deviceLabel || 'another device'}`);
        setTimeout(() => setNotice(''), 3000);
      }
    });
    socket.on('device:joined', (info: { socketId: string; deviceLabel: string }) => {
      setNotice(`${info.deviceLabel || 'A device'} connected (id: ${info.socketId.slice(0, 6)})`);
      setTimeout(() => setNotice(''), 3500);
    });
    socket.on('device:left', (info: { socketId: string }) => {
      setNotice(`A device disconnected (id: ${info.socketId.slice(0, 6)})`);
      setTimeout(() => setNotice(''), 3500);
    });
    // The device list from the server is the single source of truth for how
    // many devices are actually in the room — including right after this
    // device itself reconnects (e.g. on page refresh), when it wouldn't
    // otherwise receive a "device:joined" event for devices already there.
    socket.on('devices:update', (list: Device[]) => setDevices(list));
    socket.on('device:kicked', () => setKicked(true));
    socket.on('room:error', (err: { message: string }) => setNotice(err.message));
    socket.on('clipboard:error', (err: { message: string }) => setNotice(err.message));

    fetchHistory(sessionId).then(setItems).catch(() => {});

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('history:sync');
      socket.off('clipboard:new');
      socket.off('device:joined');
      socket.off('device:left');
      socket.off('devices:update');
      socket.off('device:kicked');
      socket.off('room:error');
      socket.off('clipboard:error');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Optional: poll the OS clipboard while the tab is focused and "watch" is
  // on, so copying outside the browser can still be pushed automatically.
  useEffect(() => {
    if (!watchClipboard) return;
    const interval = setInterval(async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text && text !== lastClipboardRef.current) {
          lastClipboardRef.current = text;
          pushItem(/^(https?:\/\/|www\.)\S+$/i.test(text) ? 'url' : 'text', text);
        }
      } catch {
        // permission not granted / tab not focused — silently skip this tick
      }
    }, 2500);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchClipboard, encryptionKey]);

  async function pushItem(
    type: 'text' | 'url' | 'image' | 'file',
    content: string,
    extra: Partial<Pick<ClipboardItem, 'fileName' | 'fileUrl' | 'mimeType'>> & {
      encrypted?: boolean;
      description?: string;
    } = {},
  ): Promise<{ ok: boolean; message?: string }> {
    let finalContent = content;
    let encrypted = !!extra.encrypted;
    if (isEncrypted && encryptionKey && (type === 'text' || type === 'url')) {
      finalContent = await encryptText(encryptionKey, content);
      encrypted = true;
    }

    // The description is a plain note ("what this content is for") shown to
    // every device — encrypt it too whenever the session itself is
    // end-to-end encrypted, so it doesn't leak more than the content does.
    let finalDescription = extra.description?.trim() || undefined;
    if (finalDescription && isEncrypted && encryptionKey) {
      finalDescription = await encryptText(encryptionKey, finalDescription);
      encrypted = true;
    }

    const payload = {
      sessionId,
      type,
      content: finalContent,
      deviceLabel: deviceLabel.current,
      encrypted,
      ...extra,
      description: finalDescription,
    };

    const socket = getSocket();
    if (socket.connected) {
      // Ask the server to acknowledge receipt so the UI can confirm the
      // send actually went through (rather than assuming it worked).
      return new Promise((resolve) => {
        const timeout = setTimeout(
          () => resolve({ ok: false, message: 'No response from server — check your connection.' }),
          8000,
        );
        socket.emit(
          'clipboard:push',
          payload,
          (response: { ok: boolean; message?: string } | undefined) => {
            clearTimeout(timeout);
            if (response?.ok) {
              resolve({ ok: true });
            } else {
              resolve({ ok: false, message: response?.message || 'Failed to send.' });
            }
          },
        );
      });
    } else {
      offlineQueue.enqueue({
        id: crypto.randomUUID(),
        sessionId,
        type,
        content: finalContent,
        fileName: extra.fileName,
        fileUrl: extra.fileUrl,
        mimeType: extra.mimeType,
        encrypted,
        deviceLabel: deviceLabel.current,
        description: finalDescription,
        queuedAt: Date.now(),
      });
      setNotice('Offline — this item will send automatically once reconnected.');
      setTimeout(() => setNotice(''), 3000);
      return { ok: false, message: 'Offline — queued to send once reconnected.' };
    }
  }

  if (kicked) {
    return (
      <div className="container" style={{ textAlign: 'center' }}>
        <div className="card">
          <h2>You were removed from this session</h2>
          <p style={{ color: 'var(--text-dim)' }}>
            Another device removed this device from the pairing.
          </p>
          <a href="/" className="btn" style={{ display: 'inline-block', textDecoration: 'none' }}>
            Back to home
          </a>
        </div>
      </div>
    );
  }

  const waitingForKey = isEncrypted && !encryptionKey;

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <a href="/" style={{ fontSize: 14, color: 'var(--text-dim)', textDecoration: 'none' }}>← Back</a>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="pill">
            <span className="dot" style={{ background: connected ? 'var(--accent-2)' : 'var(--danger)' }} />
            {connected ? 'Live' : 'Reconnecting…'}
          </span>
          <label className="pill" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={watchClipboard}
              onChange={(e) => setWatchClipboard(e.target.checked)}
              style={{ width: 14, height: 14 }}
            />
            Watch clipboard
          </label>
        </div>
      </div>

      {notice && (
        <div className="card" style={{ marginBottom: 16, padding: '10px 16px', borderColor: 'var(--accent)', fontSize: 14 }}>
          🔔 {notice}
        </div>
      )}

      {pairing && (
        <div style={{ marginBottom: 20 }}>
          <QRPairing
            code={pairing.code}
            sessionId={sessionId}
            deviceCount={Math.max(devices.length, 1)}
            encryptionKeyB64={pairing.encryptionKeyB64}
          />
        </div>
      )}

      {waitingForKey && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>🔒 This session is end-to-end encrypted</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>
            Paste the encryption key shown on the device that created this
            session to view and send clipboard items.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <input value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="Paste encryption key…" />
            <button className="btn" onClick={submitManualKey}>Unlock</button>
          </div>
          {keyError && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{keyError}</div>}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: waitingForKey ? 0.4 : 1, pointerEvents: waitingForKey ? 'none' : 'auto' }}>
        <div className="card" style={{ paddingBottom: 14 }}>
          <label style={{ fontSize: 13, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>
            📝 What's this for? <span style={{ opacity: 0.7 }}>(optional note, shown to every device)</span>
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 300))}
            placeholder="e.g. Wifi password for the office, draft for tomorrow's email…"
          />
        </div>

        <PasteBox
          sessionId={sessionId}
          encryptionKey={encryptionKey}
          onSend={async (type, content) => {
            const result = await pushItem(type, content, { description });
            if (result.ok) setDescription('');
            return result;
          }}
          onImagePasted={async (f) => {
            const result = await pushItem('image', f.fileUrl, {
              fileName: f.fileName,
              fileUrl: f.fileUrl,
              mimeType: f.mimeType,
              encrypted: isEncrypted,
              description,
            });
            if (result.ok) setDescription('');
            return result;
          }}
        />
        <FileDrop
          sessionId={sessionId}
          encryptionKey={encryptionKey}
          onUploaded={async (f) => {
            const result = await pushItem(f.type, f.fileUrl, {
              fileName: f.fileName,
              fileUrl: f.fileUrl,
              mimeType: f.mimeType,
              encrypted: f.encrypted,
              description,
            });
            if (result.ok) setDescription('');
            return result;
          }}
        />
        <DeviceList
          devices={devices}
          mySocketId={mySocketId}
          myDeviceLabel={deviceLabel.current}
          isHost={!!devices.find((d) => d.socketId === mySocketId)?.isHost}
          onKick={(socketId) => getSocket().emit('device:kick', { sessionId, socketId })}
        />
        <ClipboardHistory
          items={items}
          sessionId={sessionId}
          encryptionKey={encryptionKey}
          mySocketId={mySocketId}
          isHost={!!devices.find((d) => d.socketId === mySocketId)?.isHost}
          onPin={(id, pinned) => getSocket().emit('clipboard:pin', { sessionId, itemId: id, pinned })}
          onDelete={(id) => getSocket().emit('clipboard:delete', { sessionId, itemId: id })}
        />
      </div>
    </div>
  );
}
