'use client';

import { useState } from 'react';
import { diffLines, DiffResult } from '@/lib/diff';

/**
 * Diff Checker — hidden by default behind an "Add Diff Check" button so it
 * doesn't clutter the session page. Once opened it shows two paste panels
 * (one per side, e.g. "their" code vs "your" code); clicking Compare
 * renders a line-by-line diff between them.
 */
export default function DiffChecker() {
  const [open, setOpen] = useState(false);
  const [theirCode, setTheirCode] = useState('');
  const [yourCode, setYourCode] = useState('');
  const [result, setResult] = useState<DiffResult | null>(null);

  function compare() {
    setResult(diffLines(theirCode, yourCode));
  }

  function reset() {
    setTheirCode('');
    setYourCode('');
    setResult(null);
  }

  function close() {
    setOpen(false);
    reset();
  }

  if (!open) {
    return (
      <button className="btn secondary" onClick={() => setOpen(true)} style={{ alignSelf: 'flex-start' }}>
        🔍 Add Diff Check
      </button>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>🔍 Diff Checker</h3>
        <button className="btn secondary" onClick={close} style={{ padding: '6px 12px', fontSize: 13 }}>
          ✕ Close
        </button>
      </div>

      <div className="diff-input-grid">
        <div>
          <label style={{ fontSize: 13, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>
            Their side
          </label>
          <textarea
            value={theirCode}
            onChange={(e) => setTheirCode(e.target.value)}
            placeholder="Paste their code here…"
            rows={10}
            style={{ fontFamily: 'monospace', fontSize: 13, resize: 'vertical' }}
          />
        </div>
        <div>
          <label style={{ fontSize: 13, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>
            Your side
          </label>
          <textarea
            value={yourCode}
            onChange={(e) => setYourCode(e.target.value)}
            placeholder="Paste your code here…"
            rows={10}
            style={{ fontFamily: 'monospace', fontSize: 13, resize: 'vertical' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button
          className="btn"
          onClick={compare}
          disabled={!theirCode.trim() && !yourCode.trim()}
        >
          Compare
        </button>
        <button className="btn secondary" onClick={reset}>
          Clear
        </button>
      </div>

      {result && (
        <div style={{ marginTop: 18 }}>
          {result.identical ? (
            <div className="pill" style={{ borderColor: 'var(--accent-2)', color: 'var(--accent-2)' }}>
              ✅ No differences — both sides are identical
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                <span className="pill" style={{ color: 'var(--accent-2)' }}>
                  + {result.stats.additions} added
                </span>
                <span className="pill" style={{ color: 'var(--danger)' }}>
                  − {result.stats.removals} removed
                </span>
                <span className="pill">{result.stats.unchanged} unchanged</span>
              </div>
              <div className="diff-view scrollbar-thin">
                {result.lines.map((line, idx) => (
                  <div key={idx} className={`diff-line diff-line--${line.type}`}>
                    <span className="diff-line__no">{line.leftNo ?? ''}</span>
                    <span className="diff-line__no">{line.rightNo ?? ''}</span>
                    <span className="diff-line__marker">
                      {line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' '}
                    </span>
                    <span className="diff-line__text">
                      {line.words
                        ? line.words.map((seg, sIdx) =>
                            seg.changed ? (
                              <mark key={sIdx} className={`diff-word diff-word--${line.type}`}>
                                {seg.text}
                              </mark>
                            ) : (
                              <span key={sIdx}>{seg.text}</span>
                            ),
                          )
                        : line.text.length
                          ? line.text
                          : ' '}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
