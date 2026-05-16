import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const path = req.nextUrl.pathname;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
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

  if (user) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, avatar_url")
        .eq("id", user.id)
        .single();

      if (profile) {
        res.headers.set("x-user-id", profile.id);
        res.headers.set("x-user-email", profile.email || "");
        res.headers.set("x-user-name", profile.full_name || "");
        res.headers.set("x-user-role", profile.role || "user");
        if (profile.avatar_url) {
          res.headers.set("x-user-avatar", profile.avatar_url);
        }
      }
    } catch {
      res.headers.set("x-user-id", user.id);
      res.headers.set("x-user-email", user.email || "");
      res.headers.set("x-user-name", user.user_metadata?.full_name || "");
      res.headers.set("x-user-role", user.user_metadata?.role || "user");
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
  ];

  const isPublicRoute = publicRoutes.some((route) => {
    if (route === "/" && normalizedPath === "/") return true;
    return normalizedPath === route || normalizedPath.startsWith(route + "/");
  });

  const isStaticAsset = /\.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot|map)$/.test(path);
  const isApiRoute = normalizedPath.startsWith("/api/");
  const isPortalRoute = normalizedPath.startsWith("/portal/");

  if (isPublicRoute || isStaticAsset || isApiRoute || isPortalRoute) {
    if (user && (normalizedPath === "/login" || normalizedPath === "/signup")) {
      return NextResponse.redirect(new URL(basePath + "/dashboard", req.url));
    }
    return res;
  }

  // Protect all other routes
  const protectedPrefixes = [
    "/dashboard", "/leads", "/message-lab", "/scorer",
    "/sequences", "/kanban", "/analytics", "/clients",
    "/outreach", "/settings",
  ];

  const isProtected = protectedPrefixes.some((prefix) =>
    normalizedPath === prefix || normalizedPath.startsWith(prefix + "/")
  );

  if (isProtected && !user) {
    const loginUrl = new URL(basePath + "/login", req.url);
    loginUrl.searchParams.set("redirect", normalizedPath);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: ["/((?!api/chat|api/contact|api/agent/telegram|_next/static|_next/image|favicon.ico).*)"],
};
