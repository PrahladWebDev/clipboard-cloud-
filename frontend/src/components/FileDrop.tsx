'use client';

import { useRef, useState } from 'react';
import { uploadFile } from '@/lib/api';
import { encryptBlob } from '@/lib/crypto';

type SendResult = { ok: boolean; message?: string } | void;

export default function FileDrop({
  sessionId,
  encryptionKey,
  onUploaded,
}: {
  sessionId: string;
  encryptionKey: CryptoKey | null;
  onUploaded: (result: {
    type: 'image' | 'file';
    fileName: string;
    fileUrl: string;
    mimeType: string;
    encrypted: boolean;
  }) => SendResult | Promise<SendResult>;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  function showStatus(ok: boolean, text: string) {
    setStatus({ ok, text });
    setTimeout(() => setStatus(null), 2500);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    setProgress(0);
    try {
      const isImage = file.type.startsWith('image/');
      let toUpload: File | Blob = file;
      if (encryptionKey) {
        toUpload = await encryptBlob(encryptionKey, file);
      }
      const result = await uploadFile(toUpload, sessionId, setProgress);
      const outcome = await onUploaded({
        type: isImage ? 'image' : 'file',
        fileName: file.name,
        fileUrl: result.fileUrl,
        mimeType: file.type,
        encrypted: !!encryptionKey,
      });
      if (outcome && outcome.ok === false) {
        showStatus(false, outcome.message || 'Failed to send.');
      } else {
        showStatus(true, `${file.name} sent ✓`);
      }
    } catch {
      showStatus(false, 'Upload failed — try again.');
    } finally {
      setProgress(null);
    }
  }

  return (
    <div
      className="card"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      style={{
        cursor: 'pointer',
        textAlign: 'center',
        borderStyle: 'dashed',
        borderColor: dragOver ? 'var(--accent)' : 'var(--border)',
        background: dragOver ? 'rgba(109,109,255,0.08)' : 'var(--panel)',
      }}
    >
      <input ref={inputRef} type="file" hidden onChange={(e) => handleFiles(e.target.files)} />
      <div style={{ fontSize: 28 }}>📂</div>
      <p style={{ margin: '6px 0 0', color: 'var(--text-dim)', fontSize: 14 }}>
        {progress !== null
          ? `Uploading… ${progress}%`
          : `Drag & drop a file or image here, or click to browse${encryptionKey ? ' (encrypted)' : ''}`}
      </p>
      {status && (
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 13,
            fontWeight: 600,
            color: status.ok ? 'var(--accent-2)' : 'var(--danger)',
          }}
        >
          {status.ok ? '✅' : '⚠️'} {status.text}
        </p>
      )}
    </div>
  );
}
