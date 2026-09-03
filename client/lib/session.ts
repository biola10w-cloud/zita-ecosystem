import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'zita_reader_session';
export const REFRESH_COOKIE = 'zita_reader_refresh';

export function getSessionToken(): string | undefined {
  return cookies().get(SESSION_COOKIE)?.value;
}
