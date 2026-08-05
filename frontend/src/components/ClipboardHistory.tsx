'use client';

import { useEffect, useMemo, useState } from 'react';
import { fileDownloadUrl } from '@/lib/api';
import { decryptText, decryptBlob } from '@/lib/crypto';
import { useAuth } from '@/context/AuthContext';
import { saveSnippet } from '@/lib/auth';

export interface ClipboardItem {
  id: string;
  type: 'text' | 'url' | 'image' | 'file';
  content: string;
  fileName?: string;
  fileUrl?: string;
  mimeType?: string;
  encrypted?: boolean;
  pinned: boolean;
  deviceLabel?: string;
  description?: string;
  createdAt: number;
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function iconFor(item: ClipboardItem) {
  if (item.type === 'url') return '🔗';
  if (item.type === 'image') return '🖼️';
  if (item.type === 'file') return '📁';
  return '📋';
}

export default function ClipboardHistory({
  items,
  sessionId,
  encryptionKey,
  onPin,
  onDelete,
}: {
  items: ClipboardItem[];
  sessionId: string;
  encryptionKey: CryptoKey | null;
  onPin: (id: string, pinned: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  // Decrypted plaintext / object URLs for encrypted items, keyed by item id.
  const [decrypted, setDecrypted] = useState<Record<string, string>>({});

  // Decrypt encrypted items as they arrive (or once a key becomes available).
  useEffect(() => {
    if (!encryptionKey) return;
    items
      .filter((i) => i.encrypted && decrypted[i.id] === undefined)
      .forEach(async (item) => {
        try {
          if (item.type === 'text' || item.type === 'url') {
            const plain = await decryptText(encryptionKey, item.content);
            setDecrypted((prev) => ({ ...prev, [item.id]: plain }));
          } else if (item.fileUrl) {
            const res = await fetch(fileDownloadUrl(item.fileUrl, sessionId));
            const encBlob = await res.blob();
            const plainBlob = await decryptBlob(encryptionKey, encBlob, item.mimeType || '');
            setDecrypted((prev) => ({ ...prev, [item.id]: URL.createObjectURL(plainBlob) }));
          }
        } catch {
          setDecrypted((prev) => ({ ...prev, [item.id]: '__DECRYPT_FAILED__' }));
        }
      });
    // Descriptions are encrypted independently of the content, so decrypt
    // them under a separate key namespace ("desc:<id>") in the same map.
    items
      .filter((i) => i.encrypted && i.description && decrypted[`desc:${i.id}`] === undefined)
      .forEach(async (item) => {
        try {
          const plain = await decryptText(encryptionKey, item.description!);
          setDecrypted((prev) => ({ ...prev, [`desc:${item.id}`]: plain }));
        } catch {
          setDecrypted((prev) => ({ ...prev, [`desc:${item.id}`]: '__DECRYPT_FAILED__' }));
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, encryptionKey]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((i) => {
      const text = i.encrypted ? decrypted[i.id] || '' : i.content;
      const desc = displayDescription(i) || '';
      return (
        text.toLowerCase().includes(q) ||
        i.fileName?.toLowerCase().includes(q) ||
        desc.toLowerCase().includes(q)
      );
    });
  }, [items, query, decrypted]);

  function displayContent(item: ClipboardItem): string | null {
    if (!item.encrypted) return item.content;
    const d = decrypted[item.id];
    if (d === undefined) return null; // still decrypting
    if (d === '__DECRYPT_FAILED__') return null;
    return d;
  }

  function displayDescription(item: ClipboardItem): string | null {
    if (!item.description) return null;
    if (!item.encrypted) return item.description;
    const d = decrypted[`desc:${item.id}`];
    if (d === undefined || d === '__DECRYPT_FAILED__') return null;
    return d;
  }

  async function copyItem(item: ClipboardItem) {
    const content = displayContent(item);
    try {
      if (item.type === 'text' || item.type === 'url') {
        if (content) await navigator.clipboard.writeText(content);
      } else if (item.type === 'image' && item.fileUrl && 'ClipboardItem' in window) {
        const src = item.encrypted ? content : fileDownloadUrl(item.fileUrl, sessionId);
        if (!src) return;
        const res = await fetch(src);
        const blob = await res.blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type || item.mimeType || 'image/png']: blob })]);
      } else if (item.fileUrl) {
        await navigator.clipboard.writeText(item.encrypted ? content || '' : fileDownloadUrl(item.fileUrl, sessionId));
      }
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // clipboard write can fail without a user gesture in some browsers; ignore
    }
  }

  async function saveToAccount(item: ClipboardItem) {
    if (item.encrypted) return; // don't persist ciphertext the account page can't decrypt later
    try {
      await saveSnippet({
        type: item.type,
        content: item.content,
        fileName: item.fileName,
        fileUrl: item.fileUrl,
        mimeType: item.mimeType,
        description: item.description,
      });
      setSavedId(item.id);
      setTimeout(() => setSavedId(null), 1500);
    } catch {
      // ignore — user will just not see the "Saved" confirmation
    }
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>History ({items.length})</h2>
      </div>
      <input
        placeholder="🔍 Search history…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 14 }}
      />

      {filtered.length === 0 && (
        <p style={{ color: 'var(--text-dim)', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>
          {items.length === 0
            ? 'Nothing copied yet. Add text, a link, or a file above.'
            : 'No items match your search.'}
        </p>
      )}

      <div
        className="scrollbar-thin"
        style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 480, overflowY: 'auto' }}
      >
        {filtered.map((item) => {
          const content = displayContent(item);
          const description = displayDescription(item);
          return (
            <div
              key={item.id}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                background: 'var(--panel-2)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 20 }}>{item.encrypted ? '🔒' : iconFor(item)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {description && (
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--text-dim)',
                      marginBottom: 6,
                      fontStyle: 'italic',
                      background: 'var(--panel)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '4px 8px',
                      display: 'inline-block',
                      wordBreak: 'break-word',
                    }}
                  >
                    📝 {description}
                  </div>
                )}
                {content === null ? (
                  <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                    {decrypted[item.id] === '__DECRYPT_FAILED__'
                      ? 'Could not decrypt — this device may not have the session key.'
                      : 'Decrypting…'}
                  </div>
                ) : item.type === 'image' ? (
                  <img
                    src={item.encrypted ? content : fileDownloadUrl(item.fileUrl!, sessionId)}
                    alt={item.fileName || 'clipboard image'}
                    style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 8 }}
                  />
                ) : item.type === 'file' ? (
                  <a
                    href={item.encrypted ? content : fileDownloadUrl(item.fileUrl!, sessionId)}
                    target="_blank"
                    rel="noreferrer"
                    download={item.encrypted ? item.fileName : undefined}
                    style={{ color: 'var(--accent-2)', wordBreak: 'break-all' }}
                  >
                    {item.fileName || 'Download file'}
                  </a>
                ) : item.type === 'url' ? (
                  <a href={content} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-2)', wordBreak: 'break-all' }}>
                    {content}
                  </a>
                ) : (
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 14 }}>{content}</div>
                )}
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
                  {item.deviceLabel || 'Device'} · {timeAgo(item.createdAt)}
                  {item.encrypted && ' · end-to-end encrypted'}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button className="btn secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => copyItem(item)}>
                  {copiedId === item.id ? '✓ Copied' : 'Copy'}
                </button>
                <button className="btn secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => onPin(item.id, !item.pinned)}>
                  {item.pinned ? '★ Pinned' : '☆ Pin'}
                </button>
                {user && !item.encrypted && (
                  <button className="btn secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => saveToAccount(item)}>
                    {savedId === item.id ? '✓ Saved' : 'Save'}
                  </button>
                )}
                <button className="btn danger" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => onDelete(item.id)}>
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}