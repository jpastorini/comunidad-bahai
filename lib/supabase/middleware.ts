import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the user's Supabase session on every request, rewrites
 * cookies onto the outgoing response, and — when authenticated —
 * injects the user profile as a *request* header (`x-profile`) so that
 * Server Components can read it via headers() without making duplicate
 * Supabase queries (saving 2-3 round-trips per page navigation).
 *
 * BEFORE: middleware(getUser) → page(getUser + profiles + localities)
 *         = 4 sequential Supabase calls per navigation
 * AFTER:  middleware(getUser + profiles) → page(reads header + 1 locality query)
 *         = 2 sequential Supabase calls per navigation
 *
 * IMPORTANTE: los headers se inyectan en el REQUEST (vía
 * NextResponse.next({ request: { headers } })), no en la respuesta, por
 * dos motivos:
 *   1. headers() en Server Components lee los headers del request; los de
 *      la respuesta no llegan al contexto RSC.
 *   2. evita filtrar el perfil completo al navegador como header de salida.
 * Además se borran los x-profile/x-user-* entrantes para que un cliente
 * no pueda spoofear su identidad.
 */
export async function updateSession(request: NextRequest) {
  // Clonamos los headers entrantes y limpiamos cualquier intento de
  // spoofing: solo el middleware puede setear estos headers.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-user-id");
  requestHeaders.delete("x-user-email");
  requestHeaders.delete("x-profile");

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

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
        supabaseResponse = NextResponse.next({
          request: { headers: requestHeaders },
        });
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
      // Puerta única: el login es /login. Guardamos el destino en `next`
      // para volver al panel tras autenticarse.
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", path);
      return NextResponse.redirect(loginUrl);
    }
    return supabaseResponse;
  }

  // ── Con sesión: cargar perfil y propagarlo vía request headers ─
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) {
    // Los Server Components leen estos headers con headers().get()
    // y evitan repetir auth.getUser() + profiles query.
    requestHeaders.set("x-user-id", user.id);
    requestHeaders.set("x-user-email", user.email ?? "");
    requestHeaders.set("x-profile", JSON.stringify(profile));

    // Reconstruimos la respuesta para que los headers actualizados del
    // request lleguen al RSC, preservando las cookies ya encoladas.
    const responseWithProfile = NextResponse.next({
      request: { headers: requestHeaders },
    });
    supabaseResponse.cookies.getAll().forEach((cookie) =>
      responseWithProfile.cookies.set(cookie)
    );
    supabaseResponse = responseWithProfile;
  }

  // ── Miembro deshabilitado: corte de acceso ─────────────────────
  // Si la Asamblea desactivó este perfil, lo mandamos a la pantalla de
  // aviso y bloqueamos todo lo demás. Dejamos pasar solo esa página y el
  // cierre de sesión, para que pueda salir.
  if (profile?.disabled_at) {
    const disabledPage = "/cuenta-deshabilitada";
    if (path !== disabledPage && path !== "/auth/signout") {
      return NextResponse.redirect(new URL(disabledPage, request.url));
    }
    return supabaseResponse;
  }

  // ── Protección de rutas /admin/* ───────────────────────────────
  if (isAdminRoute) {
    // Excepción acotada: un editor designado del Boletín local
    // (can_manage_bulletin) puede entrar SOLO a /admin/boletin aunque
    // no sea admin de Asamblea.
    const isBulletinEditorAllowed =
      path.startsWith("/admin/boletin") && profile?.can_manage_bulletin;
    if ((!profile || profile.role !== "admin") && !isBulletinEditorAllowed) {
      // Ya está logueado pero no es admin: lo mandamos a su app de
      // comunidad en vez de a una pantalla de login confusa.
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return supabaseResponse;
}
