'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ClipboardCopy,
  FileUp,
  GitCompare,
  KeyRound,
  Loader2,
  Lock,
  QrCode,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Timer,
  Users,
  Zap,
} from 'lucide-react';
import { createSession, joinByCode } from '@/lib/api';
import { generateKey, exportKeyToBase64 } from '@/lib/crypto';
import { useAuth } from '@/context/AuthContext';

const FEATURES = [
  { icon: Zap, title: 'Instant sync', text: 'Text, links and images show up on every paired device in real time.' },
  { icon: ShieldCheck, title: 'End-to-end encryption', text: 'Optional AES encryption. The key never touches the server.' },
  { icon: FileUp, title: 'File sharing', text: 'Send files up to 50 MB with a one-tap download on the other side.' },
  { icon: Users, title: 'Multi-device', text: 'Pair as many devices as you need with one QR or code.' },
  { icon: GitCompare, title: 'Diff checker', text: 'Compare two snippets together, live, across devices.' },
  { icon: Timer, title: 'Auto-expiring', text: 'Shared files are deleted after 24 hours. Pin what you want to keep.' },
];

const STEPS = [
  { icon: QrCode, title: 'Generate a code', text: 'Start a session on any device. No account needed.' },
  { icon: ScanLine, title: 'Scan or enter it', text: 'Scan the QR code or type the 6-digit code on another device.' },
  { icon: ClipboardCopy, title: 'Copy and paste', text: 'Whatever you share appears everywhere, instantly.' },
];

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
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
          'Invalid code. Ask the other device to generate a new one.',
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <nav className="lp-nav">
        <div className="lp-nav__inner">
          <a href="/" className="lp-logo">
            <span className="lp-logo__mark">
              <ClipboardCopy size={18} strokeWidth={2.25} />
            </span>
            Clipboard Cloud
          </a>
          <div className="lp-nav__links">
            {authLoading ? null : user ? (
              <>
                <a href="/snippets" className="lp-link">My snippets</a>
                <span className="lp-link lp-hide-sm">{user.email}</span>
                <button onClick={logout} className="lp-link lp-link--btn">Log out</button>
              </>
            ) : (
              <>
                <a href="/login" className="lp-link">Log in</a>
                <a href="/register" className="lp-nav__cta">Sign up</a>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="container lp-main">
        <section className="lp-hero">
          <span className="lp-badge">
            <span className="dot" /> No login required
          </span>
          <h1 className="lp-title">
            Copy on one device.
            <br />
            <span className="gradient-text">Paste on any other.</span>
          </h1>
          <p className="lp-sub">
            Pair your phone, laptop and tablet in seconds with a QR code, then share text,
            links, images and files instantly.
          </p>
        </section>

        <section className="lp-actions">
          <div className="lp-panel" style={{ animationDelay: '0.05s' }}>
            <div className="lp-icon-tile"><Smartphone size={20} /></div>
            <h2 className="lp-panel__title">Start on this device</h2>
            <p className="lp-panel__text">
              Generate a QR code and a 6-digit code for your other devices to join.
            </p>
            <label className="lp-check">
              <input
                type="checkbox"
                checked={encrypted}
                onChange={(e) => setEncrypted(e.target.checked)}
              />
              <Lock size={14} />
              End-to-end encrypt this session
            </label>
            <button className="btn lp-btn" onClick={handleCreate} disabled={loading !== null}>
              {loading === 'create' ? (
                <><Loader2 size={16} className="lp-spin" /> Creating</>
              ) : (
                <>Generate pairing code <ArrowRight size={16} /></>
              )}
            </button>
          </div>

          <div className="lp-panel" style={{ animationDelay: '0.15s' }}>
            <div className="lp-icon-tile"><KeyRound size={20} /></div>
            <h2 className="lp-panel__title">Join a session</h2>
            <p className="lp-panel__text">Enter the 6-digit code shown on the other device.</p>
            <div className="lp-join">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                placeholder="000000"
                inputMode="numeric"
                maxLength={6}
                aria-label="6-digit pairing code"
                className="lp-code-input"
              />
              <button className="btn secondary lp-btn" onClick={handleJoin} disabled={loading !== null}>
                {loading === 'join' ? <Loader2 size={16} className="lp-spin" /> : <>Join <ArrowRight size={16} /></>}
              </button>
            </div>
          </div>

          {error && <div className="lp-error">{error}</div>}
        </section>

        <section className="lp-section">
          <h2 className="lp-h2">How it works</h2>
          <div className="lp-grid lp-grid--3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <div key={title} className="lp-feature">
                <div className="lp-step-no">0{i + 1}</div>
                <div className="lp-icon-tile"><Icon size={20} /></div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-section">
          <h2 className="lp-h2">Built for real workflows</h2>
          <div className="lp-grid lp-grid--3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="lp-feature">
                <div className="lp-icon-tile"><Icon size={20} /></div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="lp-footer">
          Nothing is stored long-term unless you pin an item or save it to an account.
        </footer>
      </main>
    </>
  );
}
