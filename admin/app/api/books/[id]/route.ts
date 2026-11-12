import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../../lib/api';
import { getSessionToken } from '../../../../lib/auth';

async function forward(request: NextRequest, id: string) {
  const token = getSessionToken();
  if (!token) return NextResponse.json({ success: false, error: { message: 'Please sign in again.' } }, { status: 401 });
  try {
    const response = await fetch(`${API_BASE_URL}/admin/books/${encodeURIComponent(id)}`, {
      method: request.method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(request.method === 'PUT' ? { body: await request.text() } : {}),
      cache: 'no-store',
    });
    const body = await response.json();
    return NextResponse.json(body, { status: response.status });
  } catch {
    return NextResponse.json({ success: false, error: { message: 'The book service is unavailable. Please retry.' } }, { status: 503 });
  }
}

export function PUT(request: NextRequest, { params }: { params: { id: string } }) { return forward(request, params.id); }
export function DELETE(request: NextRequest, { params }: { params: { id: string } }) { return forward(request, params.id); }
