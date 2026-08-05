'use client';

import { useState } from 'react';
import { uploadFile } from '@/lib/api';
import { encryptBlob } from '@/lib/crypto';

const URL_REGEX = /^(https?:\/\/|www\.)\S+$/i;

type SendResult = { ok: boolean; message?: string } | void;

export default function PasteBox({
  sessionId,
  encryptionKey,
  onSend,
  onImagePasted,
}: {
  sessionId: string;
  encryptionKey: CryptoKey | null;
  onSend: (type: 'text' | 'url', content: string) => SendResult | Promise<SendResult>;
  onImagePasted: (result: { fileName: string; fileUrl: string; mimeType: string }) => SendResult | Promise<SendResult>;
}) {
  const [value, setValue] = useState('');
  const [clipboardMsg, setClipboardMsg] = useState('');
  const [uploadingPasted, setUploadingPasted] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<{ ok: boolean; text: string } | null>(null);

  function showStatus(ok: boolean, text: string) {
    setSendStatus({ ok, text });
    setTimeout(() => setSendStatus(null), 2500);
  }

  async function handlePasteEvent(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const imageItem = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
    if (!imageItem) return; // let normal text paste behave as usual
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;
    setUploadingPasted(true);
    try {
      const toUpload = encryptionKey ? await encryptBlob(encryptionKey, file) : file;
      const result = await uploadFile(toUpload, sessionId);
      const outcome = await onImagePasted({
        fileName: file.name || 'pasted-image.png',
        fileUrl: result.fileUrl,
        mimeType: file.type,
      });
      if (outcome && outcome.ok === false) {
        showStatus(false, outcome.message || 'Failed to send image.');
      } else {
        showStatus(true, 'Image sent ✓');
      }
    } catch {
      showStatus(false, 'Failed to send image.');
    } finally {
      setUploadingPasted(false);
    }
  }

  async function send() {
    const trimmed = value.trim();
    if (!trimmed || sending) return;
    const type = URL_REGEX.test(trimmed) ? 'url' : 'text';
    setSending(true);
    try {
      const outcome = await onSend(type, trimmed);
      if (outcome && outcome.ok === false) {
        showStatus(false, outcome.message || 'Failed to send.');
      } else {
        showStatus(true, 'Sent ✓');
        setValue('');
      }
    } catch {
      showStatus(false, 'Failed to send — check your connection.');
    } finally {
      setSending(false);
    }
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setValue(text);
    } catch {
      setClipboardMsg('Clipboard read permission denied — paste manually with Ctrl/Cmd+V instead.');
      setTimeout(() => setClipboardMsg(''), 4000);
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0, fontSize: 16 }}>Add text or a link</h2>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
        }}
        onPaste={handlePasteEvent}
        placeholder="Type, or paste text/an image with Ctrl/Cmd+V, then send…"
        rows={3}
        style={{ resize: 'vertical', fontFamily: 'inherit' }}
      />
      {uploadingPasted && (
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '6px 0 0' }}>Uploading pasted image…</p>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn" onClick={send} disabled={sending}>
          {sending ? 'Sending…' : 'Send to other devices'}
        </button>
        <button className="btn secondary" onClick={pasteFromClipboard}>Paste from clipboard</button>
        {clipboardMsg && <span style={{ color: 'var(--text-dim)', fontSize: 13, alignSelf: 'center' }}>{clipboardMsg}</span>}
        {sendStatus && (
          <span
            style={{
              fontSize: 13,
              alignSelf: 'center',
              color: sendStatus.ok ? 'var(--accent-2)' : 'var(--danger)',
              fontWeight: 600,
            }}
          >
            {sendStatus.ok ? '✅' : '⚠️'} {sendStatus.text}
          </span>
        )}
      </div>
    </div>
  );
}
