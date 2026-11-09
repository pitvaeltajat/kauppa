import { NextResponse, type NextRequest } from 'next/server';

// "Kesken": only superadmins reach the app. The gate itself lives in the root
// layout (app/layout.tsx) because it needs a database lookup. Kontti's own
// User.role, not the session token, since a shared .pitva.fi cookie minted by
// another pitva app carries that app's claims. The edge can't touch the DB, so
// middleware only forwards the request path for the layout to gate on. To
// reopen the shop to the public, delete this file and the gate in app/layout.tsx.
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set('x-pathname', request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Pages only. Skip API routes (they enforce their own auth), Next internals,
  // and static assets.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
