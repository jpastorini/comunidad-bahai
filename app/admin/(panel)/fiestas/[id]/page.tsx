import { notFound } from "next/navigation";
import { Banner, Card, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getFeast, getFeastLocations, getFeastPrayers } from "@/lib/data";
import type { FeastSuggestion } from "@/lib/types";
import { FeastForm } from "../feast-form";
import {
  loadTemplateAction,
  toggleFeastStatusAction,
  toggleSuggestionReviewedAction,
} from "../actions";

export default async function EditFeastPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();

  const [feast, locations, prayers] = await Promise.all([
    getFeast(params.id),
    getFeastLocations(params.id),
    getFeastPrayers(params.id),
  ]);
  if (!feast) notFound();

  const supabase = createSupabaseServer();
  const { data: suggestions } = await supabase
    .from("feast_suggestions")
    .select("*")
    .eq("feast_id", params.id)
    .order("created_at", { ascending: false });

  const isInProgress = feast.status === "in_progress";

  return (
    <>
      <PageHeader
        eyebrow={`Mes ${feast.bahai_month_index} · ${feast.bahai_year} BE`}
        title={`Fiesta de ${feast.bahai_month_name}`}
        description="Edita el programa, lugares y tesorería. Cuando esté listo, inicia la Fiesta para que los miembros vean el programa."
      />

      {/* Estado + plantilla */}
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Estado actual
          </h3>
          <div className="mt-1 flex items-center gap-3">
            {isInProgress ? (
              <span className="rounded bg-emerald-500/15 px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide text-emerald-700">
                Iniciada
              </span>
            ) : (
              <span className="rounded bg-bg px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide text-muted">
                Por iniciar
              </span>
            )}
          </div>
          <p className="mt-3 text-[12px] text-muted">
            {isInProgress
              ? "Los miembros pueden ver el programa completo de esta Fiesta."
              : "Los miembros solo ven los lugares y fechas. El programa permanece oculto hasta que la Asamblea inicie la Fiesta."}
          </p>
          <form action={toggleFeastStatusAction} className="mt-3">
            <input type="hidden" name="id" value={feast.id} />
            <input
              type="hidden"
              name="new_status"
              value={isInProgress ? "upcoming" : "in_progress"}
            />
            <button
              type="submit"
              className={`tap rounded-xl px-4 py-2 text-[13px] font-semibold shadow-card-soft ${
                isInProgress
                  ? "border border-black/10 bg-card text-dark"
                  : "bg-terra text-white"
              }`}
            >
              {isInProgress ? "Volver a 'Por iniciar'" : "▶ Iniciar Fiesta"}
            </button>
          </form>
        </Card>

        <Card>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Plantilla
          </h3>
          <p className="mt-2 text-[12px] text-muted">
            Carga 4 oraciones por defecto, un tema de profundización y
            placeholders para los informes. Solo añade contenido que aún
            no tienes — no sobrescribe lo que ya escribiste.
          </p>
          <form action={loadTemplateAction} className="mt-3">
            <input type="hidden" name="id" value={feast.id} />
            <button
              type="submit"
              className="tap rounded-xl border border-terra/30 bg-terra/[0.05] px-4 py-2 text-[13px] font-semibold text-terra"
            >
              Cargar plantilla
            </button>
          </form>
        </Card>
      </div>

      <FeastForm feast={feast} locations={locations} prayers={prayers} />

      {/* Sugerencias */}
      <Card className="mt-8">
        <h2 className="font-display text-[20px] font-semibold text-dark">
          Sugerencias recibidas
        </h2>
        <p className="mt-1 text-[12px] text-muted">
          Comentarios y sugerencias enviadas por los miembros durante esta Fiesta.
          Solo los miembros de la Asamblea las ven.
        </p>

        {(!suggestions || suggestions.length === 0) ? (
          <div className="mt-4 rounded-xl border border-dashed border-black/10 bg-bg/40 py-6 text-center text-[13px] text-muted">
            Aún no hay sugerencias.
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-black/[0.05]">
            {(suggestions as FeastSuggestion[]).map((s) => (
              <li key={s.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="whitespace-pre-line font-body text-[13px] leading-[1.5] text-dark">
                      {s.detail}
                    </p>
                    <div className="mt-1 text-[10.5px] text-muted">
                      {new Date(s.created_at).toLocaleString("es-MX", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </div>
                  </div>
                  <form action={toggleSuggestionReviewedAction} className="shrink-0">
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="feast_id" value={feast.id} />
                    <input type="hidden" name="reviewed" value={s.reviewed ? "" : "on"} />
                    <button
                      type="submit"
                      className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                        s.reviewed
                          ? "bg-emerald-500/15 text-emerald-700"
                          : "bg-amber/15 text-amber"
                      }`}
                    >
                      {s.reviewed ? "Revisada" : "Marcar revisada"}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-6">
        <Banner tone="info">
          Cuando la Asamblea esté lista, presiona <strong>"Iniciar Fiesta"</strong>{" "}
          arriba. Eso publica el programa para todos los miembros.
        </Banner>
      </div>
    </>
  );
}
