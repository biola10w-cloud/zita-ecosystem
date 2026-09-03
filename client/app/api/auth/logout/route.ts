import { NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../../lib/api';
import { getSessionToken, REFRESH_COOKIE, SESSION_COOKIE } from '../../../../lib/session';

export async function POST() {
  const token = getSessionToken();
  if (token) {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }).catch(() => undefined);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  return response;
}
