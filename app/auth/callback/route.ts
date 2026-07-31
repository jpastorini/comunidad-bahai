import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { INVITE_COOKIE, applyInviteToken } from "@/lib/invites";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Magic-link / OAuth callback. Supabase redirects here con `?code=...`;
 * intercambiamos el code por sesión y reenviamos a:
 *   1. /bienvenida si venía de un link de invitación (cookie cb_invite):
 *      se lo incorpora a la localidad del link y arranca el asistente.
 *   2. /seleccionar-localidad si el usuario no tiene locality_id (primer login)
 *   3. El path explícito en `?next=...` si fue dado (deep-link, ej. /admin)
 *   4. / en cualquier otro caso — TODOS aterrizan en la app de comunidad,
 *      incluidos los admins. Al panel se entra a propósito desde el perfil,
 *      no por rol. Esto evita rebotes confusos y unifica la puerta de entrada.
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

        // Sin localidad → ¿venía invitado? La cookie del link de
        // invitación lo incorpora directo y arranca el asistente.
        if (profile && !profile.locality_id) {
          const inviteToken = cookies().get(INVITE_COOKIE)?.value;
          if (inviteToken) {
            const result = await applyInviteToken(user.id, inviteToken);
            if (result === "applied") {
              revalidatePath("/", "layout");
              const response = NextResponse.redirect(
                new URL("/bienvenida", url.origin)
              );
              response.cookies.delete(INVITE_COOKIE);
              return response;
            }
          }

          // Sin invitación → selección obligatoria antes de ir a cualquier lado.
          const next = nextParam ?? "/";
          return NextResponse.redirect(
            new URL(
              `/seleccionar-localidad?next=${encodeURIComponent(next)}`,
              url.origin
            )
          );
        }

        // Honor explicit `next` si fue dado (ej. deep-link a /admin/...).
        if (nextParam && nextParam.startsWith("/")) {
          return NextResponse.redirect(new URL(nextParam, url.origin));
        }
        // Default: todos a la app de comunidad. El admin entra al panel
        // desde el perfil, no automáticamente por su rol.
        return NextResponse.redirect(new URL("/", url.origin));
      }
      return NextResponse.redirect(new URL("/", url.origin));
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=callback-failed", url.origin)
  );
}
