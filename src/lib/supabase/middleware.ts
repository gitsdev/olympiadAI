import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/safe-redirect";
import { getMaintenanceStateCached, isMaintenanceExempt } from "@/lib/maintenance";

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

  // Maintenance mode — everyone except platform admins is sent to
  // /maintenance (pages) or gets a 503 (API). Toggled from /admin/dashboard.
  if (!isMaintenanceExempt(pathname)) {
    const maintenance = await getMaintenanceStateCached(supabase);
    if (maintenance.enabled) {
      let admin = false;
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
        admin = (profile as { role?: string } | null)?.role === "platform_admin";
      }
      if (!admin) {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json(
            { error: "OlympiadIQ is under maintenance. Please try again shortly." },
            { status: 503, headers: { "Retry-After": "600" } },
          );
        }
        const url = request.nextUrl.clone();
        url.pathname = "/maintenance";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
  }

  // Public routes that don't need auth
  const PUBLIC = [
    "/", "/start", "/login", "/signup", "/signup/confirm", "/onboarding", "/auth/callback", "/auth/confirm",
    "/forgot-password", "/reset-password", "/privacy", "/unsubscribe", "/maintenance",
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
    // Remember where they were going, so login can send them back there.
    const next = safeNextPath(`${pathname}${request.nextUrl.search}`);
    url.search = next ? `?next=${encodeURIComponent(next)}` : "";
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
    const next = safeNextPath(request.nextUrl.searchParams.get("next"));
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(next ? new URL(next, request.nextUrl.origin) : url);
  }

  return supabaseResponse;
}
