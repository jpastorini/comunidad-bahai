import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Magic-link callback. Supabase redirects here with `?code=...`; we exchange
 * it for a session and forward to:
 *   1. /seleccionar-localidad si el usuario no tiene locality_id (primer login)
 *   2. El path explícito en `?next=...` si fue dado
 *   3. /admin si el usuario es admin
 *   4. / si es miembro normal
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");

  if (code) {
    const supabase = createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, locality_id")
          .eq("id", user.id)
          .maybeSingle();

        // Sin localidad → selección obligatoria antes de ir a cualquier lado.
        if (profile && !profile.locality_id) {
          const next = nextParam ?? (profile.role === "admin" ? "/admin" : "/");
          return NextResponse.redirect(
            new URL(
              `/seleccionar-localidad?next=${encodeURIComponent(next)}`,
              url.origin
            )
          );
        }

        // Honor explicit `next` si fue dado.
        if (nextParam && nextParam.startsWith("/")) {
          return NextResponse.redirect(new URL(nextParam, url.origin));
        }
        // Default por rol.
        const target = profile?.role === "admin" ? "/admin" : "/";
        return NextResponse.redirect(new URL(target, url.origin));
      }
      return NextResponse.redirect(new URL("/", url.origin));
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=callback-failed", url.origin)
  );
}
