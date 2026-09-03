import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../../lib/api';
import { REFRESH_COOKIE, SESSION_COOKIE } from '../../../../lib/session';

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      deviceFingerprint: Buffer.from(`zita-reader-${email}`).toString('hex').padEnd(32, '0').slice(0, 64),
      platform: 'WEB',
    }),
    cache: 'no-store',
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    return NextResponse.json({ success: false, error: body?.error ?? { message: 'Sign in failed.' } }, { status: response.status });
  }

  const result = NextResponse.json({ success: true, data: { user: body.data.user } });
  setSessionCookies(result, body.data.accessToken, body.data.refreshToken);
  return result;
}

function setSessionCookies(response: NextResponse, accessToken: string, refreshToken: string) {
  const shared = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
  response.cookies.set(SESSION_COOKIE, accessToken, { ...shared, maxAge: 60 * 15 });
  response.cookies.set(REFRESH_COOKIE, refreshToken, { ...shared, maxAge: 60 * 60 * 24 * 30 });
}
