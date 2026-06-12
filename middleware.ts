import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

// Must match basePath in next.config.mjs — keep in sync if changed
const BASE_PATH = "/prospecting-os";

export async function middleware(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  // Always sanitize x-user-* headers — never trust client-supplied values
  requestHeaders.delete("x-user-id");
  requestHeaders.delete("x-user-email");
  requestHeaders.delete("x-user-name");
  requestHeaders.delete("x-user-role");
  requestHeaders.delete("x-user-avatar");

  const path = req.nextUrl.pathname;

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/rest\/v1\/?$/, "");

  const supabaseAdmin = createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Collect cookies set by supabase.auth.getUser() (session refresh).
  // We apply them to `res` after creating it — NextResponse.next() copies
  // request headers at call time, so we must defer creation until ALL
  // requestHeaders.set() calls are done, otherwise x-user-* headers are lost.
  type CookieEntry = { name: string; value: string; options?: Record<string, unknown> };
  const pendingCookies: CookieEntry[] = [];

  const supabase = createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(c => pendingCookies.push(c as CookieEntry));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  let role: string | null = null;
  let avatarUrl: string | null = null;

  if (user) {
    try {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("id, email, display_name, role, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profile) {
        requestHeaders.set("x-user-id", user.id);
        requestHeaders.set("x-user-email", user.email || "");
        requestHeaders.set("x-user-name", user.user_metadata?.display_name || user.user_metadata?.full_name || "");
        requestHeaders.set("x-user-role", user.user_metadata?.role || "user");
        role = user.user_metadata?.role || "user";
      } else {
        requestHeaders.set("x-user-id", profile.id);
        requestHeaders.set("x-user-email", profile.email || "");
        requestHeaders.set("x-user-name", profile.display_name || "");
        requestHeaders.set("x-user-role", profile.role || "user");
        role = profile.role || "user";
        avatarUrl = profile.avatar_url || null;
      }
    } catch {
      requestHeaders.set("x-user-id", user.id);
      requestHeaders.set("x-user-email", user.email || "");
      requestHeaders.set("x-user-name", user.user_metadata?.display_name || user.user_metadata?.full_name || "");
      requestHeaders.set("x-user-role", user.user_metadata?.role || "user");
      role = user.user_metadata?.role || "user";
    }
  }

  // Create res AFTER all requestHeaders.set() calls — ensures x-user-* headers
  // are captured in the copy that NextResponse.next() takes at this point.
  const res = NextResponse.next({ request: { headers: requestHeaders } });

  // Apply any session cookies refreshed by supabase.auth.getUser()
  pendingCookies.forEach(({ name, value, options }) =>
    res.cookies.set(name, value, options as Parameters<typeof res.cookies.set>[2])
  );

  if (avatarUrl) res.headers.set("x-user-avatar", avatarUrl);

  // Strip basePath for route matching
  let normalizedPath = path;
  if (normalizedPath.startsWith(BASE_PATH)) {
    normalizedPath = normalizedPath.slice(BASE_PATH.length) || "/";
  }

  // NOTE: Add new public routes here when they are added to the app.
  // The middleware matcher pattern (at bottom of file) is a coarse filter;
  // this list determines which paths skip auth/subscription checks.
  const publicRoutes = [
    "/",
    "/about",
    "/book",
    "/book/admin",
    "/login",
    "/signup",
    "/onboarding",
    "/checkout",
    "/tools",
    "/progress",
    "/integrations",
    "/blog",
    "/privacy",
    "/terms",
    "/refund-policy",
    "/contact",
  ];

  const isPublicRoute = publicRoutes.some((route) => {
    if (route === "/" && normalizedPath === "/") return true;
    return normalizedPath === route || normalizedPath.startsWith(route + "/");
  });

  const isStaticAsset = /\.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot|map)$/.test(path);
  const isApiRoute = normalizedPath.startsWith("/api/");
  const isClientPortalLogin = normalizedPath === "/client-portal/login";

  // ─── Role-based routing (fail-closed: missing role defaults to "user") ─────

  if (user) {
    const effectiveRole = role || "user";
    const isAdminPath = normalizedPath === "/admin" || normalizedPath.startsWith("/admin/");

    // ── Admin routes: super_admin only, bypass ALL further checks ──
    // QA agents get full access including admin — must check BEFORE super_admin gate
    if (effectiveRole === "qa_agent") {
      // Full access — no redirects. QA agent can visit any route.
    } else if (isAdminPath) {
      if (effectiveRole !== "super_admin") {
        return NextResponse.redirect(new URL(BASE_PATH + "/login", req.url));
      }
      // Super admin on admin routes — allow immediately, skip subscription + all other checks
      return res;
    }
  }

  // ─── Subscription enforcement ──────────────────────────────────

  const paidRoutes = ["/admin"];

  const isPaidRoute = paidRoutes.some(p =>
    normalizedPath === p || normalizedPath.startsWith(p + "/")
  );

  if (user && isPaidRoute) {
    const graceRoutes = ["/onboarding", "/checkout", "/book"];
    const isGrace = graceRoutes.some(r =>
      normalizedPath === r || normalizedPath.startsWith(r + "/")
    );
    // super_admin and qa_agent bypass subscription enforcement
    const isPrivilegedRole = role === "super_admin" || role === "qa_agent";

    if (!isGrace && !isPrivilegedRole) {
      try {
        const { data: sub } = await supabaseAdmin
          .from("profiles")
          .select("subscription_status")
          .eq("id", user.id)
          .maybeSingle();

        if (!sub || sub.subscription_status !== "active") {
          return NextResponse.redirect(new URL(BASE_PATH + "/checkout", req.url));
        }
      } catch (e) {
        // Fail closed — DB error means we can't verify subscription
        console.error("Subscription check failed, redirecting to checkout:", e);
        return NextResponse.redirect(new URL(BASE_PATH + "/checkout", req.url));
      }
    }
  }

  // ─── Public/auth route handling ──────────────────────────────────
  // Login rate limiting: deferred to platform WAF (Vercel + Cloudflare).
  // Browser calls Supabase signInWithPassword directly, so no server hop
  // exists to throttle. To enforce in-app, add /api/auth/login proxy that
  // rate-limits per IP and delegates to Supabase, then point the login
  // forms at it instead of calling supabase.auth directly.

  if (isPublicRoute || isStaticAsset || isApiRoute || isClientPortalLogin) {
    if (user && (normalizedPath === "/login" || normalizedPath === "/signup" || normalizedPath === "/client-portal/login")) {
      // Route to appropriate destination based on role
      let dest = "/dashboard";
      if (role === "client") dest = "/client-portal";
      else if (role === "super_admin") dest = "/admin";
      return NextResponse.redirect(new URL(BASE_PATH + dest, req.url));
    }
    return res;
  }

  // ─── Protect admin routes ─────────────────────────────────────────

  const protectedPrefixes = ["/admin", "/client-portal"];

  const isProtected = protectedPrefixes.some((prefix) =>
    normalizedPath === prefix || normalizedPath.startsWith(prefix + "/")
  );

  if (isProtected && !user) {
    // Route client-portal visitors to the client portal login page
    const isClientPortal = normalizedPath.startsWith("/client-portal");
    const loginPath = isClientPortal ? "/client-portal/login" : "/login";
    const loginUrl = new URL(BASE_PATH + loginPath, req.url);
    loginUrl.searchParams.set("redirect", normalizedPath);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: ["/((?!api/chat|api/contact|api/agent/telegram|_next/static|_next/image|_next/data|favicon.ico).*)"],
};
