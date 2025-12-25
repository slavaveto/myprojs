import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher(['/admin(.*)']);
const isLoginPage = createRouteMatcher(['/admin/auth/login']);
const isSignUpPage = createRouteMatcher(['/admin/auth/signup']);
const isLobbyPage = createRouteMatcher(['/admin/lobby(.*)']);

export default clerkMiddleware(async (auth, req) => {
  // 1. Защита роутов
  if (isProtectedRoute(req) && !isLoginPage(req) && !isSignUpPage(req)) {
     const { userId } = await auth();
     if (!userId) {
        return NextResponse.redirect(new URL('/admin/auth/login', req.url));
     }
  }

  const url = req.nextUrl;
  let hostname = req.headers.get("host")!;
  const searchParams = req.nextUrl.searchParams.toString();
  const path = `${url.pathname}${searchParams.length > 0 ? `?${searchParams}` : ""}`;

  // === SUBDOMAIN LOGIC ===
  
  // 1. Admin -> Rewrite to /admin
  if (hostname.startsWith('admin.')) {
     if (!url.pathname.startsWith('/admin')) {
        return NextResponse.rewrite(new URL(`/admin${path === '/' ? '' : path}`, req.url));
     }
  }

  // 2. Client Subdomains -> Pass via Header
  const response = NextResponse.next();
  
  const isLocalhost = hostname.includes('localhost');
  const domainParts = hostname.split('.');
  let subdomain = '';

  if (isLocalhost) {
      // sub.localhost:3000
      if (domainParts.length > 1 && domainParts[0] !== 'www' && domainParts[0] !== 'admin') {
          subdomain = domainParts[0];
      }
  } else {
      // sub.domain.com
      if (domainParts.length > 2 && domainParts[0] !== 'www' && domainParts[0] !== 'admin') {
          subdomain = domainParts[0];
      }
  }

  if (subdomain) {
      response.headers.set('x-subdomain', subdomain);
  }

  response.headers.set('x-pathname', req.nextUrl.pathname);
  return response;
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/((?!api/webhooks)(?:api|trpc).*)',
  ],
};
