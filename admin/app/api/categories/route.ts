import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../lib/api';
import { getSessionToken } from '../../../lib/auth';

export async function GET() {
  const token = getSessionToken();

  try {
    const response = await fetch(`${API_BASE_URL}/admin/categories`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const body = await response.json();
    return NextResponse.json(body, { status: response.status });
  } catch {
    return NextResponse.json({ success: false, error: { message: 'Failed to load categories' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = getSessionToken();
  const payload = await request.json();

  const response = await fetch(`${API_BASE_URL}/admin/categories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json();
  return NextResponse.json(body, { status: response.status });
}
