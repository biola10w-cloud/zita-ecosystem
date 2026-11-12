import { NextRequest } from 'next/server';
import { authenticate } from '../../../../lib/auth-handler';
export async function POST(request: NextRequest) { return authenticate(request, 'register'); }
