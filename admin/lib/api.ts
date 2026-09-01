const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000/api/v1';

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  meta?: any;
  error?: { code: string; message: string };
}

/**
 * Server-side fetch helper — always call this from Route Handlers or
 * Server Components, never directly from client components (keeps the
 * backend URL and token handling off the client).
 */
export async function apiFetch<T = any>(
  path: string,
  token: string | undefined,
  init?: RequestInit,
): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    cache: 'no-store',
  });

  const body = await response.json().catch(() => ({ success: false, data: null }));

  if (!response.ok) {
    throw new ApiError(response.status, body?.error?.code ?? 'ERROR', body?.error?.message ?? 'Request failed');
  }

  return body;
}

export class ApiError extends Error {
  constructor(public statusCode: number, public code: string, message: string) {
    super(message);
  }
}

export { API_BASE_URL };
