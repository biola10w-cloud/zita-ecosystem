let refreshing: Promise<boolean> | null = null;

export class ReaderRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch('/api/auth/refresh', { method: 'POST' })
      .then((response) => {
        if (response.status >= 500) throw new Error('Unable to reconnect. Please try again.');
        return response.ok;
      }).finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function readerRequest(path: string, init?: RequestInit) {
  let response = await fetch(path, init);
  if (response.status === 401 && await refreshSession()) response = await fetch(path, init);
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw new ReaderRequestError(response.status === 401 ? (body?.error?.code === 'SESSION_ENDED' ? 'This session has ended because your account signed in elsewhere or was signed out. Please sign in again.' : 'Your session has expired. Please sign in again.')
      : body?.error?.message ?? 'Unable to connect. Please try again.', response.status);
  }
  return body.data;
}
