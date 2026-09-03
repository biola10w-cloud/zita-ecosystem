import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../../lib/api';
import { REFRESH_COOKIE, SESSION_COOKIE } from '../../../../lib/session';

export async function POST(request: NextRequest) {
  const { displayName, email, password } = await request.json();
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName,
      email,
      password,
      deviceFingerprint: Buffer.from(`zita-reader-${email}`).toString('hex').padEnd(32, '0').slice(0, 64),
      platform: 'WEB',
    }),
    cache: 'no-store',
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    return NextResponse.json({ success: false, error: body?.error ?? { message: 'Account creation failed.' } }, { status: response.status });
  }

  const result = NextResponse.json({ success: true, data: { user: body.data.user } });
  const shared = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
  result.cookies.set(SESSION_COOKIE, body.data.accessToken, { ...shared, maxAge: 60 * 15 });
  result.cookies.set(REFRESH_COOKIE, body.data.refreshToken, { ...shared, maxAge: 60 * 60 * 24 * 30 });
  return result;
}
