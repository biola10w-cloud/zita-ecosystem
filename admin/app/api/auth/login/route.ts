import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../../lib/api';
import { SESSION_COOKIE, REFRESH_COOKIE } from '../../../../lib/auth';

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      // A stable, length-valid (32-128 chars) fingerprint for the admin panel's "device"
      deviceFingerprint: Buffer.from(`admin-panel-${email}`).toString('hex').padEnd(32, '0').slice(0, 64),
      platform: 'WEB',
    }),
  });

  const body = await response.json().catch(() => ({ success: false, error: { message: 'Login failed' } }));

  if (!response.ok) {
    return NextResponse.json(
      { success: false, error: body?.error ?? { message: 'Login failed' } },
      { status: response.status },
    );
  }

  if (body.data.user.role !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_ADMIN', message: 'This account does not have admin access' } },
      { status: 403 },
    );
  }

  const res = NextResponse.json({ success: true, data: { user: body.data.user } });
  res.cookies.set(SESSION_COOKIE, body.data.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 15, // Matches backend access token expiry (15m)
  });
  res.cookies.set(REFRESH_COOKIE, body.data.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // Matches backend refresh token expiry (30d)
  });

  return res;
}
