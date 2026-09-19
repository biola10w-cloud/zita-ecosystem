import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '../../../lib/api';

export async function GET(request: NextRequest) {
  const page = Number(request.nextUrl.searchParams.get('page') ?? '1');
  if (!Number.isSafeInteger(page) || page < 1) return NextResponse.json({ success: false }, { status: 400 });
  try {
    const data = await apiFetch(`/books?limit=24&page=${page}`);
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, error: { message: 'Library unavailable. Please try again.' } }, { status: 503 });
  }
}
