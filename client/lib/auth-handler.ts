import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from './api';
import { REFRESH_COOKIE, SESSION_COOKIE } from './session';

export async function authenticate(request: NextRequest, action: 'login' | 'register') {
  let input;
  try { input = await request.json(); } catch { return NextResponse.json({ success: false, error: { message: 'Invalid request.' } }, { status: 400 }); }
  if (!input || typeof input.email !== 'string' || typeof input.password !== 'string') {
    return NextResponse.json({ success: false, error: { message: 'Enter your email and password.' } }, { status: 400 });
  }
  const email = input.email.trim();
  try {
    const response = await fetch(`${API_BASE_URL}/auth/${action}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(20000),
      body: JSON.stringify({ email, password: input.password, ...(action === 'register' ? { displayName: input.displayName } : {}),
        deviceFingerprint: Buffer.from(`zita-reader-${email}`).toString('hex').padEnd(32, '0').slice(0, 64), platform: 'WEB' }),
    });
    const body = await response.json();
    if (!response.ok) return NextResponse.json({ success: false, error: body.error ?? { message: 'Unable to sign in.' } }, { status: response.status });
    if (!body.data?.accessToken || !body.data?.refreshToken) throw new Error('Invalid session');
    const result = NextResponse.json({ success: true, data: { user: body.data.user } });
    const shared = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
    result.cookies.set(SESSION_COOKIE, body.data.accessToken, { ...shared, maxAge: 900 });
    result.cookies.set(REFRESH_COOKIE, body.data.refreshToken, { ...shared, maxAge: 2592000 });
    return result;
  } catch {
    return NextResponse.json({ success: false, error: { message: 'Unable to connect. Please try again.' } }, { status: 503 });
  }
}
