import axios from 'axios';

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const api = axios.create({ baseURL: `${API_URL}/api` });

export interface CreateSessionResponse {
  sessionId: string;
  code: string;
  qrDataUrl: string;
}

export async function createSession(encrypted = false) {
  const { data } = await api.post<CreateSessionResponse>('/pairing/create', {
    encrypted,
  });
  return data;
}

export async function joinByCode(code: string) {
  const { data } = await api.post<{ sessionId: string }>('/pairing/join', {
    code,
  });
  return data;
}

export async function getSession(sessionId: string) {
  const { data } = await api.get(`/pairing/${sessionId}`);
  return data;
}

export async function fetchHistory(sessionId: string) {
  const { data } = await api.get(`/clipboard/${sessionId}/history`);
  return data;
}

export async function searchHistory(sessionId: string, q: string) {
  const { data } = await api.get(`/clipboard/${sessionId}/search`, {
    params: { q },
  });
  return data;
}

export async function uploadFile(
  file: File | Blob,
  sessionId: string,
  onProgress?: (pct: number) => void,
) {
  const form = new FormData();
  form.append('file', file, (file as File).name || 'upload.bin');
  form.append('sessionId', sessionId);
  const { data } = await api.post('/files/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) {
        onProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    },
  });
  return data as { fileName: string; mimeType: string; size: number; fileUrl: string };
}

export function fileDownloadUrl(fileUrl: string, sessionId?: string) {
  return sessionId
    ? `${API_URL}${fileUrl}?sessionId=${encodeURIComponent(sessionId)}`
    : `${API_URL}${fileUrl}`;
}
