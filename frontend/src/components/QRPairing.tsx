'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function QRPairing({
  code,
  sessionId,
  deviceCount,
  encryptionKeyB64,
}: {
  code: string;
  sessionId: string;
  deviceCount: number;
  /** Present only when this session was created with E2E encryption on. */
  encryptionKeyB64?: string | null;
}) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [keyCopied, setKeyCopied] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  // Generate the QR client-side so the encryption key (if any) can travel as
  // a URL fragment, which browsers never send in HTTP requests — the server
  // never sees it, keeping the pairing genuinely end-to-end.
  useEffect(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    let url = `${origin}/clipboard/${sessionId}?code=${code}`;
    if (encryptionKeyB64) url += `#k=${encryptionKeyB64}`;
    QRCode.toDataURL(url, { margin: 1, width: 240 }).then(setQrDataUrl);
  }, [sessionId, code, encryptionKeyB64]);

  async function copyKey() {
    if (!encryptionKeyB64) return;
    await navigator.clipboard.writeText(encryptionKeyB64);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 1500);
  }

  const paired = deviceCount >= 2;

  const pairingBody = (
    <div style={{ textAlign: 'center' }}>
      <p style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 0 }}>
        {paired
          ? 'Anyone can join with this QR code or 6-digit code — add as many devices as you need.'
          : 'Scan this QR code, or enter the code below on the other device.'}
      </p>
      {qrDataUrl && (
        <img
          src={qrDataUrl}
          alt="Pairing QR code"
          width={200}
          height={200}
          style={{ borderRadius: 12, background: 'white', padding: 12, margin: '12px 0' }}
        />
      )}
      <div style={{ fontSize: 34, letterSpacing: 8, fontWeight: 700, margin: '8px 0' }}>{code}</div>

      {encryptionKeyB64 && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '0 0 8px' }}>
            🔒 End-to-end encryption is on. Scanning the QR carries the key
            automatically. If you're joining with the 6-digit code instead,
            copy this key and paste it on the other device when asked:
          </p>
          <button className="btn secondary" onClick={copyKey}>
            {keyCopied ? '✓ Key copied' : 'Copy encryption key'}
          </button>
        </div>
      )}
    </div>
  );

  if (!paired) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: 18, textAlign: 'center' }}>Waiting for second device…</h2>
        {pairingBody}
      </div>
    );
  }

  // 2+ devices: keep the code + QR reachable so more devices can still join.
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="dot" />
          <span>Paired — {deviceCount} devices connected. Copy on one, paste on the other.</span>
        </div>
        <button className="btn secondary" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => setShowJoin((v) => !v)}>
          {showJoin ? 'Hide code' : '＋ Add more devices'}
        </button>
      </div>
      {showJoin && <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>{pairingBody}</div>}
    </div>
  );
}
