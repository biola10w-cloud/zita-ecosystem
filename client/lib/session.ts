import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'zita_reader_session';
export const REFRESH_COOKIE = 'zita_reader_refresh';

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function hasReaderSession(): Promise<boolean> {
  const store = await cookies();
  return Boolean(store.get(SESSION_COOKIE)?.value || store.get(REFRESH_COOKIE)?.value);
}
