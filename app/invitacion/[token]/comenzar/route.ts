import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { INVITE_COOKIE, applyInviteToken, resolveInviteToken } from "@/lib/invites";
import { createSupabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * CTA "Comenzar" de la invitación (/invitacion/<token>).
 *
 *   - Visitante sin sesión: guarda el token en una cookie y lo manda al
 *     login. Tras autenticarse, /auth/callback lee la cookie, lo
 *     incorpora a la localidad y lo lleva al asistente de bienvenida.
 *   - Sesión sin localidad (se logueó antes pero nunca eligió): aplica
 *     la invitación acá mismo y va directo al asistente.
 *   - Sesión con localidad: no lo movemos — la página de invitación ya
 *     le mostró sus opciones; esto es solo red de seguridad.
 */
export async function GET(
  request: Request,
  { params }: { params: { token: string } }
) {
  const url = new URL(request.url);
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login?error=no-supabase", url.origin));
  }

  const invite = await resolveInviteToken(params.token);
  if (!invite) {
    // La landing muestra el mensaje de link inválido.
    return NextResponse.redirect(
      new URL(`/invitacion/${encodeURIComponent(params.token)}`, url.origin)
    );
  }

  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const result = await applyInviteToken(user.id, params.token);
    if (result === "applied") {
      revalidatePath("/", "layout");
      return NextResponse.redirect(new URL("/bienvenida", url.origin));
    }
    // already-member / other-locality: a la app (o su perfil) sin tocar nada.
    return NextResponse.redirect(new URL("/", url.origin));
  }

  const response = NextResponse.redirect(
    new URL(`/login?next=${encodeURIComponent("/bienvenida")}`, url.origin)
  );
  response.cookies.set(INVITE_COOKIE, params.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    path: "/",
    maxAge: 60 * 60, // 1 hora: suficiente para completar el login
  });
  return response;
}
