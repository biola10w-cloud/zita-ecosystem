import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../lib/api';
import { getSessionToken } from '../../../lib/auth';

export async function GET(request: NextRequest) {
  const token = getSessionToken();
  const { searchParams } = new URL(request.url);

  const response = await fetch(`${API_BASE_URL}/admin/books?${searchParams.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  const body = await response.json();
  return NextResponse.json(body, { status: response.status });
}

// Forwards the multipart upload (metadata + content file + cover file)
// straight through to the backend's encryption pipeline.
export async function POST(request: NextRequest) {
  const token = getSessionToken();
  const formData = await request.formData();

  const response = await fetch(`${API_BASE_URL}/admin/books`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  const body = await response.json();
  return NextResponse.json(body, { status: response.status });
}
