import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../../../lib/api';
import { getSessionToken } from '../../../../../lib/session';

type Context = { params: Promise<{ slug: string; index: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  return proxy(await params, 'GET', undefined, request.nextUrl.searchParams.get('language'));
}

export async function POST(request: NextRequest, { params }: Context) {
  return proxy(await params, 'POST', await request.text());
}

async function proxy(params: Awaited<Context['params']>, method: 'GET' | 'POST', body?: string, language?: string | null) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ success: false, error: { message: 'Please sign in to read.' } }, { status: 401 });

  const path = method === 'POST'
    ? `/books/${encodeURIComponent(params.slug)}/${params.index === 'translations' ? 'translations' : 'progress'}`
    : params.index === 'progress' ? `/books/${encodeURIComponent(params.slug)}/progress`
    : `/books/${encodeURIComponent(params.slug)}/chapters/${encodeURIComponent(params.index)}/content${language ? `?language=${encodeURIComponent(language)}` : ''}`;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body,
    cache: 'no-store',
  });
  const result = await response.json().catch(() => ({ success: false, error: { message: 'Reading request failed.' } }));
  if (params.index === 'translations' && response.status === 404) {
    return NextResponse.json({ success: false, error: { message: 'Automatic translation is not available yet. Please choose the original language or an existing translation.' } }, { status: 503, headers: { 'Cache-Control': 'no-store, private' } });
  }
  const nextResponse = NextResponse.json(result, { status: response.status });
  nextResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  nextResponse.headers.set('Content-Disposition', 'inline');
  nextResponse.headers.set('X-Content-Type-Options', 'nosniff');
  return nextResponse;
}
