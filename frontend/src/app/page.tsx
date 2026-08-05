'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSession, joinByCode } from '@/lib/api';
import { generateKey, exportKeyToBase64 } from '@/lib/crypto';
import { useAuth } from '@/context/AuthContext';

export default function HomePage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [code, setCode] = useState('');
  const [encrypted, setEncrypted] = useState(false);
  const [loading, setLoading] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState('');

  async function handleCreate() {
    setError('');
    setLoading('create');
    try {
      const session = await createSession(encrypted);
      let encryptionKeyB64: string | null = null;
      if (encrypted) {
        const key = await generateKey();
        encryptionKeyB64 = await exportKeyToBase64(key);
      }
      sessionStorage.setItem(
        `pairing:${session.sessionId}`,
        JSON.stringify({ ...session, encryptionKeyB64 }),
      );
      router.push(`/clipboard/${session.sessionId}`);
    } catch (e: any) {
      setError('Could not create a session. Is the backend running?');
    } finally {
      setLoading(null);
    }
  }

  async function handleJoin() {
    if (code.trim().length !== 6) {
      setError('Enter the 6-digit code shown on the other device.');
      return;
    }
    setError('');
    setLoading('join');
    try {
      const { sessionId } = await joinByCode(code.trim());
      router.push(`/clipboard/${sessionId}`);
    } catch (e: any) {
      setError(
        e?.response?.data?.message ||
          'Invalid or expired code. Ask the other device to generate a new one.',
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, fontSize: 13 }}>
        {user ? (
          <>
            <a href="/snippets" style={{ color: 'var(--text-dim)', textDecoration: 'none' }}>My snippets</a>
            <span style={{ color: 'var(--text-dim)' }}>· {user.email}</span>
            <button onClick={logout} style={{ background: 'none', border: 'none', color: 'var(--accent-2)', padding: 0 }}>
              Log out
            </button>
          </>
        ) : (
          <>
            <a href="/login" style={{ color: 'var(--text-dim)', textDecoration: 'none' }}>Log in</a>
            <a href="/register" style={{ color: 'var(--accent-2)', textDecoration: 'none' }}>Create account</a>
          </>
        )}
      </div>

      <header style={{ textAlign: 'center', marginBottom: 40, marginTop: 8 }}>
        <div style={{ fontSize: 44, marginBottom: 8 }}>📋☁️</div>
        <h1 style={{ fontSize: 32, margin: '0 0 8px' }}>Clipboard Cloud</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 16, maxWidth: 480, margin: '0 auto' }}>
          Copy on one device, paste on another — instantly. No login, no
          email-to-self, no messaging apps.
        </p>
      </header>

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: '1fr', maxWidth: 480, margin: '0 auto' }}>
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Start on this device</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>
            Generates a QR code and a 6-digit code for another device to scan
            or enter.
          </p>
          <label className="pill" style={{ cursor: 'pointer', marginBottom: 14, display: 'inline-flex' }}>
            <input
              type="checkbox"
              checked={encrypted}
              onChange={(e) => setEncrypted(e.target.checked)}
              style={{ width: 14, height: 14 }}
            />
            🔒 End-to-end encrypt this session
          </label>
          <div>
            <button className="btn" onClick={handleCreate} disabled={loading !== null}>
              {loading === 'create' ? 'Creating…' : 'Generate pairing code'}
            </button>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Join another device</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>
            Enter the 6-digit code shown on the other device.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              maxLength={6}
              style={{ letterSpacing: 4, fontSize: 20, textAlign: 'center' }}
            />
            <button className="btn secondary" onClick={handleJoin} disabled={loading !== null}>
              {loading === 'join' ? 'Joining…' : 'Join'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 14, textAlign: 'center' }}>{error}</div>
        )}
      </div>

      <footer style={{ textAlign: 'center', marginTop: 60, color: 'var(--text-dim)', fontSize: 13 }}>
        Sessions expire automatically after a period of inactivity. Nothing is
        stored long-term unless you pin an item or save it to an account.
      </footer>
    </div>
  );
}
