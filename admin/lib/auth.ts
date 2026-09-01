import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'zita_admin_session';
export const REFRESH_COOKIE = 'zita_admin_refresh';

export function getSessionToken(): string | undefined {
  return cookies().get(SESSION_COOKIE)?.value;
}

export function getRefreshToken(): string | undefined {
  return cookies().get(REFRESH_COOKIE)?.value;
}
