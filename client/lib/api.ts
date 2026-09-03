import { getSessionToken } from './session';

export const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000/api/v1';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getSessionToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  });

  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw new Error(body?.error?.message ?? 'Unable to reach the Zita service.');
  }

  return body.data as T;
}
