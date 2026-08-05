/**
 * Queues clipboard pushes made while the socket is disconnected, persisted
 * to localStorage so a page refresh or brief network drop doesn't lose them.
 * Flushed automatically once the socket reconnects.
 */

export interface QueuedPush {
  id: string;
  sessionId: string;
  type: 'text' | 'url' | 'image' | 'file';
  content: string;
  fileName?: string;
  fileUrl?: string;
  mimeType?: string;
  encrypted?: boolean;
  deviceLabel?: string;
  description?: string;
  queuedAt: number;
}

const keyFor = (sessionId: string) => `clipboard-cloud:offline-queue:${sessionId}`;

export function enqueue(item: QueuedPush) {
  if (typeof window === 'undefined') return;
  const queue = getQueue(item.sessionId);
  queue.push(item);
  window.localStorage.setItem(keyFor(item.sessionId), JSON.stringify(queue));
}

export function getQueue(sessionId: string): QueuedPush[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(keyFor(sessionId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearQueue(sessionId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(keyFor(sessionId));
}

export function removeFromQueue(sessionId: string, id: string) {
  const remaining = getQueue(sessionId).filter((i) => i.id !== id);
  if (remaining.length) {
    window.localStorage.setItem(keyFor(sessionId), JSON.stringify(remaining));
  } else {
    clearQueue(sessionId);
  }
}
