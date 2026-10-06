import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '../../../lib/api';
import { getSessionToken, SESSION_COOKIE, REFRESH_COOKIE } from '../../../lib/session';

export async function GET() {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!await getSessionToken()) return NextResponse.json({ success: false }, { status: 401, headers });
  try {
    const data = await apiFetch('/users/me');
    return NextResponse.json({ success: true, data }, { headers });
  } catch (error) {
    return NextResponse.json({ success: false, error: { message: 'Unable to load your account. Please try again.' } }, {
      status: error instanceof ApiError ? error.status : 503, headers,
    });
  }
}

export async function DELETE(request: NextRequest) {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ success: false }, { status: 403, headers });
  }
  if (!await getSessionToken()) return NextResponse.json({ success: false }, { status: 401, headers });
  const input = await request.json().catch(() => null);
  if (!input || typeof input.password !== 'string' || input.password.length < 1 || input.password.length > 128 || input.confirmation !== 'DELETE') {
    return NextResponse.json({ success: false, error: { message: 'Enter your password and confirm deletion.' } }, { status: 400, headers });
  }
  try {
    await apiFetch('/users/me', { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: input.password, confirmation: input.confirmation }) });
    const response = NextResponse.json({ success: true, data: null }, { headers });
    response.cookies.delete(SESSION_COOKIE); response.cookies.delete(REFRESH_COOKIE);
    return response;
  } catch (error) {
    return NextResponse.json({ success: false, error: { message: error instanceof ApiError ? error.message : 'Unable to delete your account. Please try again.' } }, {
      status: error instanceof ApiError ? error.status : 503, headers,
    });
  }
}
