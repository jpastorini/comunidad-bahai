import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findingsOf, getDispositions } from "./treasury-audit-server";
import {
  monthKeyOf,
  monthKeysBetween,
  monthLabel,
  monthRange,
  previousMonthKey,
} from "./treasury-cashbook";
import {
  closedMonthKeys,
  getClosings,
  getFirstEntryMonth,
  nextMonthToClose,
} from "./treasury-closings";
import { todayISO } from "./treasury-ledger";
import { getCurrentPublication } from "./treasury-publications";
import {
  getImports,
  getMatches,
  getStoredLines,
  monthReconciliation,
} from "./treasury-statements";
import { formatDate } from "./format";
import { getCashBoxes, getCashReports, getLastCounts } from "./treasury-cash";

/**
 * Lo que pide atención de la Tesorería, para el Inicio del panel.
 *
 * Cada tarjeta responde a una pregunta que el tesorero se hace al abrir
 * el panel —¿qué mes falta cerrar?, ¿qué dijo la última auditoría?, ¿el
 * extracto está conciliado?, ¿la comunidad vio el estado del Fondo?— y
 * sale de tablas que YA existen: nada acá se guarda. Cada fuente se
 * calcula por separado y falla a "nada que mostrar": el Inicio no puede
 * romperse porque una migración no corrió todavía.
 *
 * La CLAVE de cada tarjeta lleva el período o el objeto adentro
 * ("cierre:2026-08", "auditoria:<id>"). Es lo que hace que ocultar sea
 * seguro: la tarjeta oculta de agosto no oculta la de setiembre, y una
 * auditoría nueva vuelve a mostrar la suya. Los hallazgos de auditoría no
 * se "ocultan" en el sentido de la 059 (eso es despacharlos, con motivo);
 * acá se oculta la TARJETA, que reaparece con la próxima corrida.
 */

export type AttentionTone = "warn" | "alert";

export type TreasuryAttentionItem = {
  key: string;
  tone: AttentionTone;
  title: string;
  detail: string;
  href: string;
  cta: string;
};

export type TreasuryAttention = {
  items: TreasuryAttentionItem[];
  hidden: TreasuryAttentionItem[];
  /** false hasta que corra la 072: se muestran todas y no se puede ocultar. */
  canHide: boolean;
};

const CIERRES = "/admin/tesoreria/libro/cierres";
const AUDITORIA = "/admin/tesoreria/auditoria";
const CONCILIACION = "/admin/tesoreria/conciliacion";
const PUBLICAR = "/admin/tesoreria/publicar";
const LIBRO = "/admin/tesoreria/libro";
const COMPROMISOS = "/admin/tesoreria/compromisos";

/** Días de una fecha ISO a otra (positivo si `to` es después). */
function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.UTC(+fromIso.slice(0, 4), +fromIso.slice(5, 7) - 1, +fromIso.slice(8, 10));
  const b = Date.UTC(+toIso.slice(0, 4), +toIso.slice(5, 7) - 1, +toIso.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

// ─── Fuentes ─────────────────────────────────────────────────────

/** El mes (o los meses) que ya terminaron y siguen abiertos (054). */
async function closingItem(
  supabase: SupabaseClient,
  today: string
): Promise<TreasuryAttentionItem | null> {
  const [closings, firstMonth] = await Promise.all([
    getClosings(supabase),
    getFirstEntryMonth(supabase),
  ]);
  const next = nextMonthToClose(closings, firstMonth, today);
  if (!next) return null;
  const lastComplete = previousMonthKey(monthKeyOf(today));
  const pending = monthKeysBetween(next, lastComplete).length;
  const sinceEnd = daysBetween(monthRange(next).to, today);
  const late = pending > 1 || sinceEnd > 20;
  return {
    key: `cierre:${next}`,
    tone: late ? "alert" : "warn",
    title:
      pending === 1
        ? `Falta cerrar ${monthLabel(next)}`
        : `Faltan cerrar ${plural(pending, "mes", "meses")}`,
    detail:
      pending === 1
        ? `El mes terminó hace ${plural(sinceEnd, "día", "días")}. Antes de cerrar: todo cargado, el extracto conciliado y el Libro de Caja impreso para archivar.`
        : `Desde ${monthLabel(next)}. Se cierran en orden, del más viejo al más nuevo; cada cierre congela su mes.`,
    href: CIERRES,
    cta: "Cerrar el mes",
  };
}

type AuditRow = {
  id: string;
  run_at: string;
  findings: unknown;
};

/** Lo que quedó sin resolver de la última auditoría (059). */
async function auditItem(
  supabase: SupabaseClient,
  today: string
): Promise<TreasuryAttentionItem | null> {
  const { data, error } = await supabase
    .from("treasury_audits")
    .select("id, run_at, findings")
    .order("run_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    // Antes de la 059 la tabla no existe: no hay auditoría de la que hablar.
    return null;
  }
  const last = data as AuditRow | null;
  if (!last) {
    return {
      key: "auditoria:none",
      tone: "warn",
      title: "La auditoría nunca se corrió",
      detail:
        "Son reglas sobre el libro: huecos en la serie de recibos, meses sin cerrar, transferencias sin su otra pata, gastos sin comprobante. Corre al instante y no cambia nada.",
      href: AUDITORIA,
      cta: "Correr la auditoría",
    };
  }
  const dispositions = await getDispositions(supabase);
  const settled = new Set(
    dispositions.filter((d) => d.status !== "pendiente").map((d) => d.finding_key)
  );
  const pending = findingsOf(last.findings).filter((f) => !settled.has(f.key));
  const high = pending.filter((f) => f.severity === "alta").length;
  const medium = pending.filter((f) => f.severity === "media").length;
  const ageDays = daysBetween(last.run_at.slice(0, 10), today);
  const ran = `Corrida el ${formatDate(last.run_at)}.`;

  if (high > 0) {
    return {
      key: `auditoria:${last.id}`,
      tone: "alert",
      title: `${plural(high, "hallazgo grave", "hallazgos graves")} sin resolver`,
      detail: `${ran} ${
        medium > 0 ? `Además, ${plural(medium, "hallazgo medio", "hallazgos medios")}. ` : ""
      }Cada uno dice qué está mal, contra qué norma, y cómo se arregla en la app.`,
      href: AUDITORIA,
      cta: "Ver los hallazgos",
    };
  }
  if (medium > 0) {
    return {
      key: `auditoria:${last.id}`,
      tone: "warn",
      title: `${plural(medium, "hallazgo", "hallazgos")} por revisar`,
      detail: `${ran} Nada grave: son cosas para dejar prolijas antes del cierre o para despachar con un motivo.`,
      href: AUDITORIA,
      cta: "Ver los hallazgos",
    };
  }
  if (ageDays > 45) {
    return {
      key: `auditoria:${last.id}:vieja`,
      tone: "warn",
      title: `La última auditoría es de hace ${plural(ageDays, "día", "días")}`,
      detail: `${ran} Conviene correrla de nuevo antes de cerrar el mes: encuentra lo que se cargó desde entonces.`,
      href: AUDITORIA,
      cta: "Correr la auditoría",
    };
  }
  return null;
}

type EntryLite = {
  id: string;
  account_id: string;
  entry_date: string;
  voided_at: string | null;
  is_opening_balance: boolean;
};

/** El extracto del mes pasado contra el libro, cuenta por cuenta (061). */
async function reconciliationItem(
  supabase: SupabaseClient,
  today: string
): Promise<TreasuryAttentionItem | null> {
  const month = previousMonthKey(monthKeyOf(today));
  const imports = await getImports(supabase);
  if (imports.missing || imports.rows.length === 0) return null;
  const accountsWithImports = new Set(imports.rows.map((i) => i.account_id));

  // Un mes cerrado está congelado: lo que quedó suelto ahí ya no es tarea
  // de este mes.
  const closings = await getClosings(supabase);
  if (closedMonthKeys(closings).includes(month)) return null;

  const range = monthRange(month);
  const [lines, matches, entriesRes, accountsRes] = await Promise.all([
    getStoredLines(supabase),
    getMatches(supabase),
    supabase
      .from("treasury_entries")
      .select("id, account_id, entry_date, voided_at, is_opening_balance")
      .gte("entry_date", range.from)
      .lte("entry_date", range.to),
    supabase.from("treasury_accounts").select("id, name"),
  ]);
  const names = new Map(
    ((accountsRes.data ?? []) as { id: string; name: string }[]).map((a) => [a.id, a.name])
  );
  const statuses = monthReconciliation(
    month,
    lines,
    matches,
    (entriesRes.data ?? []) as EntryLite[],
    names,
    accountsWithImports
  ).filter((s) => s.status !== "conciliado");
  if (statuses.length === 0) return null;

  const parts = statuses.map((s) => {
    if (s.status === "sin-extracto") return `${s.accountName}: sin extracto importado`;
    const bits: string[] = [];
    if (s.pendingLines > 0)
      bits.push(plural(s.pendingLines, "línea del extracto sin movimiento", "líneas del extracto sin movimiento"));
    if (s.pendingEntries > 0)
      bits.push(plural(s.pendingEntries, "movimiento sin par en el extracto", "movimientos sin par en el extracto"));
    return `${s.accountName}: ${bits.join(" y ")}`;
  });
  const first = statuses[0];
  return {
    key: `conciliacion:${month}`,
    tone: "warn",
    title: `Conciliación pendiente de ${monthLabel(month).toLowerCase()}`,
    detail: `${parts.join(" · ")}. El extracto es la única verificación externa del libro; conviene dejarlo cerrado antes del cierre del mes.`,
    href: `${CONCILIACION}?cuenta=${first.accountId}`,
    cta: "Ir a Conciliación",
  };
}

type FeastLite = { id: string; bahai_month_name: string; gregorian_date: string | null };

/** El estado del Fondo que la comunidad ve (066): ¿está al día? */
async function publicationItem(
  supabase: SupabaseClient,
  localityId: string,
  localityKind: string,
  today: string
): Promise<TreasuryAttentionItem | null> {
  const current = await getCurrentPublication(supabase, localityId);

  // En una Asamblea Local la referencia es la Fiesta: el estado del Fondo
  // se presenta ahí, así que lo publicado tiene que ser posterior a la
  // última celebrada. La Comunidad Nacional no tiene Fiesta (056): ahí la
  // regla es "no más de un mes bahá'í y pico sin compartir".
  let lastFeast: FeastLite | null = null;
  if (localityKind !== "nacional") {
    const { data } = await supabase
      .from("feasts")
      .select("id, bahai_month_name, gregorian_date")
      .not("gregorian_date", "is", null)
      .lte("gregorian_date", today)
      .order("gregorian_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    lastFeast = (data as FeastLite | null) ?? null;
  }

  if (!current) {
    return {
      key: "publicar:none",
      tone: "warn",
      title: "El estado del Fondo nunca se compartió",
      detail:
        "La comunidad ve en Tesorería solo lo que el tesorero calcula y comparte desde Publicar: hasta entonces, la pantalla dice que todavía no hay cifras.",
      href: PUBLICAR,
      cta: "Calcular y compartir",
    };
  }
  const publishedDay = (current.published_at ?? current.calculated_at ?? "").slice(0, 10);
  if (lastFeast?.gregorian_date && publishedDay < lastFeast.gregorian_date) {
    return {
      key: `publicar:${lastFeast.id}`,
      tone: "warn",
      title: "Falta compartir el estado del Fondo",
      detail: `Lo último que vio la comunidad es del ${formatDate(publishedDay)}; la Fiesta de ${lastFeast.bahai_month_name} fue el ${formatDate(lastFeast.gregorian_date)}. Calculá hasta el fin del último mes bahá'í y compartí.`,
      href: PUBLICAR,
      cta: "Calcular y compartir",
    };
  }
  if (!lastFeast && daysBetween(publishedDay, today) > 35) {
    return {
      key: `publicar:${monthKeyOf(today)}`,
      tone: "warn",
      title: "Falta compartir el estado del Fondo",
      detail: `Lo último que vio la comunidad es del ${formatDate(publishedDay)}, hace más de un mes.`,
      href: PUBLICAR,
      cta: "Calcular y compartir",
    };
  }
  return null;
}

/** Aportes con número de recibo cuyo papel nunca se marcó emitido. */
async function receiptsItem(supabase: SupabaseClient): Promise<TreasuryAttentionItem | null> {
  const { count, error } = await supabase
    .from("treasury_entries")
    .select("id", { count: "exact", head: true })
    .not("receipt_number", "is", null)
    .eq("receipt_issued", false)
    .is("voided_at", null)
    .gt("amount", 0);
  if (error || !count) return null;
  return {
    key: `recibos:${count}`,
    tone: "warn",
    title: `${plural(count, "recibo sin emitir", "recibos sin emitir")}`,
    detail:
      "Aportes que ya tienen número pero cuyo recibo no se marcó como emitido. Abrilo desde el Libro, compartilo con quien aportó y marcalo: así queda registrado quién lo emitió.",
    href: LIBRO,
    cta: "Ir al Libro",
  };
}

/** Pasado el 10, el informe de compromisos del mes: agradecer y recordar (063). */
async function commitmentsItem(
  supabase: SupabaseClient,
  localityId: string,
  today: string
): Promise<TreasuryAttentionItem | null> {
  const day = parseInt(today.slice(8, 10), 10);
  if (day < 11) return null;
  const { count, error } = await supabase
    .from("treasury_commitments")
    .select("locality_id", { count: "exact", head: true })
    .eq("locality_id", localityId);
  if (error || !count) return null;
  const month = monthKeyOf(today);
  return {
    key: `compromisos:${month}`,
    tone: "warn",
    title: `Compromisos de ${monthLabel(month).toLowerCase()}`,
    detail: `${plural(count, "persona tiene", "personas tienen")} un compromiso mensual. El informe dice a quién agradecer y a quién recordar; a quien usa la app el aviso del 10 ya le llegó, a los demás les recordás desde ahí. Ocultá esta tarjeta cuando lo hayas mirado.`,
    href: COMPROMISOS,
    cta: "Ver el informe del mes",
  };
}

/** La carta semestral a la comunidad (marzo y octubre): estado del Fondo,
 *  necesidades y agradecimiento. Es una costumbre de la Asamblea, no un
 *  dato: la tarjeta solo recuerda, y se oculta cuando se mandó. */
function letterItem(today: string): TreasuryAttentionItem | null {
  const month = today.slice(5, 7);
  if (month !== "03" && month !== "10") return null;
  return {
    key: `carta:${monthKeyOf(today)}`,
    tone: "warn",
    title: "La carta semestral a la comunidad",
    detail:
      "En marzo y en octubre la Asamblea le escribe a la comunidad: el estado del Fondo, las necesidades del ejercicio, y el agradecimiento por las contribuciones y los sacrificios. Se manda como comunicado, con las cifras de la última publicación. Ocultá la tarjeta cuando salga.",
    href: "/admin/comunicados/nuevo",
    cta: "Escribir el comunicado",
  };
}

/** Cajas chicas (074): rendiciones por revisar y cajas sin arqueo. */
async function cashItems(supabase: SupabaseClient, today: string): Promise<TreasuryAttentionItem[]> {
  const { boxes, missing } = await getCashBoxes(supabase);
  if (missing || boxes.length === 0) return [];
  const [pending, lastCounts, accountsRes] = await Promise.all([
    getCashReports(supabase, { statuses: ["enviada"] }),
    getLastCounts(supabase),
    supabase.from("treasury_accounts").select("id, name"),
  ]);
  const names = new Map(
    ((accountsRes.data ?? []) as { id: string; name: string }[]).map((a) => [a.id, a.name])
  );
  const nameOf = (boxId: string) => {
    const b = boxes.find((x) => x.id === boxId);
    return (b && names.get(b.account_id)) || "Caja chica";
  };
  const items: TreasuryAttentionItem[] = [];

  if (pending.length > 0) {
    const oldest = [...pending].sort((a, b) => (a.submitted_at ?? "").localeCompare(b.submitted_at ?? ""))[0];
    const days = oldest.submitted_at ? daysBetween(oldest.submitted_at.slice(0, 10), today) : 0;
    items.push({
      key: `rendiciones:${pending.length}:${oldest.id}`,
      tone: days > 7 ? "alert" : "warn",
      title:
        pending.length === 1
          ? "Una rendición de caja chica por revisar"
          : `${pending.length} rendiciones de caja chica por revisar`,
      detail: `${nameOf(oldest.box_id)} la envió hace ${plural(days, "día", "días")}. Mientras no se apruebe, sus gastos no están en el libro y la caja no se repone.`,
      href:
        pending.length === 1
          ? `/admin/tesoreria/cajas/${oldest.box_id}/rendicion/${oldest.id}`
          : "/admin/tesoreria/cajas",
      cta: "Revisar",
    });
  }

  const stale = boxes.filter((b) => {
    const c = lastCounts.get(b.id);
    return !c || daysBetween(c.counted_on, today) > 35;
  });
  if (stale.length > 0) {
    items.push({
      key: `arqueo:${monthKeyOf(today)}`,
      tone: "warn",
      title:
        stale.length === 1
          ? `${nameOf(stale[0].id)}: sin arqueo este mes`
          : `${stale.length} cajas chicas sin arqueo este mes`,
      detail:
        "Contar el efectivo y compararlo con el libro, con fecha. Es lo que da confianza sobre las cajas; conviene hacerlo antes del cierre del mes.",
      href: stale.length === 1 ? `/admin/tesoreria/cajas/${stale[0].id}` : "/admin/tesoreria/cajas",
      cta: "Hacer el arqueo",
    });
  }
  return items;
}

// ─── Ocultas ─────────────────────────────────────────────────────

async function getDismissedKeys(
  supabase: SupabaseClient,
  userId: string,
  localityId: string
): Promise<{ keys: Set<string>; ready: boolean }> {
  const { data, error } = await supabase
    .from("admin_attention_dismissals")
    .select("item_key")
    .eq("user_id", userId)
    .eq("locality_id", localityId);
  if (error) {
    // Hasta la 072 la tabla no existe: se muestran todas y no se ocultan.
    if (error.code !== "42P01" && error.code !== "PGRST205") {
      console.warn("[treasury-attention] dismissals:", error.message);
    }
    return { keys: new Set(), ready: false };
  }
  return {
    keys: new Set(((data ?? []) as { item_key: string }[]).map((r) => r.item_key)),
    ready: true,
  };
}

// ─── Todo junto ──────────────────────────────────────────────────

async function safe<T>(label: string, p: Promise<T | null>): Promise<T | null> {
  try {
    return await p;
  } catch (e) {
    console.warn(`[treasury-attention] ${label}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

export async function getTreasuryAttention(
  supabase: SupabaseClient,
  opts: { userId: string; localityId: string; localityKind: string; today?: string }
): Promise<TreasuryAttention> {
  const today = opts.today ?? todayISO();
  const [closing, audit, reconciliation, publication, receipts, commitments, cash, dismissed] =
    await Promise.all([
      safe("cierre", closingItem(supabase, today)),
      safe("auditoria", auditItem(supabase, today)),
      safe("conciliacion", reconciliationItem(supabase, today)),
      safe("publicar", publicationItem(supabase, opts.localityId, opts.localityKind, today)),
      safe("recibos", receiptsItem(supabase)),
      safe("compromisos", commitmentsItem(supabase, opts.localityId, today)),
      safe("cajas", cashItems(supabase, today)),
      getDismissedKeys(supabase, opts.userId, opts.localityId),
    ]);

  // Orden: lo grave primero; a igual tono, el orden del ciclo del mes.
  const all = [closing, audit, ...(cash ?? []), reconciliation, publication, receipts, commitments, letterItem(today)].filter(
    (x): x is TreasuryAttentionItem => x !== null
  );
  const rank = (t: AttentionTone) => (t === "alert" ? 0 : 1);
  all.sort((a, b) => rank(a.tone) - rank(b.tone));

  return {
    items: all.filter((i) => !dismissed.keys.has(i.key)),
    hidden: all.filter((i) => dismissed.keys.has(i.key)),
    canHide: dismissed.ready,
  };
}
