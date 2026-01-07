import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher(['/admin(.*)']);
const isLoginPage = createRouteMatcher(['/admin/auth/login']);
const isSignUpPage = createRouteMatcher(['/admin/auth/signup']);
const isAppAuthPage = createRouteMatcher(['/auth(.*)', '/sso-callback']);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // 1. Защита роутов админки
  if (isProtectedRoute(req) && !isLoginPage(req) && !isSignUpPage(req)) {
     if (!userId) {
        return NextResponse.redirect(new URL('/admin/auth/login', req.url));
     }
  }

  // 2. Защита основного приложения
  // Если это не админка, не страницы авторизации и не API -> проверяем вход
  if (!isProtectedRoute(req) && !isAppAuthPage(req) && !req.nextUrl.pathname.startsWith('/api')) {
     if (!userId) {
        return NextResponse.redirect(new URL('/auth/login', req.url));
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
    // Explicitly exclude /worker/ and powersync-worker from middleware
    '/((?!_next|powersync-worker|worker|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|wasm)).*)',
    '/((?!api/webhooks)(?:api|trpc).*)',
  ],
};
