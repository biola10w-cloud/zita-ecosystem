import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../../../lib/api';
import { getSessionToken } from '../../../../../lib/auth';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const token = getSessionToken();

  const response = await fetch(`${API_BASE_URL}/admin/books/${params.id}/publish`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await response.json();
  return NextResponse.json(body, { status: response.status });
}
