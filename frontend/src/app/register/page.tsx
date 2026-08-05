'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email, password, displayName || undefined);
      router.push('/');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <h1 style={{ fontSize: 26 }}>Create an account</h1>
      <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>
        Optional — lets you save clipboard items permanently and view them
        later from "My saved snippets".
      </p>
      <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input placeholder="Display name (optional)" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" required minLength={8} placeholder="Password (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</div>}
        <button className="btn" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</button>
      </form>
      <p style={{ fontSize: 14, marginTop: 16, textAlign: 'center' }}>
        Already have an account? <a href="/login" style={{ color: 'var(--accent-2)' }}>Log in</a>
      </p>
    </div>
  );
}
