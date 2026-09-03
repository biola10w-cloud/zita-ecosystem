import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../../../lib/api';
import { getSessionToken } from '../../../../../lib/session';

type Context = { params: { slug: string; index: string } };

export async function GET(_: NextRequest, { params }: Context) {
  return proxy(params, 'GET');
}

export async function POST(request: NextRequest, { params }: Context) {
  return proxy(params, 'POST', await request.text());
}

async function proxy(params: Context['params'], method: 'GET' | 'POST', body?: string) {
  const token = getSessionToken();
  if (!token) return NextResponse.json({ success: false, error: { message: 'Please sign in to read.' } }, { status: 401 });

  const path = method === 'POST'
    ? `/books/${params.slug}/progress`
    : `/books/${params.slug}/chapters/${params.index}/content`;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body,
    cache: 'no-store',
  });
  const result = await response.json().catch(() => ({ success: false, error: { message: 'Reading request failed.' } }));
  const nextResponse = NextResponse.json(result, { status: response.status });
  nextResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  nextResponse.headers.set('Content-Disposition', 'inline');
  nextResponse.headers.set('X-Content-Type-Options', 'nosniff');
  return nextResponse;
}
