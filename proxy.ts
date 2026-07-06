// Next.js 16: proxy.ts replaces middleware.ts
// Runs on Node.js runtime only (no Edge) — safe for pg/NextAuth DB adapter
import { auth } from "@/auth";
import { pool } from "@/lib/db";

export const proxy = auth(async (req) => {
  const isLoggedIn = !!req.auth;
  const pathname = req.nextUrl.pathname;

  // Never block API routes — they handle their own auth
  if (pathname.startsWith("/api/")) return;

  const allProtected = ["/inbox", "/settings", "/onboarding"];
  const isProtected = allProtected.some((r) => pathname.startsWith(r));

  if (isProtected && !isLoggedIn) {
    return Response.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn) {
    const userId = req.auth?.user?.id;
    let onboardingCompleted = req.auth?.user?.onboardingCompleted;

    if (userId) {
      const { rows } = await pool.query<{ onboarding_completed: boolean }>(
        `SELECT onboarding_completed FROM users WHERE id = $1`,
        [userId],
      );
      onboardingCompleted = rows[0]?.onboarding_completed ?? false;
    }

    // Redirect to onboarding if setup is not done
    if (
      !onboardingCompleted &&
      (pathname.startsWith("/inbox") || pathname.startsWith("/settings"))
    ) {
      return Response.redirect(new URL("/onboarding", req.url));
    }

    // Redirect away from onboarding if already completed
    if (onboardingCompleted && pathname.startsWith("/onboarding")) {
      return Response.redirect(new URL("/inbox", req.url));
    }
  }
});

export const config = {
  matcher: ["/inbox/:path*", "/settings/:path*", "/onboarding/:path*"],
};
