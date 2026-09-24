import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addMoney } from "./treasury-format";
import { getTreasuryProgress } from "./treasury-progress";
import type { ProgressMoney } from "./treasury-progress-content";
import type {
  PublicationMonth,
  PublicationSnapshot,
  TreasuryPublication,
} from "./treasury-publication-content";
import { previousDay, treasuryMonths, treasuryYearForDate } from "./treasury-year";

/**
 * El estado del Fondo que la comunidad ve (066) — capa de datos.
 *
 * Un solo lugar calcula (`computePublicationSnapshot`, lo llama el botón
 * "Calcular" de Tesorería → Publicar) y todos los demás LEEN la foto
 * guardada: /tesoreria, la pantalla de la Fiesta, el deck y el folleto.
 * Nada de lo que ve la comunidad se recalcula al renderizar.
 */

const COLUMNS = "id, status, as_of, snapshot, calculated_at, published_at";

type DateAgg = { d: string; c: string; a: number | string; n: number | string };
type Agg = { id: string | null; c: string; a: number | string };

function byCurrency(rows: { c: string; a: number | string }[], sign = 1): ProgressMoney[] {
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.c, addMoney(map.get(r.c) ?? 0, sign * Number(r.a)));
  return [...map.entries()]
    .filter(([, amount]) => Math.abs(amount) >= 0.005)
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => (a.currency === "UYU" ? -1 : b.currency === "UYU" ? 1 : a.currency.localeCompare(b.currency)));
}

/** El tramo de mes bahá'í del ejercicio que contiene la fecha. */
function monthFor(asOf: string) {
  const year = treasuryYearForDate(asOf);
  if (!year) return null;
  return treasuryMonths(year).find((m) => asOf >= m.from && asOf <= m.to) ?? null;
}

/**
 * Último día del último mes bahá'í que ya terminó a la fecha: el corte
 * natural de lo que se presenta en la Fiesta (el mes que acaba de
 * cerrar). Mulk absorbe Ayyám-i-Há, como en todo lo contable.
 */
export function lastClosedMonthEnd(today: string): { date: string; name: string } | null {
  const current = monthFor(today);
  if (!current) return null;
  const date = previousDay(current.from);
  const prev = monthFor(date);
  return prev ? { date, name: prev.name } : null;
}

export async function computePublicationSnapshot(
  supabase: SupabaseClient,
  localityId: string,
  asOf: string
): Promise<PublicationSnapshot> {
  const tramo = monthFor(asOf);

  const [progress, monthRpc] = await Promise.all([
    getTreasuryProgress(supabase, { localityId, asOf }),
    tramo
      ? supabase.rpc("treasury_progress", {
          loc: localityId,
          year_from: tramo.from,
          as_of: asOf,
        })
      : Promise.resolve(null),
  ]);

  let month: PublicationMonth | null = null;
  if (tramo && monthRpc && !monthRpc.error) {
    const agg = (monthRpc.data ?? {}) as {
      contributionsByDate?: DateAgg[];
      spentByCategory?: Agg[];
    };
    const contributions = agg.contributionsByDate ?? [];
    month = {
      name: tramo.name,
      from: tramo.from,
      to: asOf,
      complete: tramo.to <= asOf,
      income: byCurrency(contributions),
      // spentByCategory viene en positivo (sum(-amount)); agrupa también
      // los gastos sin categoría (id null), así que suma todo lo gastado.
      expenses: byCurrency(agg.spentByCategory ?? []),
      contributions: contributions.reduce((sum, r) => sum + Number(r.n), 0),
    };
  } else if (monthRpc?.error) {
    console.error("[tesoreria/publicar] mes:", monthRpc.error.message);
  }

  return { v: 1, asOf, month, progress };
}

export function isPublicationsSchemaMissing(
  error: { code?: string } | null | undefined
): boolean {
  return ["42P01", "42703", "PGRST205"].includes(error?.code ?? "");
}

function normalize(row: unknown): TreasuryPublication {
  return row as TreasuryPublication;
}

/** El borrador del tesorero, si hay uno. */
export async function getPublicationDraft(
  supabase: SupabaseClient,
  localityId: string
): Promise<{ draft: TreasuryPublication | null; schemaMissing: boolean }> {
  const { data, error } = await supabase
    .from("treasury_publications")
    .select(COLUMNS)
    .eq("locality_id", localityId)
    .eq("status", "draft")
    .maybeSingle();
  if (error) {
    if (!isPublicationsSchemaMissing(error)) {
      console.error("[tesoreria/publicar] borrador:", error.message);
    }
    return { draft: null, schemaMissing: isPublicationsSchemaMissing(error) };
  }
  return { draft: data ? normalize(data) : null, schemaMissing: false };
}

/**
 * La publicación vigente. Con `at`, la que estaba vigente en ese momento
 * (la Fiesta pasa su `started_at`): publicar otra después no le cambia a
 * la Fiesta lo que se presentó.
 */
export async function getCurrentPublication(
  supabase: SupabaseClient,
  localityId: string,
  at?: string | null
): Promise<TreasuryPublication | null> {
  let q = supabase
    .from("treasury_publications")
    .select(COLUMNS)
    .eq("locality_id", localityId)
    .eq("status", "published");
  if (at) q = q.lte("published_at", at);
  const { data, error } = await q
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    // Hasta que corra la 066 la tabla no existe: la comunidad ve "todavía
    // no se compartió", que es la verdad.
    if (!isPublicationsSchemaMissing(error)) {
      console.error("[tesoreria/publicaciones] vigente:", error.message);
    }
    return null;
  }
  return data ? normalize(data) : null;
}

/**
 * La foto que corresponde a una Fiesta: la vigente cuando la Asamblea la
 * inició. Antes de iniciarla (la Asamblea ensayando el deck), la última.
 * Es la regla que decidió el usuario: publicar otra al día siguiente no
 * le cambia a la Fiesta lo que se presentó.
 */
export function getPublicationForFeast(
  supabase: SupabaseClient,
  localityId: string,
  feast: { status: string; started_at: string | null }
): Promise<TreasuryPublication | null> {
  const at = feast.status === "in_progress" ? feast.started_at : null;
  return getCurrentPublication(supabase, localityId, at);
}

/** Las últimas publicaciones, para el historial del tesorero. */
export async function listPublications(
  supabase: SupabaseClient,
  localityId: string,
  limit = 12
): Promise<TreasuryPublication[]> {
  const { data, error } = await supabase
    .from("treasury_publications")
    .select(COLUMNS)
    .eq("locality_id", localityId)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map(normalize);
}
