import axios from 'axios';
import { API_URL } from './api';

const api = axios.create({ baseURL: `${API_URL}/api` });

const TOKEN_KEY = 'clipboard-cloud:token';

export interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function register(email: string, password: string, displayName?: string) {
  const { data } = await api.post('/auth/register', { email, password, displayName });
  setToken(data.accessToken);
  return data.user as AuthUser;
}

export async function login(email: string, password: string) {
  const { data } = await api.post('/auth/login', { email, password });
  setToken(data.accessToken);
  return data.user as AuthUser;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchMeOnce(token: string): Promise<AuthUser> {
  const { data } = await api.get('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 8000,
  });
  return data as AuthUser;
}

// A handful of retries with backoff. A refresh can land right as the
// backend is still waking up / reconnecting to Mongo, and a single
// 800ms retry (the old behaviour) often isn't enough — which made a
// perfectly valid session look logged-out. Only a genuine 401 (the
// token itself rejected) should ever count as a real logout; anything
// else (timeout, network blip, 5xx) should keep retrying instead of
// giving up and clearing the session.
const RETRY_DELAYS_MS = [500, 1500, 3000];

export async function fetchMe(): Promise<AuthUser | null> {
  const token = getToken();
  if (!token) return null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fetchMeOnce(token);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        // The token itself was rejected — this is a genuine logout.
        clearToken();
        return null;
      }
      const isLastAttempt = attempt === RETRY_DELAYS_MS.length;
      if (isLastAttempt) {
        // Keep the token in storage (it may still be valid) and just
        // report "unknown" for this page load — the next successful
        // request will pick the session back up rather than forcing a
        // re-login.
        return null;
      }
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
  return null;
}

export interface SavedSnippet {
  _id: string;
  type: 'text' | 'url' | 'image' | 'file';
  content: string;
  fileName?: string;
  fileUrl?: string;
  mimeType?: string;
  description?: string;
  createdAt: string;
}

export async function saveSnippet(item: {
  type: 'text' | 'url' | 'image' | 'file';
  content: string;
  fileName?: string;
  fileUrl?: string;
  mimeType?: string;
  description?: string;
}) {
  const { data } = await api.post('/account/snippets', item, { headers: authHeaders() });
  return data as SavedSnippet;
}

export async function listSnippets() {
  const { data } = await api.get('/account/snippets', { headers: authHeaders() });
  return data as SavedSnippet[];
}

export async function deleteSnippet(id: string) {
  await api.delete(`/account/snippets/${id}`, { headers: authHeaders() });
}
