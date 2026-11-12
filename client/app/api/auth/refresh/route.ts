import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { API_BASE_URL } from '../../../../lib/api';
import { REFRESH_COOKIE, SESSION_COOKIE } from '../../../../lib/session';

export async function POST() {
  const token = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (!token) return NextResponse.json({ success: false }, { status: 401 });
  try {
    const upstream = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token }), cache: 'no-store',
    });
    if (!upstream.ok) {
      const response = NextResponse.json({ success: false }, { status: upstream.status });
      if (upstream.status === 401) {
        response.cookies.delete(SESSION_COOKIE);
        response.cookies.delete(REFRESH_COOKIE);
      }
      return response;
    }
    const body = await upstream.json();
    const response = NextResponse.json({ success: true });
    const shared = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
    response.cookies.set(SESSION_COOKIE, body.data.accessToken, { ...shared, maxAge: 900 });
    response.cookies.set(REFRESH_COOKIE, body.data.refreshToken, { ...shared, maxAge: 2592000 });
    return response;
  } catch {
    return NextResponse.json({ success: false, error: { message: 'Unable to reconnect. Please try again.' } }, { status: 503 });
  }
}
