import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { API_BASE_URL } from '../../../../lib/api';
import { SESSION_COOKIE, REFRESH_COOKIE } from '../../../../lib/auth';

export async function POST() {
  const refreshToken = cookies().get(REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    return NextResponse.json({ success: false, error: { code: 'NO_SESSION' } }, { status: 401 });
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    const res = NextResponse.json({ success: false, error: { code: 'REFRESH_FAILED' } }, { status: 401 });
    res.cookies.delete(SESSION_COOKIE);
    res.cookies.delete(REFRESH_COOKIE);
    return res;
  }

  const body = await response.json();

  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, body.data.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 15,
  });
  res.cookies.set(REFRESH_COOKIE, body.data.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}
