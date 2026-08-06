'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { listSnippets, deleteSnippet, SavedSnippet } from '@/lib/auth';
import { fileDownloadUrl } from '@/lib/api';

export default function SnippetsPage() {
  const { user, loading } = useAuth();
  const [snippets, setSnippets] = useState<SavedSnippet[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!user) {
      setBusy(false);
      return;
    }
    listSnippets()
      .then(setSnippets)
      .finally(() => setBusy(false));
  }, [user]);

  if (loading || busy) {
    return <div className="container">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="container" style={{ textAlign: 'center' }}>
        <p>You need an account to view saved snippets.</p>
        <a href="/login" className="btn" style={{ display: 'inline-block', textDecoration: 'none' }}>
          Log in
        </a>
      </div>
    );
  }

  async function remove(id: string) {
    await deleteSnippet(id);
    setSnippets((prev) => prev.filter((s) => s._id !== id));
  }

  return (
    <div className="container">
      <a href="/" style={{ fontSize: 14, color: 'var(--text-dim)', textDecoration: 'none' }}>
        ← Back
      </a>
      <h1 style={{ fontSize: 26 }}>My saved snippets</h1>
      <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>
        Items you explicitly saved from a clipboard session. These persist in
        MongoDB, independent of the clipboard session they came from.
      </p>
      {snippets.length === 0 && (
        <p style={{ color: 'var(--text-dim)' }}>
          Nothing saved yet — use "Save to my account" on an item in a
          clipboard session.
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {snippets.map((s) => (
          <div key={s._id} className="card" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              {s.type === 'image' && s.fileUrl ? (
                <img src={fileDownloadUrl(s.fileUrl)} style={{ maxWidth: 200, borderRadius: 8 }} />
              ) : s.type === 'file' && s.fileUrl ? (
                <a href={fileDownloadUrl(s.fileUrl)} style={{ color: 'var(--accent-2)' }}>{s.fileName}</a>
              ) : (
                <div style={{ wordBreak: 'break-word' }}>{s.content}</div>
              )}
              {s.description && (
                <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 6, fontStyle: 'italic' }}>
                  📝 {s.description}
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
                {new Date(s.createdAt).toLocaleString()}
              </div>
            </div>
            <button className="btn danger" style={{ height: 'fit-content' }} onClick={() => remove(s._id)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
