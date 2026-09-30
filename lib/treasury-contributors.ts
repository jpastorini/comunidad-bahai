import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LedgerMember, TreasuryContributor } from "./treasury-ledger";

/**
 * El padrón de contribuyentes (040/046), con lo que hace falta para
 * ordenarlo: cuántos aportes tiene cada ficha, a qué creyente apunta, y
 * las sugerencias —fichas que parecen la misma persona, fichas sueltas
 * que parecen un creyente de la app—.
 *
 * Existe porque el vínculo `profile_id` es lo que hace que "Mis aportes"
 * muestre algo y que Compromisos pueda decir quién aportó; y porque el
 * padrón se llenó por tres caminos que no se hablaban (planilla, buscador,
 * a mano) y quedaron dobles. Todo lo que se calcula acá es sugerencia: la
 * decisión es del tesorero, en la pantalla.
 */

export type ContributorStats = {
  count: number;
  /** Por moneda, solo aportes vigentes (sin anulados). */
  totals: Array<{ currency: string; amount: number }>;
  lastDate: string | null;
  /** Aportes con recibo emitido: fusionar los mueve igual (075). */
  issued: number;
};

export type ContributorRow = TreasuryContributor & {
  notes: string | null;
  stats: ContributorStats;
  /** El creyente vinculado, si está en el padrón que ve el libro. */
  profileName: string | null;
  /** Creyente de la app cuyo nombre se parece, para una ficha suelta. */
  suggestedProfile: LedgerMember | null;
  /** Otras fichas que parecen la misma persona. */
  lookalikes: Array<{ id: string; name: string }>;
};

/** Sin acentos, minúsculas, sin tratamientos ni signos: lo que compara. */
export function normalizeContributorName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(sr|sra|srta|dr|dra|don|dona|doña|flia|familia|fam)\.?\s+/g, " ")
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Las palabras de un nombre normalizado, sin las de una letra. */
function tokens(n: string): string[] {
  return n.split(" ").filter((t) => t.length > 1);
}

/**
 * Dos nombres "parecen la misma persona" si uno contiene al otro o si
 * comparten al menos dos palabras (nombre y apellido). "Carlos Cardona" y
 * "Sr. Carlos Cardona" sí; "Carlos" y "Carlos Pérez" no (una sola palabra
 * es demasiado poco para sugerir una fusión).
 */
export function namesLookAlike(a: string, b: string): boolean {
  const na = normalizeContributorName(a);
  const nb = normalizeContributorName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ta = tokens(na);
  const tb = tokens(nb);
  if (ta.length >= 2 && tb.length >= 2) {
    const shared = ta.filter((t) => tb.includes(t)).length;
    if (shared >= 2) return true;
  }
  return (na.includes(nb) && tb.length >= 2) || (nb.includes(na) && ta.length >= 2);
}

type EntryLite = {
  contributor_id: string | null;
  amount: number | string;
  currency: string;
  entry_date: string;
  voided_at: string | null;
  receipt_issued: boolean;
};

async function allEntries(supabase: SupabaseClient): Promise<EntryLite[]> {
  const out: EntryLite[] = [];
  for (let page = 0; page < 50; page++) {
    const { data, error } = await supabase
      .from("treasury_entries")
      .select("contributor_id, amount, currency, entry_date, voided_at, receipt_issued")
      .not("contributor_id", "is", null)
      .range(page * 1000, page * 1000 + 999);
    if (error) {
      console.error("[treasury-contributors] entries:", error);
      break;
    }
    const rows = (data ?? []) as EntryLite[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

export async function getContributorsOverview(
  supabase: SupabaseClient,
  roster: LedgerMember[]
): Promise<ContributorRow[]> {
  const [{ data: rows, error }, entries] = await Promise.all([
    supabase
      .from("treasury_contributors")
      .select("id, name, kind, profile_id, notes, is_active")
      .order("name"),
    allEntries(supabase),
  ]);
  if (error) {
    console.error("[treasury-contributors]", error);
    return [];
  }
  const contributors = (rows ?? []) as Array<TreasuryContributor & { notes: string | null }>;

  const stats = new Map<string, ContributorStats>();
  for (const e of entries) {
    if (!e.contributor_id) continue;
    const s = stats.get(e.contributor_id) ?? { count: 0, totals: [], lastDate: null, issued: 0 };
    s.count++;
    if (e.receipt_issued) s.issued++;
    if (!s.lastDate || e.entry_date > s.lastDate) s.lastDate = e.entry_date;
    if (!e.voided_at) {
      const t = s.totals.find((x) => x.currency === e.currency);
      if (t) t.amount += Number(e.amount);
      else s.totals.push({ currency: e.currency, amount: Number(e.amount) });
    }
    stats.set(e.contributor_id, s);
  }

  const rosterById = new Map(roster.map((m) => [m.id, m]));
  const linkedProfiles = new Set(contributors.map((c) => c.profile_id).filter(Boolean));

  return contributors.map((c) => {
    const st = stats.get(c.id) ?? { count: 0, totals: [], lastDate: null, issued: 0 };
    st.totals.forEach((t) => (t.amount = Math.round(t.amount * 100) / 100));
    // Sugerir un creyente solo para fichas sueltas tipo persona/familia,
    // y solo uno que no esté ya vinculado a otra ficha.
    let suggested: LedgerMember | null = null;
    if (!c.profile_id && (c.kind === "persona" || c.kind === "familia" || c.kind === "otro")) {
      const hits = roster.filter(
        (m) => m.full_name && !linkedProfiles.has(m.id) && namesLookAlike(c.name, m.full_name)
      );
      if (hits.length === 1) suggested = hits[0];
    }
    const lookalikes = contributors
      .filter((o) => o.id !== c.id && o.kind !== "colecta" && c.kind !== "colecta")
      .filter((o) => (o.profile_id && o.profile_id === c.profile_id) || namesLookAlike(o.name, c.name))
      .map((o) => ({ id: o.id, name: o.name }));
    return {
      ...c,
      stats: st,
      profileName: c.profile_id ? rosterById.get(c.profile_id)?.full_name ?? null : null,
      suggestedProfile: suggested,
      lookalikes,
    };
  });
}
