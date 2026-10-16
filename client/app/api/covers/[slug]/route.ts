import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../../lib/api';

export async function GET(_: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9_-]{1,220}$/.test(slug)) return new NextResponse(null, { status: 404 });
  try {
    const response = await fetch(`${API_BASE_URL}/assets/covers/${encodeURIComponent(slug)}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) return new NextResponse(null, { status: response.status === 404 ? 404 : 502 });
    const type = response.headers.get('content-type')?.split(';')[0];
    if (!type || !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(type)) return new NextResponse(null, { status: 502 });
    return new NextResponse(await response.arrayBuffer(), { headers: {
      'Content-Type': type, 'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin',
    } });
  } catch { return new NextResponse(null, { status: 502 }); }
}
