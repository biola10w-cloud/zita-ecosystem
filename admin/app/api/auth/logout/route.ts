import { NextResponse } from 'next/server';
import { SESSION_COOKIE, REFRESH_COOKIE } from '../../../../lib/auth';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete(REFRESH_COOKIE);
  return res;
}
