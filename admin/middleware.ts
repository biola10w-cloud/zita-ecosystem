import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'zita_admin_session';
const REFRESH_COOKIE = 'zita_admin_refresh';

export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE) || request.cookies.has(REFRESH_COOKIE);
  const isLoginPage = request.nextUrl.pathname.startsWith('/login');
  const isAuthApi = request.nextUrl.pathname.startsWith('/api/auth');

  if (!hasSession && !isLoginPage && !isAuthApi) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && isLoginPage) {
    return NextResponse.redirect(new URL('/books', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
