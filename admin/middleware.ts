import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'zita_admin_session';

export function middleware(request: NextRequest) {
  // A refresh cookie cannot authorize dashboard requests. Once the access
  // cookie expires, let the user sign in instead of rendering an unauthorized
  // dashboard (and redirecting them away from the login page).
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
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
