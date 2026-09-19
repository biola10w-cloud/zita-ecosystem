import { NextResponse } from 'next/server';
import { apiFetch, ApiError } from '../../../lib/api';
import { getSessionToken } from '../../../lib/session';

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
