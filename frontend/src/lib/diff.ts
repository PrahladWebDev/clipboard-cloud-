/**
 * Line-based diff powered by `diff` (jsdiff) — the standard, battle-tested
 * diff library (Myers algorithm under the hood). Wrapped here so the rest
 * of the app can keep using a simple DiffLine[] shape, and so changed
 * lines also get word-level highlighting (not just "whole line changed").
 */

import { diffLines as jsDiffLines, diffWords as jsDiffWords } from 'diff';

export type DiffLineType = 'equal' | 'add' | 'remove';

export interface DiffWordSegment {
  text: string;
  changed: boolean;
}

export interface DiffLine {
  type: DiffLineType;
  text: string;
  /** 1-indexed line number in the "left" (their) text, if present on this line. */
  leftNo?: number;
  /** 1-indexed line number in the "right" (your) text, if present on this line. */
  rightNo?: number;
  /** Word-level highlight segments, set when this line pairs with a
   *  same-position line on the other side (a "modified" line rather than
   *  a pure addition/removal). */
  words?: DiffWordSegment[];
}

export interface DiffStats {
  additions: number;
  removals: number;
  unchanged: number;
}

export interface DiffResult {
  lines: DiffLine[];
  stats: DiffStats;
  identical: boolean;
}

/** Splits a jsdiff chunk's `.value` into individual lines, dropping the
 *  trailing empty string left by a final "\n". */
function splitChunk(value: string): string[] {
  const lines = value.replace(/\r\n/g, '\n').split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

export function diffLines(left: string, right: string): DiffResult {
  const chunks = jsDiffLines(left, right);
  const lines: DiffLine[] = [];
  const stats: DiffStats = { additions: 0, removals: 0, unchanged: 0 };
  let leftNo = 0;
  let rightNo = 0;

  for (let c = 0; c < chunks.length; c++) {
    const chunk = chunks[c];
    const chunkLines = splitChunk(chunk.value);

    if (!chunk.added && !chunk.removed) {
      for (const text of chunkLines) {
        leftNo++;
        rightNo++;
        lines.push({ type: 'equal', text, leftNo, rightNo });
        stats.unchanged++;
      }
      continue;
    }

    if (chunk.removed) {
      // Peek ahead: a removed chunk immediately followed by an added chunk
      // is a "modified" block — pair lines 1:1 and word-diff them for
      // precise inline highlighting, the same way GitHub renders edits.
      const next = chunks[c + 1];
      if (next && next.added) {
        const addedLines = splitChunk(next.value);
        const pairCount = Math.min(chunkLines.length, addedLines.length);

        for (let k = 0; k < pairCount; k++) {
          leftNo++;
          rightNo++;
          const words = wordDiffSegments(chunkLines[k], addedLines[k]);
          lines.push({ type: 'remove', text: chunkLines[k], leftNo, words });
          lines.push({ type: 'add', text: addedLines[k], rightNo, words });
          stats.removals++;
          stats.additions++;
        }
        // Leftover unpaired lines on either side are plain removals/additions.
        for (let k = pairCount; k < chunkLines.length; k++) {
          leftNo++;
          lines.push({ type: 'remove', text: chunkLines[k], leftNo });
          stats.removals++;
        }
        for (let k = pairCount; k < addedLines.length; k++) {
          rightNo++;
          lines.push({ type: 'add', text: addedLines[k], rightNo });
          stats.additions++;
        }
        c++; // consumed the paired "added" chunk
        continue;
      }

      for (const text of chunkLines) {
        leftNo++;
        lines.push({ type: 'remove', text, leftNo });
        stats.removals++;
      }
      continue;
    }

    // Pure addition (no preceding removal to pair with).
    for (const text of chunkLines) {
      rightNo++;
      lines.push({ type: 'add', text, rightNo });
      stats.additions++;
    }
  }

  return { lines, stats, identical: stats.additions === 0 && stats.removals === 0 };
}

/** Word-level diff between two lines, used to highlight just the changed
 *  tokens within a modified line rather than the whole line. */
function wordDiffSegments(oldLine: string, newLine: string): DiffWordSegment[] {
  const parts = jsDiffWords(oldLine, newLine);
  return parts.map((p) => ({ text: p.value, changed: !!(p.added || p.removed) }));
}
