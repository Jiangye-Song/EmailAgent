// Next.js 16: proxy.ts replaces middleware.ts
// Runs on Node.js runtime only (no Edge) — safe for pg/NextAuth DB adapter
import { auth } from "@/auth";

export const proxy = auth((req) => {
  const isLoggedIn = !!req.auth;
  const pathname = req.nextUrl.pathname;

  // Never block API routes — they handle their own auth
  if (pathname.startsWith("/api/")) return;

  const protectedRoutes = ["/inbox", "/settings", "/onboarding", "/opportunities", "/deals"];
  const isProtected = protectedRoutes.some((r) => pathname.startsWith(r));

  if (isProtected && !isLoggedIn) {
    return Response.redirect(new URL("/login", req.url));
  }
});

export const config = {
  // Only run the proxy on pages that need session protection.
  // API routes handle their own auth and must NOT be intercepted.
  matcher: ["/inbox/:path*", "/settings/:path*", "/onboarding/:path*", "/opportunities/:path*", "/deals/:path*"],
};
