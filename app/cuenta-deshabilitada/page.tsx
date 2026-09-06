import { redirect } from "next/navigation";
import { BahaiStar } from "@/components/BahaiStar";
import { createSupabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Pantalla de aviso para miembros deshabilitados por la Asamblea.
 * El middleware redirige acá cualquier navegación de un perfil con
 * `disabled_at` seteado. Si el perfil resulta estar activo, lo devolvemos
 * a la app (evita que un miembro reactivado quede atrapado en esta vista).
 */
export default async function CuentaDeshabilitadaPage() {
  if (!isSupabaseConfigured()) {
    redirect("/login");
  }

  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("disabled_at")
    .eq("id", user.id)
    .maybeSingle();

  // Ya no está deshabilitado (o no tiene perfil): que siga su camino normal.
  if (!profile?.disabled_at) {
    redirect("/");
  }

  return (
    <div className="relative flex min-h-[calc(100dvh/var(--ui-zoom,1))] flex-col overflow-hidden bg-gold-grad">
      <div className="pointer-events-none absolute -right-20 -top-24 opacity-[0.07]">
        <BahaiStar size={300} color="#fff" />
      </div>
      <div className="pointer-events-none absolute -bottom-28 -left-24 opacity-[0.06]">
        <BahaiStar size={340} color="#fff" />
      </div>

      <main className="relative flex flex-1 flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
              <BahaiStar size={36} color="#fff" />
            </div>
            <h1 className="font-display text-[28px] font-bold leading-tight text-white">
              Tu acceso está deshabilitado
            </h1>
          </div>

          <div className="rounded-3xl bg-card p-6 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.35)] md:p-8">
            <p className="text-[14px] leading-relaxed text-dark">
              La Asamblea Espiritual Local desactivó temporalmente tu acceso a
              la aplicación de la comunidad.
            </p>
            <p className="mt-3 text-[14px] leading-relaxed text-muted">
              Si creés que es un error o querés volver a ingresar, ponete en
              contacto con la Secretaría de tu Asamblea.
            </p>

            <form action="/auth/signout" method="post" className="mt-6">
              <button
                type="submit"
                className="w-full rounded-xl bg-terra px-4 py-2.5 text-[14px] font-semibold text-white shadow-card-soft"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
