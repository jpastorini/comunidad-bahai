import { redirect } from "next/navigation";
import { BahaiStar } from "@/components/BahaiStar";
import { createSupabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { isNationalLocality, type Locality } from "@/lib/types";
import { selectLocalityAction } from "./actions";

export const revalidate = 60;

const ERROR_COPY: Record<string, string> = {
  missing:
    "La localidad anterior ya no existe. Elige una nueva para continuar.",
};

export default async function SeleccionarLocalidadPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string; change?: string };
}) {
  if (!isSupabaseConfigured()) {
    redirect("/login?error=no-supabase");
  }
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/seleccionar-localidad");
  }

  const { data: localities } = await supabase
    .from("localities")
    .select("*")
    .eq("is_active", true)
    .order("name");

  const { data: profile } = await supabase
    .from("profiles")
    .select("locality_id, role")
    .eq("id", user.id)
    .maybeSingle();

  const isChange = searchParams.change === "1";

  // Si ya tiene una solicitud pendiente, no puede pedir otra → al perfil.
  if (profile?.locality_id) {
    const { data: pending } = await supabase
      .from("locality_change_requests")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .maybeSingle();
    if (pending) {
      redirect("/perfil");
    }
  }

  // Si ya tiene localidad y no viene con error ni en modo cambio → no necesita estar acá.
  if (profile?.locality_id && !searchParams.error && !isChange) {
    redirect(searchParams.next ?? (profile.role === "admin" ? "/admin" : "/"));
  }

  const all = (localities ?? []) as Locality[];
  // La Comunidad Nacional (056) no va mezclada con las Asambleas
  // Locales: es una respuesta distinta —"no pertenezco a ninguna"— y
  // mezclarla haría que alguien la eligiera creyendo que es su ciudad.
  const list = all.filter((l) => !isNationalLocality(l));
  const national = all.find((l) => isNationalLocality(l)) ?? null;
  const error = searchParams.error ? ERROR_COPY[searchParams.error] : null;
  // En modo cambio, la elección crea una SOLICITUD (no cambia directo).
  const isExistingMember = !!profile?.locality_id;

  return (
    <div className="flex min-h-[calc(100dvh/var(--ui-zoom,1))] flex-col bg-bg">
      <header
        className="relative overflow-hidden bg-gold-grad px-6 pb-10"
        style={{ paddingTop: "calc(var(--safe-top) + 28px)" }}
      >
        <div className="pointer-events-none absolute right-[-20px] top-6 opacity-[0.08]">
          <BahaiStar size={160} color="#fff" />
        </div>
        <div className="relative mx-auto max-w-md">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[2.5px] text-white/55">
            {isExistingMember ? "Cambiar de comunidad" : "Elige tu comunidad"}
          </div>
          <h1 className="font-display text-[30px] font-bold leading-tight text-white">
            {isExistingMember
              ? "¿A qué comunidad querés mudarte?"
              : "¿De qué localidad eres?"}
          </h1>
          <p className="mt-2 font-body text-[13px] text-white/75">
            {isExistingMember
              ? "Tu solicitud la revisa la Asamblea de la comunidad que elijas. Hasta que la aprueben, seguís en tu comunidad actual."
              : "Selecciona la Comunidad Bahá'í a la que perteneces. Verás los comunicados, actividades y vida administrativa de esa localidad."}
          </p>
        </div>
      </header>

      <main className="mt-4 flex-1 px-4 pb-12">
        <div className="mx-auto w-full max-w-md">
          {error && (
            <div className="mb-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-[13px] text-rose-700 shadow-card-soft">
              {error}
            </div>
          )}

          {list.length === 0 ? (
            <div className="rounded-2xl bg-card p-6 text-center shadow-card-elevated">
              <p className="text-[14px] text-dark">
                Todavía no hay localidades configuradas.
              </p>
              <p className="mt-2 text-[12px] text-muted">
                Contacta al Admin Nacional para que cree tu comunidad.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {list.map((loc) => (
                <li key={loc.id}>
                  <form action={selectLocalityAction}>
                    <input type="hidden" name="locality_id" value={loc.id} />
                    {searchParams.next && (
                      <input type="hidden" name="next" value={searchParams.next} />
                    )}
                    <button
                      type="submit"
                      className="tap flex w-full items-center justify-between gap-3 rounded-2xl bg-card px-4 py-4 text-left shadow-card hover:shadow-card-elevated active:scale-[0.98]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-[17px] font-semibold leading-tight text-dark">
                          {loc.name}
                        </div>
                        <div className="mt-1 font-body text-[12px] text-muted">
                          {[loc.city, loc.country].filter(Boolean).join(" · ")}
                        </div>
                        {loc.description && (
                          <div className="mt-1.5 line-clamp-2 font-body text-[11.5px] text-muted">
                            {loc.description}
                          </div>
                        )}
                      </div>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="shrink-0 text-terra"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          {national && !isExistingMember && (
            <div className="mt-5 border-t border-black/[0.07] pt-5">
              <div className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
                ¿No está tu comunidad?
              </div>
              <form action={selectLocalityAction}>
                <input type="hidden" name="locality_id" value={national.id} />
                {searchParams.next && (
                  <input type="hidden" name="next" value={searchParams.next} />
                )}
                <button
                  type="submit"
                  className="tap flex w-full items-center justify-between gap-3 rounded-2xl border border-gold/30 bg-gold/[0.06] px-4 py-4 text-left hover:bg-gold/10 active:scale-[0.98]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[16px] font-semibold leading-tight text-dark">
                      No pertenezco a una Asamblea Local
                    </div>
                    <div className="mt-1 font-body text-[11.5px] leading-[1.5] text-muted">
                      Vas a formar parte de la {national.name}: la Biblioteca,
                      el calendario, los comunicados nacionales y el chat con
                      la Secretaría Nacional. Si después se forma tu Asamblea
                      Local, te podés sumar desde tu perfil.
                    </div>
                  </div>
                </button>
              </form>
            </div>
          )}

          <p className="mt-6 text-center text-[11px] text-muted">
            {isExistingMember
              ? "Al elegir una comunidad, se envía una solicitud a su Asamblea para que la apruebe."
              : "Si te equivocas, podrás cambiar de localidad después desde tu perfil."}
          </p>
        </div>
      </main>
    </div>
  );
}
