import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { monthRange } from "./treasury-cashbook";
import {
  getLedgerEntriesByRange,
  type TreasuryEntry,
  type TreasuryFund,
} from "./treasury-ledger";
import type { TreasuryCommitment } from "./types";

/**
 * Los compromisos con el Fondo, y cómo vienen este mes.
 *
 * El informe responde las dos preguntas del tesorero: a quién llamar
 * para agradecer y a quién para recordar. Tres cosas lo sostienen:
 *
 * - **El vínculo es `treasury_contributors.profile_id`** (046). Un
 *   contribuyente suelto —escrito a mano, o importado de la planilla—
 *   no apunta a ningún perfil, así que de esa persona el informe NO
 *   puede decir si aportó: sale en su propio grupo, con el camino para
 *   vincularla. Contarla como "no aportó" sería el error caro, porque
 *   el tesorero llamaría a alguien que ya dio.
 * - **El mes es civil**, como los cierres (054) y los extractos (061).
 *   El compromiso es mensual y el ejercicio contable arranca a mitad de
 *   abril: acá el ejercicio no pinta nada.
 * - **Cuenta cualquier aporte de la persona a esa comunidad**, sea al
 *   Fondo Local, a Enseñanza o al que sea, con el desglose por fondo a
 *   la vista: el compromiso es con el Fondo, no con un rubro. Lo que
 *   entró en otra moneda que la declarada se informa aparte, nunca
 *   sumado.
 */

export type CommitmentPayment = {
  id: string;
  entry_date: string;
  amount: number;
  currency: string;
  fund_name: string | null;
  receipt_number: number | null;
};

export type CommitmentStatus =
  | "cumplido"
  | "parcial"
  | "pendiente"
  | "sin_vinculo";

export type CommitmentRow = {
  user_id: string;
  display_name: string;
  /** El nombre del perfil, cuando difiere del declarado ("Familia García"). */
  profile_name: string | null;
  email: string | null;
  amount: number;
  currency: string;
  want_reminder: boolean;
  /** Tiene al menos un contribuyente del libro apuntando a su perfil. */
  linked: boolean;
  /** Aportado en el mes, en la moneda del compromiso. */
  paid: number;
  /** Lo que aportó en OTRA moneda; nunca se suma a `paid`. */
  otherCurrency: Array<{ currency: string; amount: number }>;
  byFund: Array<{ fund: string; amount: number; currency: string }>;
  payments: CommitmentPayment[];
  lastPaymentDate: string | null;
  status: CommitmentStatus;
};

/** Quien aportó este mes sin tener compromiso declarado: también hay que
 *  agradecerle, y estaba en el libro pero no junto a esto. */
export type OtherGiver = {
  name: string;
  totals: Array<{ currency: string; amount: number }>;
  count: number;
};

export type CommitmentMonthReport = {
  month: string;
  from: string;
  to: string;
  rows: CommitmentRow[];
  others: OtherGiver[];
  /** Totales por moneda de quienes TIENEN compromiso. Los aportes del
   *  resto no entran, o el cumplimiento del mes se leería mejor de lo
   *  que es. */
  totals: Array<{ currency: string; committed: number; paid: number }>;
  /** Falta correr la 063: la pantalla avisa en vez de romperse. */
  schemaMissing: boolean;
};

/** El error de una tabla o columna que la migración todavía no creó. */
function isSchemaMissing(error: { code?: string } | null | undefined): boolean {
  return (
    !!error &&
    (error.code === "42P01" ||
      error.code === "42703" ||
      error.code === "PGRST205")
  );
}

/** El movimiento cuenta como aporte de una persona: ingreso real, vivo y
 *  con contribuyente. Ni apertura, ni transferencia, ni anulado. */
function isContribution(e: TreasuryEntry): boolean {
  return (
    e.amount > 0 &&
    !e.is_opening_balance &&
    !e.transfer_group_id &&
    !e.voided_at &&
    !!e.contributor_id
  );
}

function addTo(
  list: Array<{ currency: string; amount: number }>,
  currency: string,
  amount: number
): void {
  const found = list.find((x) => x.currency === currency);
  if (found) found.amount += amount;
  else list.push({ currency, amount });
}

export async function getCommitmentMonthReport(
  supabase: SupabaseClient,
  localityId: string,
  month: string
): Promise<CommitmentMonthReport> {
  const { from, to } = monthRange(month);
  const empty: CommitmentMonthReport = {
    month,
    from,
    to,
    rows: [],
    others: [],
    totals: [],
    schemaMissing: false,
  };

  const { data: commitmentsData, error } = await supabase
    .from("treasury_commitments")
    .select("*")
    .eq("locality_id", localityId)
    .order("amount", { ascending: false });

  if (error) {
    if (isSchemaMissing(error)) return { ...empty, schemaMissing: true };
    console.error("[getCommitmentMonthReport]", error);
    return empty;
  }

  const commitments = (commitmentsData ?? []) as TreasuryCommitment[];

  const [contributorsRes, fundsRes, entries] = await Promise.all([
    supabase
      .from("treasury_contributors")
      .select("id, name, profile_id")
      .eq("locality_id", localityId),
    supabase.from("treasury_funds").select("id, name, is_active, sort_order"),
    getLedgerEntriesByRange(supabase, from, to),
  ]);

  const contributors = (contributorsRes.data ?? []) as Array<{
    id: string;
    name: string;
    profile_id: string | null;
  }>;
  const funds = (fundsRes.data ?? []) as TreasuryFund[];
  const fundName = new Map(funds.map((f) => [f.id, f.name]));
  const contributorById = new Map(contributors.map((c) => [c.id, c]));

  // profile_id → sus contribuyentes. Puede haber más de uno: el cargado a
  // mano y vinculado después convive con el que creó el buscador de
  // creyentes.
  const contributorsByProfile = new Map<string, string[]>();
  for (const c of contributors) {
    if (!c.profile_id) continue;
    const list = contributorsByProfile.get(c.profile_id) ?? [];
    list.push(c.id);
    contributorsByProfile.set(c.profile_id, list);
  }

  // Nombre y correo del perfil, para que el tesorero tenga a quién llamar
  // sin salir de la pantalla.
  const profileById = new Map<
    string,
    { full_name: string | null; email: string | null }
  >();
  if (commitments.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in(
        "id",
        commitments.map((c) => c.user_id)
      );
    for (const p of (profiles ?? []) as Array<{
      id: string;
      full_name: string | null;
      email: string | null;
    }>) {
      profileById.set(p.id, { full_name: p.full_name, email: p.email });
    }
  }

  const contributions = entries.filter(isContribution);
  const claimed = new Set<string>();

  const rows: CommitmentRow[] = commitments.map((c) => {
    const contributorIds = contributorsByProfile.get(c.user_id) ?? [];
    const mine = contributions.filter((e) =>
      contributorIds.includes(e.contributor_id as string)
    );
    for (const e of mine) claimed.add(e.id);

    const payments: CommitmentPayment[] = mine
      .map((e) => ({
        id: e.id,
        entry_date: e.entry_date,
        amount: e.amount,
        currency: e.currency,
        fund_name: e.fund_id ? (fundName.get(e.fund_id) ?? null) : null,
        receipt_number: e.receipt_number,
      }))
      .sort((a, b) => a.entry_date.localeCompare(b.entry_date));

    const currency = c.currency ?? "UYU";
    let paid = 0;
    const otherCurrency: Array<{ currency: string; amount: number }> = [];
    const byFund: Array<{ fund: string; amount: number; currency: string }> = [];
    for (const p of payments) {
      if (p.currency === currency) paid += p.amount;
      else addTo(otherCurrency, p.currency, p.amount);
      const label = p.fund_name ?? "Sin fondo";
      const found = byFund.find(
        (f) => f.fund === label && f.currency === p.currency
      );
      if (found) found.amount += p.amount;
      else byFund.push({ fund: label, amount: p.amount, currency: p.currency });
    }

    const linked = contributorIds.length > 0;
    const status: CommitmentStatus = !linked
      ? "sin_vinculo"
      : paid >= Number(c.amount)
        ? "cumplido"
        : paid > 0
          ? "parcial"
          : "pendiente";

    const profile = profileById.get(c.user_id);
    return {
      user_id: c.user_id,
      display_name: c.display_name,
      profile_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      amount: Number(c.amount),
      currency,
      want_reminder: c.want_reminder,
      linked,
      paid,
      otherCurrency,
      byFund,
      payments,
      lastPaymentDate: payments.length
        ? payments[payments.length - 1].entry_date
        : null,
      status,
    };
  });

  // Quien aportó sin compromiso declarado, agrupado por contribuyente.
  const othersByName = new Map<string, OtherGiver>();
  for (const e of contributions) {
    if (claimed.has(e.id)) continue;
    const name =
      contributorById.get(e.contributor_id as string)?.name ?? "Sin nombre";
    const row = othersByName.get(name) ?? { name, totals: [], count: 0 };
    addTo(row.totals, e.currency, e.amount);
    row.count += Math.max(1, e.contributions_count);
    othersByName.set(name, row);
  }

  const totals: Array<{ currency: string; committed: number; paid: number }> =
    [];
  for (const r of rows) {
    let t = totals.find((x) => x.currency === r.currency);
    if (!t) {
      t = { currency: r.currency, committed: 0, paid: 0 };
      totals.push(t);
    }
    t.committed += r.amount;
    t.paid += r.paid;
  }

  // Primero lo que pide acción (pendientes, después parciales); al final
  // lo que está en orden. Dentro de cada grupo, el monto más alto arriba.
  const weight: Record<CommitmentStatus, number> = {
    pendiente: 0,
    parcial: 1,
    sin_vinculo: 2,
    cumplido: 3,
  };
  rows.sort(
    (a, b) => weight[a.status] - weight[b.status] || b.amount - a.amount
  );

  return {
    month,
    from,
    to,
    rows,
    others: [...othersByName.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "es")
    ),
    totals,
    schemaMissing: false,
  };
}
