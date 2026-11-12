import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../../lib/api';
import { getSessionToken } from '../../../../lib/session';

type Context = { params: Promise<{ path: string[] }> };
async function proxy(request: NextRequest, context: Context) {
  const { path } = await context.params;
  const method = request.method;
  if (!/^[a-zA-Z0-9_-]+$/.test(path[1] || '')) return NextResponse.json({ success: false }, { status: 400 });
  const bookRoute = path.length === 3 && path[0] === 'books' && path[2] === 'comments';
  const feedRoute = path.length === 2 && path[0] === 'community' && path[1] === 'posts';
  const action = path.length === 3 && path[0] === 'comments' ? path[2] : '';
  const allowed = bookRoute || feedRoute ? ['GET', 'POST'] : action === 'replies' ? ['GET'] : action === 'like' ? ['POST', 'DELETE'] : action === 'report' ? ['POST'] : [];
  if (!allowed.includes(method)) return NextResponse.json({ success: false }, { status: 404 });
  const token = await getSessionToken();
  if (method !== 'GET' && !token) return NextResponse.json({ success: false, error: { message: 'Sign in to join the conversation.' } }, { status: 401 });
  const page = Number(request.nextUrl.searchParams.get('page') || 1);
  if (!Number.isSafeInteger(page) || page < 1) return NextResponse.json({ success: false }, { status: 400 });
  const sort = request.nextUrl.searchParams.get('sort') === 'popular' ? 'popular' : 'recent';
  try {
    const response = await fetch(`${API_BASE_URL}/${path.map(encodeURIComponent).join('/')}?page=${page}&limit=20&sort=${sort}`, {
      method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      ...(method === 'POST' ? { body: await request.text() || '{}' } : {}), cache: 'no-store', signal: AbortSignal.timeout(20000),
    });
    const result = await response.json();
    if (feedRoute && response.status === 404) return NextResponse.json({ success: false, error: { message: 'The shared community is not available yet. Please try again later.' } }, { status: 503, headers: { 'Cache-Control': 'no-store, private' } });
    const body = response.ok && method === 'GET' ? { success: true, data: { items: result.data, meta: result.meta } } : result;
    return NextResponse.json(body, { status: response.status, headers: { 'Cache-Control': 'no-store, private' } });
  } catch {
    return NextResponse.json({ success: false, error: { message: 'The community is temporarily unavailable. Please try again.' } }, { status: 503 });
  }
}
export const GET = proxy;
export const POST = proxy;
export const DELETE = proxy;
