const DEVICE_ID_KEY = 'clipboard-cloud:deviceId';

// A stable id for this browser, persisted in localStorage so it survives
// page refreshes and reconnects (unlike the socket id, which changes every
// time the connection drops). The backend uses this to recognize "this is
// the same device that created the session" independent of the socket
// lifecycle, e.g. to keep host status across a refresh.
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    // localStorage unavailable (private mode, disabled, etc.) — fall back
    // to a per-load id; host persistence just won't survive a refresh here.
    return `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function detectDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Device';
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/mac/i.test(ua)) return 'Mac';
  if (/win/i.test(ua)) return 'Windows';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Device';
}
