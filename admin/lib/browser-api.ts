let refreshing: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch('/api/auth/refresh', { method: 'POST' })
      .then(response => response.ok)
      .catch(() => false)
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function adminRequest(path: string, init?: RequestInit) {
  let response = await fetch(path, init);
  if (response.status === 401) {
    if (await refreshSession()) response = await fetch(path, init);
    if (response.status === 401) throw new Error('Your session has expired. Please sign in again before saving changes.');
  }
  return response;
}
