import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher(['/admin(.*)']);
const isLoginPage = createRouteMatcher(['/admin/auth/login']);
const isSignUpPage = createRouteMatcher(['/admin/auth/signup']);

export default clerkMiddleware(async (auth, req) => {
  // 1. Защита роутов админки
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

  // === АДМИНКА ===
  // Если зашли на admin.domain.com -> рерайт на /admin
  if (hostname.startsWith('admin.')) {
     if (!url.pathname.startsWith('/admin')) {
        return NextResponse.rewrite(new URL(`/admin${path === '/' ? '' : path}`, req.url));
     }
  }

  // === ГЛАВНАЯ ===
  // Больше никакой логики субдоменов. Просто отдаем то, что есть.

  const response = NextResponse.next();
  response.headers.set('x-pathname', req.nextUrl.pathname);
  return response;
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/((?!api/webhooks)(?:api|trpc).*)',
  ],
};
