import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component — Next.js cookies are read-only
            // there. Auth still works via middleware-refreshed cookies.
          }
        },
      },
    }
  );
}

/**
 * Cliente anónimo SIN cookies. Existe por una restricción concreta:
 * dentro de unstable_cache no se puede llamar a cookies() —la función
 * cacheada no puede depender del request— así que createSupabaseServer()
 * no sirve ahí.
 *
 * ⚠️ Úsalo SOLO para tablas cuya policy de lectura sea `using (true)`,
 * o sea, datos que cualquiera puede leer igual (hoy: `localities`, ver
 * migración 012). Para cualquier cosa filtrada por RLS este cliente no
 * ve nada, y para saltear la RLS está createSupabaseAdmin(), que es otra
 * decisión y se toma aparte.
 */
export function createSupabaseAnonNoCookies() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
