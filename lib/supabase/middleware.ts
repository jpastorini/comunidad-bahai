import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the user's Supabase session on every request, rewrites
 * cookies onto the outgoing response, and — when authenticated —
 * injects the user profile as a *request* header (`x-profile`) so that
 * Server Components can read it via headers() without making duplicate
 * Supabase queries (saving 2-3 round-trips per page navigation).
 *
 * Costo en llamadas de red a Supabase, por navegación:
 *   Original:  middleware(getUser) → page(getUser + profiles + localities)
 *              = 4 idas y vueltas EN SERIE.
 *   Con header: middleware(getUser + profiles) → page(1 query de localidad)
 *              = 3 en serie.
 *   Hoy:       middleware(getClaims + profiles) → page(localidad cacheada)
 *              = 1 en serie. getClaims valida la firma en el proceso y la
 *              localidad sale del Data Cache (ver lib/auth.ts).
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

  // Verifica la sesión SIN salir a la red.
  //
  // getUser() hacía una llamada HTTP al Auth de Supabase en CADA request
  // (incluidos los prefetch de la TabBar): un ida y vuelta completo que se
  // pagaba antes de empezar a renderizar. getClaims() hace lo mismo pero:
  //   1. lee el token de la cookie (sin red),
  //   2. lo refresca solo si está por vencer (ahí sí, una vez por hora),
  //   3. valida la FIRMA localmente con WebCrypto contra el JWKS público
  //      del proyecto, que la librería cachea 10 min en un global del
  //      isolate (y Supabase además lo sirve desde su edge).
  //
  // La garantía es la misma que la de getUser(): un token con firma
  // inválida no pasa. ⚠️ Requiere que el proyecto firme con clave
  // asimétrica (ES256/RS256, Settings → JWT Keys). Si volviera al secreto
  // HS256 legacy, la librería cae sola a getUser() y quedamos como antes:
  // más lento, nunca inseguro.
  // El try/catch no es decorativo: getClaims() relanza lo que no sea un
  // AuthError, y esto corre en el middleware, o sea en TODAS las rutas.
  // Una excepción acá sería un 500 en la app entera. Degradar a "sin
  // sesión" deja al creyente en el login, que es lo mismo que hacía el
  // getUser() anterior ante un fallo de red.
  let claims: Record<string, unknown> | null = null;
  try {
    const { data } = await supabase.auth.getClaims();
    claims = (data?.claims as Record<string, unknown> | undefined) ?? null;
  } catch (err) {
    console.error("[middleware] getClaims falló:", err);
  }

  const sub = typeof claims?.sub === "string" ? claims.sub : null;
  const user = sub
    ? {
        id: sub,
        email: typeof claims?.email === "string" ? claims.email : "",
      }
    : null;

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
    requestHeaders.set("x-user-email", user.email);
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
