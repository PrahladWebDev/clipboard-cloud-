'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <h1 style={{ fontSize: 26 }}>Log in</h1>
      <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>
        Optional — an account lets you save clipboard items permanently
        across sessions. Pairing/sync itself never requires this.
      </p>
      <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</div>}
        <button className="btn" disabled={loading}>{loading ? 'Logging in…' : 'Log in'}</button>
      </form>
      <p style={{ fontSize: 14, marginTop: 16, textAlign: 'center' }}>
        No account? <a href="/register" style={{ color: 'var(--accent-2)' }}>Register</a>
      </p>
    </div>
  );
}
