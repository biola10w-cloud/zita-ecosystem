import { NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../../lib/api';
import { getSessionToken, REFRESH_COOKIE, SESSION_COOKIE } from '../../../../lib/auth';

export async function POST() {
  const token = getSessionToken();

  if (token) {
    // The browser cookies are not sufficient: invalidate the backend device
    // session as well so a copied refresh token cannot continue the session.
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }).catch(() => undefined);
  }

  const res = NextResponse.json({ success: true });
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete(REFRESH_COOKIE);
  return res;
}
