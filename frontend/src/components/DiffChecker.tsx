'use client';

import { useEffect, useRef, useState } from 'react';
import { diffLines, DiffLine, DiffResult } from '@/lib/diff';
import { getSocket } from '@/lib/socket';

interface DiffRow {
  left: DiffLine | null;
  right: DiffLine | null;
}

/**
 * Groups the flat DiffLine[] (produced by diffLines) into left/right rows
 * for a side-by-side split view — the way most diff-checker sites show it,
 * rather than one interleaved column. A "modified" block (a remove
 * immediately followed by its paired add, both carrying `.words`) becomes
 * one row with the old line on the left and the new line on the right;
 * anything else lands on whichever side it belongs to, with the other side
 * blank for that row.
 */
function buildSplitRows(lines: DiffLine[]): DiffRow[] {
  const rows: DiffRow[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.type === 'equal') {
      rows.push({ left: line, right: line });
      i++;
      continue;
    }
    if (line.type === 'remove') {
      const next = lines[i + 1];
      if (next && next.type === 'add' && line.words && next.words) {
        rows.push({ left: line, right: next });
        i += 2;
        continue;
      }
      rows.push({ left: line, right: null });
      i++;
      continue;
    }
    // Unpaired addition.
    rows.push({ left: null, right: line });
    i++;
  }
  return rows;
}

interface DiffPanelState {
  open: boolean;
  theirCode: string;
  yourCode: string;
  theirPastedBy: string | null;
  yourPastedBy: string | null;
}

interface DiffResultPayload {
  theirCode: string;
  yourCode: string;
  deviceLabel: string;
  at: number;
}

interface DiffCheckerProps {
  sessionId: string;
  deviceLabel: string;
}

/**
 * Diff Checker — hidden by default behind an "Add Diff Check" button so it
 * doesn't clutter the session page. Once opened it shows two paste panels
 * (one per side, e.g. "their" code vs "your" code); clicking Compare
 * renders a line-by-line diff between them.
 *
 * Open/closed state, both text boxes, and comparisons are all synced over
 * the session's socket connection — so opening the panel or pasting into a
 * box on one device shows up live on every other connected device, and
 * running Compare shows everyone the same result plus who ran it.
 */
export default function DiffChecker({ sessionId, deviceLabel }: DiffCheckerProps) {
  const [open, setOpen] = useState(false);
  const [theirCode, setTheirCode] = useState('');
  const [yourCode, setYourCode] = useState('');
  const [theirPastedBy, setTheirPastedBy] = useState<string | null>(null);
  const [yourPastedBy, setYourPastedBy] = useState<string | null>(null);
  const [result, setResult] = useState<DiffResult | null>(null);
  const [compareMeta, setCompareMeta] = useState<{ deviceLabel: string; at: number } | null>(null);

  // Tracks which box (if any) this device is actively typing into, so an
  // incoming remote update doesn't clobber a keystroke in progress.
  const focusedField = useRef<'their' | 'your' | null>(null);
  const updateTimers = useRef<{ their?: ReturnType<typeof setTimeout>; your?: ReturnType<typeof setTimeout> }>({});

  useEffect(() => {
    const socket = getSocket();

    function onState(state: DiffPanelState) {
      setOpen(state.open);
      if (focusedField.current !== 'their') setTheirCode(state.theirCode);
      if (focusedField.current !== 'your') setYourCode(state.yourCode);
      setTheirPastedBy(state.theirPastedBy);
      setYourPastedBy(state.yourPastedBy);
    }

    function onResult(payload: DiffResultPayload) {
      setTheirCode(payload.theirCode);
      setYourCode(payload.yourCode);
      setResult(diffLines(payload.theirCode, payload.yourCode));
      setCompareMeta({ deviceLabel: payload.deviceLabel, at: payload.at });
    }

    socket.on('diff:state', onState);
    socket.on('diff:result', onResult);

    return () => {
      socket.off('diff:state', onState);
      socket.off('diff:result', onResult);
    };
  }, []);

  function emitUpdate(side: 'their' | 'your', content: string) {
    const socket = getSocket();
    clearTimeout(updateTimers.current[side]);
    // Small debounce so every keystroke doesn't hit the socket, while still
    // feeling live to the other side.
    updateTimers.current[side] = setTimeout(() => {
      socket.emit('diff:update', { sessionId, side, content, deviceLabel });
    }, 250);
  }

  function openPanel() {
    setOpen(true);
    getSocket().emit('diff:open', { sessionId });
  }

  function compare() {
    getSocket().emit('diff:compare', { sessionId, deviceLabel });
  }

  function reset() {
    setTheirCode('');
    setYourCode('');
    setTheirPastedBy(null);
    setYourPastedBy(null);
    setResult(null);
    setCompareMeta(null);
    getSocket().emit('diff:clear', { sessionId });
  }

  function close() {
    setOpen(false);
    getSocket().emit('diff:close', { sessionId });
  }

  if (!open) {
    return (
      <button className="btn secondary" onClick={openPanel} style={{ alignSelf: 'flex-start' }}>
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
          <label style={{ fontSize: 13, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            Their side
            {theirPastedBy && <span className="pill" style={{ fontSize: 11 }}>✍️ {theirPastedBy}</span>}
          </label>
          <textarea
            value={theirCode}
            onFocus={() => (focusedField.current = 'their')}
            onBlur={() => (focusedField.current = null)}
            onChange={(e) => {
              setTheirCode(e.target.value);
              emitUpdate('their', e.target.value);
            }}
            placeholder="Paste their code here…"
            rows={10}
            style={{ fontFamily: 'monospace', fontSize: 13, resize: 'vertical' }}
          />
        </div>
        <div>
          <label style={{ fontSize: 13, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            Your side
            {yourPastedBy && <span className="pill" style={{ fontSize: 11 }}>✍️ {yourPastedBy}</span>}
          </label>
          <textarea
            value={yourCode}
            onFocus={() => (focusedField.current = 'your')}
            onBlur={() => (focusedField.current = null)}
            onChange={(e) => {
              setYourCode(e.target.value);
              emitUpdate('your', e.target.value);
            }}
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
          {compareMeta && (
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>
              Compared by {compareMeta.deviceLabel} · {new Date(compareMeta.at).toLocaleTimeString()}
            </div>
          )}
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
              <div className="diff-split-grid">
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>Their side</div>
                  <div className="diff-view scrollbar-thin">
                    {buildSplitRows(result.lines).map((row, idx) => {
                      const line = row.left;
                      const type = line ? line.type : 'blank';
                      return (
                        <div key={idx} className={`diff-line diff-line--${type}`}>
                          <span className="diff-line__no">{line?.leftNo ?? ''}</span>
                          <span className="diff-line__marker">{line?.type === 'remove' ? '−' : ' '}</span>
                          <span className="diff-line__text">
                            {line
                              ? line.words
                                ? line.words
                                    .filter((seg) => !seg.changed || line.type === 'remove')
                                    .map((seg, sIdx) =>
                                      seg.changed ? (
                                        <mark key={sIdx} className="diff-word diff-word--remove">
                                          {seg.text}
                                        </mark>
                                      ) : (
                                        <span key={sIdx}>{seg.text}</span>
                                      ),
                                    )
                                : line.text.length
                                  ? line.text
                                  : ' '
                              : ' '}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>Your side</div>
                  <div className="diff-view scrollbar-thin">
                    {buildSplitRows(result.lines).map((row, idx) => {
                      const line = row.right;
                      const type = line ? line.type : 'blank';
                      return (
                        <div key={idx} className={`diff-line diff-line--${type}`}>
                          <span className="diff-line__no">{line?.rightNo ?? ''}</span>
                          <span className="diff-line__marker">{line?.type === 'add' ? '+' : ' '}</span>
                          <span className="diff-line__text">
                            {line
                              ? line.words
                                ? line.words
                                    .filter((seg) => !seg.changed || line.type === 'add')
                                    .map((seg, sIdx) =>
                                      seg.changed ? (
                                        <mark key={sIdx} className="diff-word diff-word--add">
                                          {seg.text}
                                        </mark>
                                      ) : (
                                        <span key={sIdx}>{seg.text}</span>
                                      ),
                                    )
                                : line.text.length
                                  ? line.text
                                  : ' '
                              : ' '}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
