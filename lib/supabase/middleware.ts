import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the user's Supabase session on every request, rewrites
 * cookies onto the outgoing response, and — when authenticated —
 * injects the user profile as a request header (`x-profile`) so that
 * Server Components can read it without making duplicate Supabase
 * queries (saving 2-3 round-trips per page navigation).
 *
 * BEFORE: middleware(getUser) → page(getUser + profiles + localities)
 *         = 4 sequential Supabase calls per navigation
 * AFTER:  middleware(getUser + profiles) → page(reads header + 1 locality query)
 *         = 2 sequential Supabase calls per navigation
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // App de miembros corre sin Supabase; no hay sesión que refrescar.
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresca el token si está cerca de expirar.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAdminRoute = path.startsWith("/admin") && path !== "/admin/login";

  // ── Sin sesión ─────────────────────────────────────────────────
  if (!user) {
    if (isAdminRoute) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("redirectTo", path);
      return NextResponse.redirect(loginUrl);
    }
    return supabaseResponse;
  }

  // ── Con sesión: cargar perfil y propagarlo vía headers ─────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) {
    // Los Server Components leen estos headers con headers().get()
    // y evitan repetir auth.getUser() + profiles query.
    supabaseResponse.headers.set("x-user-id", user.id);
    supabaseResponse.headers.set("x-user-email", user.email ?? "");
    supabaseResponse.headers.set("x-profile", JSON.stringify(profile));
  }

  // ── Protección de rutas /admin/* ───────────────────────────────
  if (isAdminRoute) {
    if (!profile || profile.role !== "admin") {
      const redirectUrl = new URL("/admin/login", request.url);
      redirectUrl.searchParams.set("error", "not-admin");
      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}
