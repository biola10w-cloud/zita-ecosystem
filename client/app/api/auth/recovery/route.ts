import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../../lib/api';

export async function POST(request: NextRequest) {
  let input;
  try { input = await request.json(); } catch { return NextResponse.json({ success: false }, { status: 400 }); }
  if (!input || (input.action !== 'forgot' && input.action !== 'reset')) return NextResponse.json({ success: false }, { status: 400 });
  const forgot = input.action === 'forgot';
  try {
    const response = await fetch(`${API_BASE_URL}/auth/${forgot ? 'forgot-password' : 'reset-password'}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(20000),
      body: JSON.stringify(forgot ? { email: input.email, resetUrlBase: `${request.nextUrl.origin}/reset-password` } : { token: input.token, newPassword: input.password }),
    });
    const body = await response.json();
    return NextResponse.json(body, { status: response.status });
  } catch {
    return NextResponse.json({ success: false, error: { message: 'Unable to connect. Please try again.' } }, { status: 503 });
  }
}
