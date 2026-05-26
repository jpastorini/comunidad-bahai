import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { QuickForm } from "./quick-form";
import {
  deleteSuggestionAction,
  toggleSuggestionReviewedAction,
} from "../../../sugerencias/actions";

export const revalidate = 60;

export default async function FeastQuickSuggestionsPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();
  const supabase = createSupabaseServer();

  const { data: feast } = await supabase
    .from("feasts")
    .select("id, bahai_month_name, bahai_month_index, bahai_year, status")
    .eq("id", params.id)
    .maybeSingle();

  if (!feast) notFound();

  const { data: suggestions } = await supabase
    .from("feast_suggestions")
    .select("id, detail, author_name, reviewed, created_at")
    .eq("feast_id", params.id)
    .order("created_at", { ascending: false });

  const rows = suggestions ?? [];

  return (
    <div className="mx-auto max-w-xl">
      {/* Encabezado compacto, optimizado para móvil */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href={`/admin/fiestas/${feast.id}`}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-muted hover:text-terra"
        >
          ← Volver a la Fiesta
        </Link>
        <Link
          href="/admin/sugerencias"
          className="text-[12px] font-semibold text-terra hover:underline"
        >
          Ver todas
        </Link>
      </div>

      <div className="mb-4">
        <div className="text-[10px] font-semibold uppercase tracking-[2px] text-gold-dark">
          Captura en vivo
        </div>
        <h1 className="mt-1 font-display text-[28px] font-bold leading-tight text-dark">
          {feast.bahai_month_name}
        </h1>
        <div className="mt-1 text-[12px] text-muted">
          Mes {feast.bahai_month_index} · {feast.bahai_year} BE
          {feast.status === "in_progress" ? " · Iniciada" : ""}
        </div>
      </div>

      {/* Form quick-add */}
      <QuickForm feastId={feast.id} />

      {/* Lista en vivo */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
            Capturadas en esta Fiesta
          </h2>
          <span className="rounded-full bg-terra/10 px-2 py-0.5 text-[11px] font-bold text-terra">
            {rows.length}
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/15 bg-bg/40 p-6 text-center text-[13px] text-muted">
            Sin sugerencias aún. Las que captures arriba aparecerán acá al
            instante.
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {rows.map((s) => (
              <li
                key={s.id}
                className={`rounded-2xl border bg-card p-4 shadow-card-soft ${
                  s.reviewed
                    ? "border-emerald-200/60 opacity-70"
                    : "border-black/[0.04]"
                }`}
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="text-[11px] font-semibold text-dark">
                    {s.author_name ?? (
                      <span className="italic text-muted">Anónima</span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted">
                    {new Date(s.created_at).toLocaleTimeString("es-MX", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <p className="whitespace-pre-line font-body text-[13.5px] leading-[1.5] text-dark">
                  {s.detail}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  {s.reviewed && (
                    <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                      Tratada
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-3">
                    <form action={toggleSuggestionReviewedAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <input
                        type="hidden"
                        name="reviewed"
                        value={String(!s.reviewed)}
                      />
                      <button
                        type="submit"
                        className="text-[11px] font-semibold text-terra hover:underline"
                      >
                        {s.reviewed ? "Reabrir" : "Marcar tratada"}
                      </button>
                    </form>
                    <form action={deleteSuggestionAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button
                        type="submit"
                        className="text-[11px] font-semibold text-rose-600 hover:underline"
                      >
                        Borrar
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
