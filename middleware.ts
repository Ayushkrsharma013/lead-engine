import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  const path = req.nextUrl.pathname;

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/rest\/v1\/?$/, "");
  const supabase = createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  let role: string | null = null;

  if (user) {
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profile) {
        // Profile query failed or no row — fall back to user metadata
        requestHeaders.set("x-user-id", user.id);
        requestHeaders.set("x-user-email", user.email || "");
        requestHeaders.set("x-user-name", user.user_metadata?.full_name || "");
        requestHeaders.set("x-user-role", user.user_metadata?.role || "user");
        role = user.user_metadata?.role || "user";
      } else {
        requestHeaders.set("x-user-id", profile.id);
        requestHeaders.set("x-user-email", profile.email || "");
        requestHeaders.set("x-user-name", profile.full_name || "");
        requestHeaders.set("x-user-role", profile.role || "user");
        if (profile.avatar_url) {
          res.headers.set("x-user-avatar", profile.avatar_url);
        }
        role = profile.role || "user";
      }
    } catch {
      requestHeaders.set("x-user-id", user.id);
      requestHeaders.set("x-user-email", user.email || "");
      requestHeaders.set("x-user-name", user.user_metadata?.full_name || "");
      requestHeaders.set("x-user-role", user.user_metadata?.role || "user");
      role = user.user_metadata?.role || "user";
    }
  }

  // Strip basePath for route matching
  const basePath = "/prospecting-os";
  let normalizedPath = path;
  if (normalizedPath.startsWith(basePath)) {
    normalizedPath = normalizedPath.slice(basePath.length) || "/";
  }

  const publicRoutes = [
    "/",
    "/book",
    "/book/admin",
    "/login",
    "/signup",
    "/onboarding",
    "/checkout",
    "/tools",
    "/progress",
    "/integrations",
  ];

  const isPublicRoute = publicRoutes.some((route) => {
    if (route === "/" && normalizedPath === "/") return true;
    return normalizedPath === route || normalizedPath.startsWith(route + "/");
  });

  const isStaticAsset = /\.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot|map)$/.test(path);
  const isApiRoute = normalizedPath.startsWith("/api/");
  const isClientPortalLogin = normalizedPath === "/client-portal/login";

  // ─── Role-based routing ──────────────────────────────────────────

  if (user && role) {
    const superAdminOnly = ["/admin", "/clients", "/outreach", "/settings"];
    const clientPortalBase = "/client-portal";
    const sharedAdmin = ["/dashboard", "/leads", "/message-lab", "/scorer", "/sequences", "/kanban", "/analytics"];
    const adminAgentPaths = [...superAdminOnly, ...sharedAdmin];

    const isSuperAdminPath = superAdminOnly.some(p =>
      normalizedPath === p || normalizedPath.startsWith(p + "/")
    );
    const isAdminAgentPath = adminAgentPaths.some(p =>
      normalizedPath === p || normalizedPath.startsWith(p + "/")
    );
    const isClientPortalPath = normalizedPath.startsWith(clientPortalBase);

    if (role === "client") {
      // Block access to super_admin areas — redirect to client portal
      if (isSuperAdminPath || isAdminAgentPath) {
        return NextResponse.redirect(new URL(basePath + "/client-portal", req.url));
      }
    }

    if (role === "qa_agent") {
      // Full access — no redirects. QA agent can visit any route.
    }

    // super_admin on client-portal is fine (they can view what clients see)
  }

  // ─── Public/auth route handling ──────────────────────────────────

  if (isPublicRoute || isStaticAsset || isApiRoute || isClientPortalLogin) {
    if (user && (normalizedPath === "/login" || normalizedPath === "/signup" || normalizedPath === "/client-portal/login")) {
      // Route to appropriate destination based on role
      const dest = role === "client" ? "/client-portal" : "/dashboard";
      return NextResponse.redirect(new URL(basePath + dest, req.url));
    }
    return res;
  }

  // ─── Protect admin routes ─────────────────────────────────────────

  const protectedPrefixes = [
    "/dashboard", "/leads", "/message-lab", "/scorer",
    "/sequences", "/kanban", "/analytics", "/clients",
    "/outreach", "/settings", "/agent", "/admin", "/client-portal",
    "/invoice",
  ];

  const isProtected = protectedPrefixes.some((prefix) =>
    normalizedPath === prefix || normalizedPath.startsWith(prefix + "/")
  );

  if (isProtected && !user) {
    // Route client-portal visitors to the client portal login page
    const isClientPortal = normalizedPath.startsWith("/client-portal");
    const loginPath = isClientPortal ? "/client-portal/login" : "/login";
    const loginUrl = new URL(basePath + loginPath, req.url);
    loginUrl.searchParams.set("redirect", normalizedPath);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: ["/((?!api/chat|api/contact|api/agent/telegram|_next/static|_next/image|favicon.ico).*)"],
};
