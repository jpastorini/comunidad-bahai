import Link from "next/link";
import { Banner, Button, Card, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  deleteSuggestionAction,
  toggleSuggestionReviewedAction,
} from "./actions";

type Filter = "pending" | "reviewed" | "all";

type SuggestionRow = {
  id: string;
  detail: string;
  reviewed: boolean;
  author_name: string | null;
  author_email: string | null;
  created_at: string;
  feast_id: string;
  feast_label: string;
  feast_date: string | null;
};

export default async function AdminSugerenciasPage({
  searchParams,
}: {
  searchParams: { filter?: string; feast?: string };
}) {
  await requireAdmin();
  const supabase = createSupabaseServer();

  const filter: Filter =
    searchParams.filter === "all"
      ? "all"
      : searchParams.filter === "reviewed"
        ? "reviewed"
        : "pending";

  // Trae sugerencias + datos de Fiesta + nombre del autor (si miembro logueado).
  let query = supabase
    .from("feast_suggestions")
    .select(
      "id, detail, reviewed, author_name, user_id, created_at, feast_id, feasts!inner(id, bahai_month_name, bahai_month_index, bahai_year, locations:feast_locations(starts_at))"
    )
    .order("created_at", { ascending: false });

  if (filter === "pending") query = query.eq("reviewed", false);
  if (filter === "reviewed") query = query.eq("reviewed", true);
  if (searchParams.feast) query = query.eq("feast_id", searchParams.feast);

  const { data } = await query;

  // Resuelve nombres de miembros logueados en lote.
  const userIds = Array.from(
    new Set(
      (data ?? [])
        .map((s) => s.user_id as string | null)
        .filter((id): id is string => !!id)
    )
  );
  const profileByUser = new Map<
    string,
    { full_name: string | null; email: string | null }
  >();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      profileByUser.set(p.id, {
        full_name: p.full_name,
        email: p.email,
      });
    }
  }

  // Conteos globales para las pestañas (independientes del filtro actual).
  const [{ count: pendingCount }, { count: reviewedCount }] = await Promise.all([
    supabase
      .from("feast_suggestions")
      .select("*", { count: "exact", head: true })
      .eq("reviewed", false),
    supabase
      .from("feast_suggestions")
      .select("*", { count: "exact", head: true })
      .eq("reviewed", true),
  ]);

  type FeastShape = {
    id: string;
    bahai_month_name: string;
    bahai_month_index: number;
    bahai_year: number;
    locations?: { starts_at: string }[];
  };

  const rows: SuggestionRow[] = (data ?? []).map((s) => {
    // s.feasts puede llegar como objeto o como array dependiendo de cómo
    // PostgREST infiera la relación; lo normalizamos.
    const rawFeast = s.feasts as unknown;
    const feast: FeastShape = Array.isArray(rawFeast)
      ? ((rawFeast[0] ?? {}) as FeastShape)
      : ((rawFeast ?? {}) as FeastShape);
    // Fecha = primera ubicación (la más temprana).
    const firstDate =
      (feast.locations ?? [])
        .map((l) => l.starts_at)
        .sort()[0] ?? null;
    const profile = s.user_id ? profileByUser.get(s.user_id) : null;
    return {
      id: s.id,
      detail: s.detail,
      reviewed: s.reviewed,
      author_name:
        s.author_name ??
        profile?.full_name ??
        (s.user_id ? "Miembro" : null),
      author_email: profile?.email ?? null,
      created_at: s.created_at,
      feast_id: feast.id,
      feast_label: `${feast.bahai_month_name} · ${feast.bahai_year} BE`,
      feast_date: firstDate,
    };
  });

  return (
    <>
      <PageHeader
        eyebrow="Asamblea Local"
        title="Sugerencias de la comunidad"
        description="Capturadas durante las Fiestas. La Asamblea las consulta en su reunión administrativa y marca las tratadas."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" href="/admin/sugerencias/nueva">
              + En lote
            </Button>
            <Button href="/admin/fiestas">Captura en vivo →</Button>
          </div>
        }
      />

      {/* Tabs de filtro */}
      <div className="mb-5 flex flex-wrap gap-1 rounded-2xl bg-card p-1 shadow-card-soft">
        <FilterTab
          href="/admin/sugerencias"
          active={filter === "pending"}
          label="Pendientes"
          count={pendingCount ?? 0}
          tone="terra"
        />
        <FilterTab
          href="/admin/sugerencias?filter=reviewed"
          active={filter === "reviewed"}
          label="Tratadas"
          count={reviewedCount ?? 0}
          tone="muted"
        />
        <FilterTab
          href="/admin/sugerencias?filter=all"
          active={filter === "all"}
          label="Todas"
          count={(pendingCount ?? 0) + (reviewedCount ?? 0)}
          tone="muted"
        />
      </div>

      {rows.length === 0 ? (
        <Card className="text-center text-[13px] text-muted">
          {filter === "pending" ? (
            <>
              No hay sugerencias pendientes. <br />
              <Link
                href="/admin/sugerencias?filter=all"
                className="font-semibold text-terra hover:underline"
              >
                Ver todas
              </Link>
            </>
          ) : (
            "No hay sugerencias en esta vista."
          )}
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((s) => (
            <SuggestionCard key={s.id} suggestion={s} />
          ))}
        </div>
      )}

      <div className="mt-6">
        <Banner tone="info">
          Las sugerencias también pueden ser enviadas por los miembros desde la
          app de comunidad durante o después de cada Fiesta.
        </Banner>
      </div>
    </>
  );
}

function FilterTab({
  href,
  active,
  label,
  count,
  tone,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
  tone: "terra" | "muted";
}) {
  return (
    <Link
      href={href}
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold transition ${
        active
          ? "bg-terra text-white shadow-card-soft"
          : "text-dark hover:bg-bg"
      }`}
    >
      <span>{label}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
          active
            ? "bg-white/20 text-white"
            : tone === "terra"
              ? "bg-terra/10 text-terra"
              : "bg-bg text-muted"
        }`}
      >
        {count}
      </span>
    </Link>
  );
}

function SuggestionCard({ suggestion }: { suggestion: SuggestionRow }) {
  const dateStr = suggestion.feast_date
    ? new Date(suggestion.feast_date).toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <article
      className={`rounded-2xl border bg-card p-5 shadow-card transition ${
        suggestion.reviewed
          ? "border-emerald-200/60 opacity-75"
          : "border-black/[0.04]"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Link
          href={`/admin/fiestas/${suggestion.feast_id}`}
          className="rounded bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-dark hover:bg-gold/25"
        >
          {suggestion.feast_label}
        </Link>
        {dateStr && (
          <span className="text-[11px] text-muted">{dateStr}</span>
        )}
        {suggestion.reviewed && (
          <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
            Tratada
          </span>
        )}
      </div>
      <p className="whitespace-pre-line font-body text-[14px] leading-[1.55] text-dark">
        {suggestion.detail}
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[11px] text-muted">
          {suggestion.author_name ? (
            <>
              <span className="font-semibold text-dark">
                {suggestion.author_name}
              </span>
              {suggestion.author_email && (
                <span className="ml-1">· {suggestion.author_email}</span>
              )}
            </>
          ) : (
            <span className="italic">Anónima</span>
          )}
          <span className="ml-2">
            · {new Date(suggestion.created_at).toLocaleString("es-MX", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <form action={toggleSuggestionReviewedAction}>
            <input type="hidden" name="id" value={suggestion.id} />
            <input
              type="hidden"
              name="reviewed"
              value={String(!suggestion.reviewed)}
            />
            <button
              type="submit"
              className={`tap rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
                suggestion.reviewed
                  ? "border border-black/10 bg-card text-dark hover:bg-bg"
                  : "bg-terra text-white hover:bg-terra-light"
              }`}
            >
              {suggestion.reviewed ? "Reabrir" : "Marcar como tratada"}
            </button>
          </form>
          <form action={deleteSuggestionAction}>
            <input type="hidden" name="id" value={suggestion.id} />
            <button
              type="submit"
              className="text-[11px] font-semibold text-rose-600 hover:underline"
            >
              Borrar
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}
