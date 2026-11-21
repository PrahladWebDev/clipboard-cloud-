'use client';

import { useRef, useState } from 'react';
import { uploadFile, MAX_FILE_MB } from '@/lib/api';
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
    setTimeout(() => setStatus(null), 4000);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      showStatus(false, `File is too large — max ${MAX_FILE_MB} MB.`);
      return;
    }
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
    } catch (err: any) {
      const code = err?.response?.status;
      if (code === 429) {
        showStatus(false, 'Too many uploads — wait a minute and try again.');
      } else if (code === 413) {
        showStatus(false, `File is too large — max ${MAX_FILE_MB} MB.`);
      } else {
        showStatus(false, err?.response?.data?.message || 'Upload failed — try again.');
      }
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
        background: dragOver ? 'var(--drag-bg)' : 'var(--panel)',
      }}
    >
      <input ref={inputRef} type="file" hidden onChange={(e) => handleFiles(e.target.files)} />
      <div style={{ fontSize: 28 }}>📂</div>
      <p style={{ margin: '6px 0 0', color: 'var(--text-dim)', fontSize: 14 }}>
        {progress !== null
          ? `Uploading… ${progress}%`
          : `Drag & drop a file or image here, or click to browse${encryptionKey ? ' (encrypted)' : ''}`}
      </p>
      <p style={{ margin: '4px 0 0', color: 'var(--text-dim)', fontSize: 12, opacity: 0.8 }}>
        Max {MAX_FILE_MB} MB · files are deleted after 24 hours
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
