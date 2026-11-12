import { getSessionToken } from './session';

export const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getSessionToken();
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
    throw new ApiError(response.status, body?.error?.message ?? 'Unable to reach the Zita service.');
  }

  return body.data as T;
}
