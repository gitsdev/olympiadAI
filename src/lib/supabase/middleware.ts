import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — required for Server Components to read auth state
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes that don't need auth
  const PUBLIC = [
    "/", "/start", "/login", "/signup", "/signup/confirm", "/onboarding", "/auth/callback", "/auth/confirm",
    "/forgot-password", "/reset-password", "/privacy", "/unsubscribe",
  ];
  const isPublic = PUBLIC.some((p) => pathname === p)
    || pathname.startsWith("/api/")
    || pathname.startsWith("/brain-booster")
    || pathname === "/blog"
    || pathname.startsWith("/blog/")
    // "/learn/" (trailing slash) only — bare "/learn" is the authenticated
    // knowledge-graph dashboard and stays gated; "/learn/<slug>" is the
    // public topic-page route.
    || pathname.startsWith("/learn/");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Email OTP gate — signed-in users who haven't verified their email can
  // only reach /verify-email (plus public pages). Mirrors
  // isEmailOtpPending() in src/lib/email-verification.ts, inlined because
  // that module is server-only (node:crypto, service role).
  const otpPending = user?.app_metadata?.email_otp_pending === true;
  if (otpPending) {
    if (pathname.startsWith("/api/") && pathname !== "/api/unsubscribe") {
      return NextResponse.json({ error: "Please verify your email first." }, { status: 403 });
    }
    const gated = (!isPublic || pathname === "/onboarding" || pathname === "/login") && pathname !== "/verify-email";
    if (gated) {
      const url = request.nextUrl.clone();
      url.pathname = "/verify-email";
      url.search = "";
      return NextResponse.redirect(url);
    }
  } else if (user && pathname === "/verify-email") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Redirect logged-in users away from login/onboarding
  if (user && (pathname === "/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
