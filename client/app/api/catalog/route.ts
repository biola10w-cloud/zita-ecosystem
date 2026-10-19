import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '../../../lib/api';

export async function GET(request: NextRequest) {
  const page = Number(request.nextUrl.searchParams.get('page') ?? '1');
  if (!Number.isSafeInteger(page) || page < 1) return NextResponse.json({ success: false }, { status: 400 });
  const search = (request.nextUrl.searchParams.get('search') ?? '').trim();
  const category = request.nextUrl.searchParams.get('categorySlug') ?? '';
  if (search.length > 200) return NextResponse.json({ success: false }, { status: 400 });
  const params = new URLSearchParams({ limit: '24', page: String(page), search });
  if (category) params.set('categorySlug', category);
  try {
    const data = await apiFetch(`/books?${params}`);
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, error: { message: 'Library unavailable. Please try again.' } }, { status: 503 });
  }
}
