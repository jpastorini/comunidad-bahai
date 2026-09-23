import { addMoney, formatMoney } from "./treasury-format";
import {
  buildCashbook,
  monthKeyOf,
  monthKeysBetween,
  monthLabel,
  monthRange,
  previousMonthKey,
  snapshotMismatches,
  type CashbookEntry,
  type CashbookNames,
} from "./treasury-cashbook";
import { treasuryMonths, treasuryYearEnd, treasuryYearStart } from "./treasury-year";

/**
 * Auditoría de Tesorería — el motor de reglas (migración 059).
 *
 * LAS REGLAS ENCUENTRAN, EL MODELO PRIORIZA Y REDACTA. Todo lo de acá es
 * determinista: 53 funciones puras sobre datos ya cargados, sin queries,
 * sin red y sin costo. El modelo recibe DESPUÉS la lista cerrada de
 * hallazgos y solo puede agrupar, priorizar y explicar; no puede agregar
 * uno que no venía ni recalcular una cifra. Es la misma garantía que hace
 * confiable al buscador de pasajes, y por la misma razón: acá un falso
 * positivo es caro, porque manda al tesorero a buscar un problema que no
 * existe y le quita la confianza a la herramienta entera.
 *
 * Dos detalles del contrato que importan más de lo que parecen:
 *
 *  · `key` TIENE QUE SER ESTABLE entre corridas. Es lo que permite
 *    despachar un hallazgo ("no aplica") y que no vuelva a aparecer. Se
 *    deriva del código de la regla más la identidad de aquello de lo que
 *    habla —el número de recibo, el id del asiento, la clave del mes—,
 *    NUNCA del índice en una lista ni de la fecha de la corrida.
 *
 *  · `today` entra por el contexto y no lo averigua la regla. Si una
 *    regla llamara a `new Date()` no se podría testear y dos reglas
 *    podrían discrepar sobre qué día es. Mismo criterio que el `as_of`
 *    resuelto de `treasury_progress()`.
 *
 * Alcance por comunidad: la Comunidad Nacional (056) es una localidad más
 * y hereda el libro entero, así que casi todas las reglas corren igual.
 * Las cuatro que salen del estatuto de una Asamblea Local o de la Fiesta
 * de los 19 Días llevan `appliesTo: "ael"` y se apagan solas — asumirle a
 * la AEN el 17 de abril de Montevideo sería inventarlo.
 *
 * Módulo PURO a propósito (sin "server-only"): la pantalla de cierres lo
 * corre en el servidor, pero la de auditoría puede mostrar los hallazgos
 * sin volver a pedirlos.
 */

// ═══ Contrato ═══════════════════════════════════════════════════════

export type Severity = "alta" | "media" | "baja";

/** Contra qué se mide el hallazgo. */
export type AuditBasis = "MEC" | "DGI" | "ESTATUTOS" | "INTERNO";

/** En qué clase de comunidad corre la regla. */
export type AuditScope = "ael" | "nacional" | "ambas";

export type Finding = {
  /** La clase de problema. Estable para siempre. */
  code: string;
  /** ESTE problema. Estable entre corridas: es la clave del despacho. */
  key: string;
  severity: Severity;
  basis: AuditBasis;
  /** En palabras del tesorero, sin jerga de base de datos. */
  title: string;
  detail: string;
  /** A qué movimientos linkea la pantalla. */
  entryIds: string[];
  /** Cifras YA calculadas. El modelo no las recalcula. */
  figures?: Record<string, string | number>;
};

export type Rule = {
  code: string;
  label: string;
  severity: Severity;
  basis: AuditBasis;
  /** Default "ambas". */
  appliesTo?: AuditScope;
  run(ctx: AuditInput): Finding[];
};

// ─── Lo que recibe el motor ──────────────────────────────────────

/**
 * Un movimiento, con todo lo que miran las reglas. Es un superconjunto
 * de `CashbookEntry`, así que `buildCashbook()` lo consume tal cual.
 */
export type AuditEntry = CashbookEntry & {
  bahai_year: number | null;
  category_id: string | null;
  fund_id: string | null;
  contributor_id: string | null;
  receipt_issued: boolean;
  receipt_issued_at: string | null;
  void_reason: string | null;
  adjustment_reason: string | null;
  created_at: string;
  updated_at: string;
};

type NamedRow = { id: string; name: string; is_active: boolean };

export type AuditCatalog = {
  accounts: NamedRow[];
  funds: NamedRow[];
  categories: NamedRow[];
  subcategories: Array<NamedRow & { category_id: string }>;
  contributors: Array<{
    id: string;
    name: string;
    kind: string;
    profile_id: string | null;
    is_active: boolean;
  }>;
};

export type AuditAttachment = {
  id: string;
  entry_id: string;
  storage_path: string;
  amount: number | null;
};

/** Estructuralmente compatible con `TreasuryClosing` (server-only). */
export type AuditClosing = {
  id: string;
  period_month: string;
  status: "closed" | "reopened";
  closed_at: string;
  snapshot: unknown;
  reopened_at: string | null;
  reopen_reason: string | null;
};

export type AuditReport = {
  id: string;
  title: string;
  audience: "comunidad" | "internos" | "balance";
  status: "draft" | "published";
  period_from: string;
  period_to: string;
  updated_at: string;
  editorial: Record<string, unknown> | null;
  snapshot: Record<string, unknown> | null;
};

export type AuditBudget = {
  id: string;
  period: string;
  items: Array<{
    id: string;
    category: string;
    planned_amount: number;
    spent_amount: number;
    ledger_category_id: string | null;
    ledger_subcategory_id: string | null;
  }>;
} | null;

export type AuditGoal = {
  id: string;
  title: string;
  status: string;
  target_amount: number | null;
  ledger_fund_id: string | null;
  ledger_category_id: string | null;
  ledger_subcategory_id: string | null;
};

export type AuditLegal = {
  registered_name: string | null;
  rut: string | null;
  fiscal_address: string | null;
  statutes_path: string | null;
} | null;

export type AuditAssembly = {
  bahaiYear: number;
  members: Array<{
    position: number;
    display_name: string;
    profile_id: string | null;
    office: string | null;
  }>;
} | null;

export type AuditInput = {
  locality: { id: string; name: string; kind: "ael" | "nacional" };
  /** Rango auditado. */
  from: string;
  to: string;
  /** Ejercicio contable (Riḍván a Riḍván) que cubre el rango. */
  bahaiYear: number;
  /** Hoy, resuelto afuera. Ninguna regla llama a `new Date()`. */
  today: string;

  /**
   * TODO el libro hasta `to`, no solo el rango. Los saldos son
   * acumulados y la serie de recibos no empieza donde empieza el rango:
   * si se cargara solo el rango, la regla de huecos inventaría uno en
   * cada borde.
   */
  entries: AuditEntry[];
  catalog: AuditCatalog;
  attachments: AuditAttachment[];
  closings: AuditClosing[];
  reports: AuditReport[];
  budget: AuditBudget;
  goals: AuditGoal[];
  legal: AuditLegal;
  assembly: AuditAssembly;

  /**
   * Los creyentes contra los que se compara un contribuyente suelto. El
   * cargador decide el universo igual que el buscador del libro: el
   * padrón por membresía en una AEL, TODO EL PAÍS en la Nacional (058).
   */
  roster: Array<{ id: string; full_name: string | null }>;

  /**
   * ⚠️ Los `profile_id` con `can_manage_treasury` EN ESTA COMUNIDAD,
   * leídos de `profile_localities` y no de `profiles`. El tag es de la
   * membresía desde la 055: el tesorero nacional lo tiene en la Comunidad
   * Nacional y no en su Asamblea Local, así que preguntárselo al sombrero
   * puesto haría que la auditoría lo declare sin permisos cada vez que
   * ande con el otro. Es el mismo arrastre que la 058 corrigió dentro de
   * `my_receipt()`.
   */
  treasuryTagHolders: string[];

  /** Comprobantes cuyo archivo ya no está en el bucket. Lo averigua el
   *  cargador, que sí sale a Storage. */
  missingAttachmentPaths?: string[];
};

export type AuditResult = {
  findings: Finding[];
  counts: { alta: number; media: number; baja: number; total: number };
  /** Reglas que reventaron. Una regla rota no tumba la auditoría. */
  failed: Array<{ code: string; message: string }>;
  ranAt: string;
};

// ═══ Helpers ════════════════════════════════════════════════════════

const EPS = 0.005;

function nameMap(rows: Array<{ id: string; name: string }>): Map<string, string> {
  return new Map(rows.map((r) => [r.id, r.name]));
}

function accountName(ctx: AuditInput, id: string | null): string {
  return (id && nameMap(ctx.catalog.accounts).get(id)) || "una cuenta";
}

function subcategoryName(ctx: AuditInput, id: string | null): string {
  return (id && nameMap(ctx.catalog.subcategories).get(id)) || "sin rubro";
}

/** Los movimientos vivos: un anulado no suma en nada. */
function live(ctx: AuditInput): AuditEntry[] {
  return ctx.entries.filter((e) => !e.voided_at);
}

/** Los del rango auditado (vivos). */
function inRange(ctx: AuditInput): AuditEntry[] {
  return live(ctx).filter((e) => e.entry_date >= ctx.from && e.entry_date <= ctx.to);
}

function isTransfer(e: AuditEntry): boolean {
  return !!e.transfer_group_id;
}

/** Un movimiento "ordinario": ni transferencia ni saldo de apertura. */
function isOrdinary(e: AuditEntry): boolean {
  return !isTransfer(e) && !e.is_opening_balance;
}

function blank(s: string | null | undefined): boolean {
  return !s || s.trim() === "";
}

function daysBefore(iso: string, today: string, days: number): boolean {
  const t = Date.parse(today);
  const d = Date.parse(iso.slice(0, 10));
  if (Number.isNaN(t) || Number.isNaN(d)) return false;
  return (t - d) / 86_400_000 > days;
}

function shortDate(iso: string): string {
  return iso.slice(0, 10).split("-").reverse().join("/");
}

/** Normaliza un nombre para comparar: sin acentos, sin dobles espacios. */
function normalizeName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Distancia de edición acotada: alcanza para "Juan Pérez" vs "Juan Perez". */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 3) return 99;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diag + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diag = tmp;
    }
  }
  return prev[b.length];
}

function cashbookNames(ctx: AuditInput): CashbookNames {
  return {
    accounts: nameMap(ctx.catalog.accounts),
    subcategories: nameMap(ctx.catalog.subcategories),
  };
}

// ═══ A · Cierres e inmutabilidad ════════════════════════════════════

const A: Rule[] = [
  {
    code: "MES_SIN_CERRAR",
    label: "Meses terminados sin cerrar",
    severity: "alta",
    basis: "MEC",
    run(ctx) {
      const dates = ctx.entries.map((e) => e.entry_date).sort();
      if (dates.length === 0) return [];
      const firstMonth = monthKeyOf(dates[0]);
      const lastClosable = monthKeyOf(ctx.today);
      const closed = new Set(
        ctx.closings.filter((c) => c.status === "closed").map((c) => monthKeyOf(c.period_month))
      );
      const out: Finding[] = [];
      for (const month of monthKeysBetween(firstMonth, previousMonthKey(lastClosable))) {
        if (closed.has(month)) continue;
        // Solo meses ya transcurridos enteros.
        if (monthRange(month).to >= ctx.today) continue;
        out.push({
          code: "MES_SIN_CERRAR",
          key: `MES_SIN_CERRAR:${month}`,
          severity: "alta",
          basis: "MEC",
          title: `${monthLabel(month)} terminó y no se cerró`,
          detail:
            "El instructivo del MEC pide cierre mensual por mes civil. Un mes abierto es un mes que todavía se puede editar hacia atrás.",
          entryIds: [],
          figures: { mes: month },
        });
      }
      return out;
    },
  },
  {
    code: "CIERRE_DESCUADRADO",
    label: "El saldo congelado no coincide con el libro",
    severity: "alta",
    basis: "MEC",
    run(ctx) {
      const names = cashbookNames(ctx);
      const out: Finding[] = [];
      for (const c of ctx.closings) {
        if (c.status !== "closed") continue;
        const month = monthKeyOf(c.period_month);
        const book = buildCashbook(ctx.entries, month, names);
        for (const m of snapshotMismatches(book, c.snapshot)) {
          out.push({
            code: "CIERRE_DESCUADRADO",
            key: `CIERRE_DESCUADRADO:${month}:${m.account}:${m.currency}`,
            severity: "alta",
            basis: "MEC",
            title: `El cierre de ${monthLabel(month)} ya no coincide con el libro`,
            detail: `${m.account} cerró en ${formatMoney(m.was, m.currency)} y hoy el libro da ${formatMoney(m.now, m.currency)}. Algo cambió dentro de un mes cerrado.`,
            entryIds: [],
            figures: { mes: month, cuenta: m.account, cerro: m.was, hoy: m.now },
          });
        }
      }
      return out;
    },
  },
  {
    code: "CIERRE_FUERA_DE_ORDEN",
    label: "Un mes cerrado saltea otro anterior",
    severity: "media",
    basis: "MEC",
    run(ctx) {
      const dates = ctx.entries.map((e) => e.entry_date).sort();
      if (dates.length === 0) return [];
      const firstMonth = monthKeyOf(dates[0]);
      const closed = ctx.closings
        .filter((c) => c.status === "closed")
        .map((c) => monthKeyOf(c.period_month))
        .sort();
      const set = new Set(closed);
      const out: Finding[] = [];
      for (const month of closed) {
        const prev = previousMonthKey(month);
        if (prev < firstMonth) continue;
        if (set.has(prev)) continue;
        out.push({
          code: "CIERRE_FUERA_DE_ORDEN",
          key: `CIERRE_FUERA_DE_ORDEN:${month}`,
          severity: "media",
          basis: "MEC",
          title: `${monthLabel(month)} está cerrado y ${monthLabel(prev)} no`,
          detail:
            "Los cierres son consecutivos por diseño: el saldo anterior de cada hoja solo es firme si el mes previo ya está cerrado.",
          entryIds: [],
          figures: { mes: month, anterior: prev },
        });
      }
      return out;
    },
  },
  {
    code: "REABIERTO_SIN_RECERRAR",
    label: "Un mes reabierto quedó abierto",
    severity: "alta",
    basis: "MEC",
    run(ctx) {
      const closed = new Set(
        ctx.closings.filter((c) => c.status === "closed").map((c) => monthKeyOf(c.period_month))
      );
      const out: Finding[] = [];
      for (const c of ctx.closings) {
        if (c.status !== "reopened") continue;
        const month = monthKeyOf(c.period_month);
        if (closed.has(month)) continue;
        out.push({
          code: "REABIERTO_SIN_RECERRAR",
          key: `REABIERTO_SIN_RECERRAR:${month}`,
          severity: "alta",
          basis: "MEC",
          title: `${monthLabel(month)} se reabrió y sigue abierto`,
          detail: `Motivo declarado: «${c.reopen_reason ?? "sin motivo"}». Mientras no se vuelva a cerrar, el libro no tiene cierre válido de ese período.`,
          entryIds: [],
          figures: { mes: month },
        });
      }
      return out;
    },
  },
  {
    code: "MES_REABIERTO",
    label: "Registro de reaperturas",
    severity: "baja",
    basis: "MEC",
    run(ctx) {
      return ctx.closings
        .filter((c) => c.reopened_at)
        .map((c) => {
          const month = monthKeyOf(c.period_month);
          return {
            code: "MES_REABIERTO",
            key: `MES_REABIERTO:${c.id}`,
            severity: "baja" as const,
            basis: "MEC" as const,
            title: `${monthLabel(month)} se reabrió el ${shortDate(c.reopened_at ?? "")}`,
            detail: `Motivo: «${c.reopen_reason ?? "sin motivo"}». No es un error: es un hecho que un auditor externo va a querer ver enumerado.`,
            entryIds: [],
            figures: { mes: month },
          };
        });
    },
  },
  {
    code: "MOVIMIENTO_EN_MES_CERRADO",
    label: "Un asiento se modificó después del cierre",
    severity: "alta",
    basis: "MEC",
    run(ctx) {
      const closedAt = new Map<string, string>();
      for (const c of ctx.closings) {
        if (c.status !== "closed") continue;
        closedAt.set(monthKeyOf(c.period_month), c.closed_at);
      }
      const out: Finding[] = [];
      for (const e of ctx.entries) {
        const at = closedAt.get(monthKeyOf(e.entry_date));
        if (!at) continue;
        if (e.updated_at <= at) continue;
        // Marcar el recibo como emitido no cambia el libro y el trigger
        // lo permite a propósito: no es una tachadura.
        if (e.receipt_issued_at && e.receipt_issued_at >= at && e.updated_at <= e.receipt_issued_at)
          continue;
        out.push({
          code: "MOVIMIENTO_EN_MES_CERRADO",
          key: `MOVIMIENTO_EN_MES_CERRADO:${e.id}`,
          severity: "alta",
          basis: "MEC",
          title: `Un movimiento del ${shortDate(e.entry_date)} se tocó después de cerrar el mes`,
          detail: `${accountName(ctx, e.account_id)} · ${formatMoney(e.amount, e.currency)}. Se modificó el ${shortDate(e.updated_at)}, con el mes ya cerrado. Es lo que la norma llama tachadura.`,
          entryIds: [e.id],
        });
      }
      return out;
    },
  },
  {
    code: "CONTRA_ASIENTO_SIN_MOTIVO",
    label: "Una corrección no dice qué corrige",
    severity: "alta",
    basis: "MEC",
    run(ctx) {
      return ctx.entries
        .filter((e) => e.adjusts_entry_id && blank(e.adjustment_reason))
        .map((e) => ({
          code: "CONTRA_ASIENTO_SIN_MOTIVO",
          key: `CONTRA_ASIENTO_SIN_MOTIVO:${e.id}`,
          severity: "alta" as const,
          basis: "MEC" as const,
          title: `El contra-asiento del ${shortDate(e.entry_date)} no explica por qué`,
          detail:
            "Sin motivo queda un movimiento espejo inexplicable, que es peor que el error que vino a corregir.",
          entryIds: [e.id, e.adjusts_entry_id ?? ""].filter(Boolean),
        }));
    },
  },
  {
    code: "CONTRA_ASIENTO_DESCUADRADO",
    label: "La corrección no revierte al original",
    severity: "alta",
    basis: "INTERNO",
    run(ctx) {
      const byId = new Map(ctx.entries.map((e) => [e.id, e]));
      const out: Finding[] = [];
      for (const e of ctx.entries) {
        if (!e.adjusts_entry_id) continue;
        const orig = byId.get(e.adjusts_entry_id);
        if (!orig) continue;
        const diffs: string[] = [];
        if (Math.abs(addMoney(e.amount, orig.amount)) >= EPS) diffs.push("el monto no se cancela");
        if (e.account_id !== orig.account_id) diffs.push("cambia de cuenta");
        if (e.currency !== orig.currency) diffs.push("cambia de moneda");
        if (e.subcategory_id !== orig.subcategory_id) diffs.push("cambia de rubro");
        if ((e.fund_id ?? null) !== (orig.fund_id ?? null)) diffs.push("cambia de fondo");
        if (diffs.length === 0) continue;
        out.push({
          code: "CONTRA_ASIENTO_DESCUADRADO",
          key: `CONTRA_ASIENTO_DESCUADRADO:${e.id}`,
          severity: "alta",
          basis: "INTERNO",
          title: `El contra-asiento del ${shortDate(e.entry_date)} no deja el saldo como estaba`,
          detail: `${diffs.join(", ")}. Una corrección que difiere del original introduce un segundo error.`,
          entryIds: [e.id, orig.id],
          figures: { original: orig.amount, correccion: e.amount },
        });
      }
      return out;
    },
  },
  {
    code: "REVERSION_DUPLICADA",
    label: "Dos contra-asientos para el mismo movimiento",
    severity: "media",
    basis: "INTERNO",
    run(ctx) {
      const byTarget = new Map<string, AuditEntry[]>();
      for (const e of ctx.entries) {
        if (!e.adjusts_entry_id) continue;
        const list = byTarget.get(e.adjusts_entry_id) ?? [];
        list.push(e);
        byTarget.set(e.adjusts_entry_id, list);
      }
      const out: Finding[] = [];
      for (const [target, list] of byTarget) {
        if (list.length < 2) continue;
        out.push({
          code: "REVERSION_DUPLICADA",
          key: `REVERSION_DUPLICADA:${target}`,
          severity: "media",
          basis: "INTERNO",
          title: "Un mismo movimiento tiene dos correcciones",
          detail: `${list.length} contra-asientos apuntan al mismo original: el saldo queda desviado por el monto de más.`,
          entryIds: [target, ...list.map((e) => e.id)],
        });
      }
      return out;
    },
  },
];

// ═══ B · Recibos y numeración ═══════════════════════════════════════

const B: Rule[] = [
  {
    code: "RECIBO_HUECO",
    label: "Falta un número en la serie",
    severity: "alta",
    basis: "DGI",
    run(ctx) {
      // Los ANULADOS cuentan como usados: que conserven el número es
      // justamente para qué existe `voided_at`.
      const used = ctx.entries
        .map((e) => e.receipt_number)
        .filter((n): n is number => typeof n === "number")
        .sort((a, b) => a - b);
      const out: Finding[] = [];
      for (let i = 1; i < used.length; i++) {
        const prev = used[i - 1];
        const cur = used[i];
        // Un tope defensivo: una serie corrompida no puede generar
        // millones de hallazgos.
        if (cur - prev > 500) continue;
        for (let n = prev + 1; n < cur; n++) {
          out.push({
            code: "RECIBO_HUECO",
            key: `RECIBO_HUECO:${n}`,
            severity: "alta",
            basis: "DGI",
            title: `No existe el recibo N.º ${n}`,
            detail: `La serie salta del ${prev} al ${cur}. La explicación aceptable en una inspección es un recibo anulado, no un vacío.`,
            entryIds: [],
            figures: { numero: n },
          });
        }
      }
      return out;
    },
  },
  {
    code: "RECIBO_DUPLICADO",
    label: "Dos aportes con el mismo número",
    severity: "alta",
    basis: "DGI",
    run(ctx) {
      const byNumber = new Map<number, AuditEntry[]>();
      for (const e of ctx.entries) {
        if (typeof e.receipt_number !== "number") continue;
        const list = byNumber.get(e.receipt_number) ?? [];
        list.push(e);
        byNumber.set(e.receipt_number, list);
      }
      const out: Finding[] = [];
      for (const [n, list] of byNumber) {
        if (list.length < 2) continue;
        out.push({
          code: "RECIBO_DUPLICADO",
          key: `RECIBO_DUPLICADO:${n}`,
          severity: "alta",
          basis: "DGI",
          title: `El recibo N.º ${n} está usado ${list.length} veces`,
          detail: "Dos personas con el mismo comprobante en la mano.",
          entryIds: list.map((e) => e.id),
          figures: { numero: n },
        });
      }
      return out;
    },
  },
  {
    code: "APORTE_SIN_RECIBO",
    label: "Entró plata sin número de recibo",
    severity: "alta",
    basis: "DGI",
    run(ctx) {
      return live(ctx)
        .filter((e) => e.amount > 0 && isOrdinary(e) && e.receipt_number == null)
        .map((e) => ({
          code: "APORTE_SIN_RECIBO",
          key: `APORTE_SIN_RECIBO:${e.id}`,
          severity: "alta" as const,
          basis: "DGI" as const,
          title: `Un aporte del ${shortDate(e.entry_date)} no tiene número`,
          detail: `${formatMoney(e.amount, e.currency)} · ${subcategoryName(ctx, e.subcategory_id)}. Todo aporte lleva recibo; desde la 054 el número se asigna solo al guardar.`,
          entryIds: [e.id],
        }));
    },
  },
  {
    code: "ANULADO_SIN_MOTIVO",
    label: "Un anulado no dice por qué",
    severity: "alta",
    basis: "DGI",
    run(ctx) {
      return ctx.entries
        .filter((e) => e.voided_at && blank(e.void_reason))
        .map((e) => ({
          code: "ANULADO_SIN_MOTIVO",
          key: `ANULADO_SIN_MOTIVO:${e.id}`,
          severity: "alta" as const,
          basis: "DGI" as const,
          title: `El recibo N.º ${e.receipt_number ?? "—"} se anuló sin motivo`,
          detail:
            "La anulación es lo que convierte un hueco en algo explicable, y solo funciona con el motivo escrito.",
          entryIds: [e.id],
        }));
    },
  },
  {
    code: "RECIBO_EMITIDO_MODIFICADO",
    label: "Se editó un movimiento con recibo entregado",
    severity: "alta",
    basis: "DGI",
    run(ctx) {
      return ctx.entries
        .filter(
          (e) =>
            !e.voided_at &&
            e.receipt_issued_at != null &&
            e.updated_at > e.receipt_issued_at
        )
        .map((e) => ({
          code: "RECIBO_EMITIDO_MODIFICADO",
          key: `RECIBO_EMITIDO_MODIFICADO:${e.id}`,
          severity: "alta" as const,
          basis: "DGI" as const,
          title: `El recibo N.º ${e.receipt_number ?? "—"} cambió después de entregarse`,
          detail: `Se emitió el ${shortDate(e.receipt_issued_at ?? "")} y el movimiento se modificó el ${shortDate(e.updated_at)}. El papel que tiene el creyente ya no coincide con el libro: el camino es anular y emitir de nuevo.`,
          entryIds: [e.id],
        }));
    },
  },
  {
    code: "SERIE_NO_CRONOLOGICA",
    label: "La serie retrocede en el tiempo",
    severity: "media",
    basis: "DGI",
    run(ctx) {
      const withNumber = ctx.entries
        .filter((e): e is AuditEntry & { receipt_number: number } =>
          typeof e.receipt_number === "number"
        )
        .sort((a, b) => a.receipt_number - b.receipt_number);
      const out: Finding[] = [];
      for (let i = 1; i < withNumber.length; i++) {
        const prev = withNumber[i - 1];
        const cur = withNumber[i];
        if (cur.entry_date >= prev.entry_date) continue;
        out.push({
          code: "SERIE_NO_CRONOLOGICA",
          key: `SERIE_NO_CRONOLOGICA:${cur.receipt_number}`,
          severity: "media",
          basis: "DGI",
          title: `El recibo N.º ${cur.receipt_number} es anterior al N.º ${prev.receipt_number}`,
          detail: `${shortDate(cur.entry_date)} contra ${shortDate(prev.entry_date)}. Casi siempre es una fecha mal tipeada.`,
          entryIds: [cur.id, prev.id],
        });
      }
      return out;
    },
  },
  {
    code: "RECIBO_SIN_CONTRIBUYENTE",
    label: "Un recibo sin nombre",
    severity: "media",
    basis: "DGI",
    run(ctx) {
      return live(ctx)
        .filter(
          (e) =>
            e.receipt_number != null &&
            e.amount > 0 &&
            !e.contributor_id &&
            e.contributions_count <= 1
        )
        .map((e) => ({
          code: "RECIBO_SIN_CONTRIBUYENTE",
          key: `RECIBO_SIN_CONTRIBUYENTE:${e.id}`,
          severity: "media" as const,
          basis: "DGI" as const,
          title: `El recibo N.º ${e.receipt_number} no dice a nombre de quién`,
          detail:
            "El recibo tiene que identificar al donante. La excepción legítima es la canasta de la Fiesta, que declara cuántos aportes agrupa.",
          entryIds: [e.id],
        }));
    },
  },
  {
    code: "COLECTA_SIN_CONTEO",
    label: "Una colecta sin cuántos aportes agrupa",
    severity: "media",
    basis: "INTERNO",
    run(ctx) {
      const colectas = new Set(
        ctx.catalog.contributors.filter((c) => c.kind === "colecta").map((c) => c.id)
      );
      return live(ctx)
        .filter(
          (e) => e.contributor_id && colectas.has(e.contributor_id) && e.contributions_count === 0
        )
        .map((e) => ({
          code: "COLECTA_SIN_CONTEO",
          key: `COLECTA_SIN_CONTEO:${e.id}`,
          severity: "media" as const,
          basis: "INTERNO" as const,
          title: `Una colecta del ${shortDate(e.entry_date)} no declara cuántos aportes reúne`,
          detail:
            "Lo que justifica que una línea no tenga nombre es decir cuántos aportes agrupa. Sin ese número es un ingreso sin identificar.",
          entryIds: [e.id],
        }));
    },
  },
  {
    code: "ANULADO_NUNCA_EMITIDO",
    label: "Se anuló un recibo que no se imprimió",
    severity: "baja",
    basis: "INTERNO",
    run(ctx) {
      return ctx.entries
        .filter((e) => e.voided_at && !e.receipt_issued)
        .map((e) => ({
          code: "ANULADO_NUNCA_EMITIDO",
          key: `ANULADO_NUNCA_EMITIDO:${e.id}`,
          severity: "baja" as const,
          basis: "INTERNO" as const,
          title: `El recibo N.º ${e.receipt_number ?? "—"} se anuló sin haberse emitido`,
          detail:
            "Informativo. Si el recibo todavía no salió, conviene corregir el movimiento antes de emitirlo en vez de gastar un número de la serie.",
          entryIds: [e.id],
        }));
    },
  },
];

// ═══ C · Integridad del libro ═══════════════════════════════════════

const C: Rule[] = [
  {
    code: "TRANSFERENCIA_HUERFANA",
    label: "Transferencia con una sola pata",
    severity: "alta",
    basis: "INTERNO",
    run(ctx) {
      const groups = new Map<string, AuditEntry[]>();
      for (const e of live(ctx)) {
        if (!e.transfer_group_id) continue;
        const list = groups.get(e.transfer_group_id) ?? [];
        list.push(e);
        groups.set(e.transfer_group_id, list);
      }
      const out: Finding[] = [];
      for (const [gid, list] of groups) {
        if (list.length !== 1) continue;
        const e = list[0];
        out.push({
          code: "TRANSFERENCIA_HUERFANA",
          key: `TRANSFERENCIA_HUERFANA:${gid}`,
          severity: "alta",
          basis: "INTERNO",
          title: `Una transferencia del ${shortDate(e.entry_date)} quedó con una sola pata`,
          detail: `${accountName(ctx, e.account_id)} · ${formatMoney(e.amount, e.currency)}. O falta plata en una cuenta o sobra en otra, y los totales del informe quedan inflados.`,
          entryIds: [e.id],
        });
      }
      return out;
    },
  },
  {
    code: "TRANSFERENCIA_DESCUADRADA",
    label: "Las dos patas no se cancelan",
    severity: "alta",
    basis: "INTERNO",
    run(ctx) {
      const groups = new Map<string, AuditEntry[]>();
      for (const e of live(ctx)) {
        if (!e.transfer_group_id) continue;
        const list = groups.get(e.transfer_group_id) ?? [];
        list.push(e);
        groups.set(e.transfer_group_id, list);
      }
      const out: Finding[] = [];
      for (const [gid, list] of groups) {
        if (list.length !== 2) continue;
        // Entre monedas distintas es legítimo que difieran: el tipo de
        // cambio queda implícito en los dos montos.
        if (list[0].currency !== list[1].currency) continue;
        const sum = addMoney(list[0].amount, list[1].amount);
        if (Math.abs(sum) < EPS) continue;
        out.push({
          code: "TRANSFERENCIA_DESCUADRADA",
          key: `TRANSFERENCIA_DESCUADRADA:${gid}`,
          severity: "alta",
          basis: "INTERNO",
          title: `Una transferencia del ${shortDate(list[0].entry_date)} no cierra`,
          detail: `Las dos patas dejan una diferencia de ${formatMoney(sum, list[0].currency)}. Mover plata de una caja a otra tiene que dejar el total igual.`,
          entryIds: list.map((e) => e.id),
          figures: { diferencia: sum },
        });
      }
      return out;
    },
  },
  {
    code: "TRANSFERENCIA_MULTIPATA",
    label: "Un grupo con más de dos asientos",
    severity: "media",
    basis: "INTERNO",
    run(ctx) {
      const groups = new Map<string, AuditEntry[]>();
      for (const e of live(ctx)) {
        if (!e.transfer_group_id) continue;
        const list = groups.get(e.transfer_group_id) ?? [];
        list.push(e);
        groups.set(e.transfer_group_id, list);
      }
      const out: Finding[] = [];
      for (const [gid, list] of groups) {
        if (list.length <= 2) continue;
        out.push({
          code: "TRANSFERENCIA_MULTIPATA",
          key: `TRANSFERENCIA_MULTIPATA:${gid}`,
          severity: "media",
          basis: "INTERNO",
          title: `Una transferencia tiene ${list.length} asientos`,
          detail:
            "El modelo asume dos patas por operación y borrar una se lleva la otra. Con tres o más, borrar deja restos.",
          entryIds: list.map((e) => e.id),
        });
      }
      return out;
    },
  },
  {
    code: "ASIENTO_SIN_FONDO",
    label: "Un movimiento sin fondo",
    severity: "media",
    basis: "INTERNO",
    run(ctx) {
      return inRange(ctx)
        .filter((e) => isOrdinary(e) && !e.fund_id)
        .map((e) => ({
          code: "ASIENTO_SIN_FONDO",
          key: `ASIENTO_SIN_FONDO:${e.id}`,
          severity: "media" as const,
          basis: "INTERNO" as const,
          title: `Un movimiento del ${shortDate(e.entry_date)} no pertenece a ningún fondo`,
          detail: `${formatMoney(e.amount, e.currency)} · ${subcategoryName(ctx, e.subcategory_id)}. La plata está coloreada por fondo: sin fondo desaparece de los totales y rompe la conciliación.`,
          entryIds: [e.id],
        }));
    },
  },
  {
    code: "RUBRO_INCOHERENTE",
    label: "La categoría no es la de su subcategoría",
    severity: "media",
    basis: "INTERNO",
    run(ctx) {
      const parent = new Map(ctx.catalog.subcategories.map((s) => [s.id, s.category_id]));
      return inRange(ctx)
        .filter((e) => {
          const expected = e.subcategory_id ? parent.get(e.subcategory_id) : undefined;
          return expected != null && e.category_id != null && expected !== e.category_id;
        })
        .map((e) => ({
          code: "RUBRO_INCOHERENTE",
          key: `RUBRO_INCOHERENTE:${e.id}`,
          severity: "media" as const,
          basis: "INTERNO" as const,
          title: `El rubro del ${shortDate(e.entry_date)} no cuelga de su categoría`,
          detail: `${subcategoryName(ctx, e.subcategory_id)}. Las dos se copian al cargar y quedan editables a propósito, así que puede ser una recategorización vieja o un error de carga.`,
          entryIds: [e.id],
        }));
    },
  },
  {
    code: "SIGNO_ATIPICO",
    label: "Movimiento en sentido contrario al de su rubro",
    severity: "media",
    basis: "INTERNO",
    run(ctx) {
      const groups = new Map<string, AuditEntry[]>();
      for (const e of live(ctx)) {
        if (!isOrdinary(e) || !e.subcategory_id) continue;
        const list = groups.get(e.subcategory_id) ?? [];
        list.push(e);
        groups.set(e.subcategory_id, list);
      }
      const out: Finding[] = [];
      for (const [subId, list] of groups) {
        if (list.length < 5) continue;
        const positives = list.filter((e) => e.amount > 0).length;
        const ratio = positives / list.length;
        // Solo cuando el rubro tiene un sentido claro: 90 % para un lado.
        if (ratio > 0.1 && ratio < 0.9) continue;
        const majorityPositive = ratio >= 0.9;
        for (const e of list) {
          if (e.amount > 0 === majorityPositive) continue;
          if (e.entry_date < ctx.from || e.entry_date > ctx.to) continue;
          out.push({
            code: "SIGNO_ATIPICO",
            key: `SIGNO_ATIPICO:${e.id}`,
            severity: "media",
            basis: "INTERNO",
            title: `Un movimiento del ${shortDate(e.entry_date)} va al revés que su rubro`,
            detail: `${subcategoryName(ctx, subId)} es ${majorityPositive ? "un rubro de ingresos" : "un rubro de gastos"} y este va por ${formatMoney(e.amount, e.currency)}. Puede ser una devolución legítima: lo decide el tesorero.`,
            entryIds: [e.id],
          });
        }
      }
      return out;
    },
  },
  {
    code: "DESCRIPCION_VACIA",
    label: "Un movimiento sin concepto",
    severity: "media",
    basis: "MEC",
    run(ctx) {
      return inRange(ctx)
        .filter((e) => blank(e.description) && !e.contributor_id && !e.is_opening_balance)
        .map((e) => ({
          code: "DESCRIPCION_VACIA",
          key: `DESCRIPCION_VACIA:${e.id}`,
          severity: "media" as const,
          basis: "MEC" as const,
          title: `Un movimiento del ${shortDate(e.entry_date)} llega al Libro de Caja sin concepto`,
          detail: `${formatMoney(e.amount, e.currency)} · ${subcategoryName(ctx, e.subcategory_id)}. El Libro Mayor de Caja tiene cinco columnas y una es «Concepto».`,
          entryIds: [e.id],
        }));
    },
  },
  {
    code: "FECHA_FUERA_DEL_EJERCICIO",
    label: "La fecha no cae en el ejercicio declarado",
    severity: "media",
    basis: "INTERNO",
    run(ctx) {
      const bounds = new Map<number, { start: string; end: string }>();
      const out: Finding[] = [];
      for (const e of live(ctx)) {
        if (e.bahai_year == null) continue;
        let b = bounds.get(e.bahai_year);
        if (!b) {
          const start = treasuryYearStart(e.bahai_year);
          const end = treasuryYearEnd(e.bahai_year);
          if (!start || !end) continue;
          b = { start, end };
          bounds.set(e.bahai_year, b);
        }
        if (e.entry_date >= b.start && e.entry_date <= b.end) continue;
        out.push({
          code: "FECHA_FUERA_DEL_EJERCICIO",
          key: `FECHA_FUERA_DEL_EJERCICIO:${e.id}`,
          severity: "media",
          basis: "INTERNO",
          title: `Un movimiento del ${shortDate(e.entry_date)} dice ser del ejercicio ${e.bahai_year}`,
          detail: `Ese ejercicio va del ${shortDate(b.start)} al ${shortDate(b.end)}. El movimiento aparece en un informe y falta en otro.`,
          entryIds: [e.id],
        });
      }
      return out;
    },
  },
  {
    code: "APERTURA_DUPLICADA",
    label: "Dos saldos de apertura para la misma cuenta",
    severity: "alta",
    basis: "INTERNO",
    run(ctx) {
      const groups = new Map<string, AuditEntry[]>();
      for (const e of live(ctx)) {
        if (!e.is_opening_balance) continue;
        // ⚠️ El fondo forma parte de la identidad de una apertura. La
        // plata está coloreada por fondo, así que una misma cuenta abre
        // el ejercicio con un saldo por cada fondo que tenga adentro —en
        // la planilla 182 de la AEN, Cuenta Prex abre con cinco—. Sin el
        // fondo en la clave, un libro bien llevado se reporta como si
        // tuviera la apertura duplicada.
        const key = `${e.account_id}|${e.currency}|${e.fund_id ?? "-"}|${e.bahai_year ?? "?"}`;
        const list = groups.get(key) ?? [];
        list.push(e);
        groups.set(key, list);
      }
      const out: Finding[] = [];
      for (const [key, list] of groups) {
        if (list.length < 2) continue;
        const e = list[0];
        out.push({
          code: "APERTURA_DUPLICADA",
          key: `APERTURA_DUPLICADA:${key}`,
          severity: "alta",
          basis: "INTERNO",
          title: `${accountName(ctx, e.account_id)} tiene ${list.length} saldos de apertura`,
          detail:
            "Duplicar la apertura infla el saldo por todo el año, y como no es un ingreso real no aparece en ningún total que delate la diferencia.",
          entryIds: list.map((x) => x.id),
        });
      }
      return out;
    },
  },
  {
    code: "APERTURA_FALTANTE",
    label: "Un saldo del ejercicio anterior no se arrastró",
    severity: "media",
    basis: "INTERNO",
    run(ctx) {
      const prevEnd = treasuryYearEnd(ctx.bahaiYear - 1);
      const start = treasuryYearStart(ctx.bahaiYear);
      if (!prevEnd || !start) return [];

      // ⚠️ Si el ejercicio anterior está EN el libro, el saldo se arrastra
      // solo y no hay nada que asentar: el Libro de Caja acumula todo lo
      // anterior al mes, así que una apertura repetida contaría dos veces
      // el mismo saldo. La apertura la trae un solo ejercicio, el más
      // viejo del libro. La regla es para el caso contrario —el ejercicio
      // pasado no está cargado y el saldo se copia a mano—, que es lo que
      // pasa mientras no se importen los años anteriores (062).
      const prevStart = treasuryYearStart(ctx.bahaiYear - 1);
      if (
        prevStart &&
        live(ctx).some(
          (e) => !e.is_opening_balance && e.entry_date >= prevStart && e.entry_date <= prevEnd
        )
      ) {
        return [];
      }

      // Saldo al cierre del ejercicio anterior, por cuenta y moneda.
      const closing = new Map<string, number>();
      for (const e of live(ctx)) {
        if (e.entry_date > prevEnd) continue;
        const key = `${e.account_id}|${e.currency}`;
        closing.set(key, addMoney(closing.get(key) ?? 0, e.amount));
      }
      const opened = new Set(
        live(ctx)
          .filter((e) => e.is_opening_balance && e.entry_date >= start)
          .map((e) => `${e.account_id}|${e.currency}`)
      );
      const out: Finding[] = [];
      for (const [key, amount] of closing) {
        if (Math.abs(amount) < EPS) continue;
        if (opened.has(key)) continue;
        const [accountId, currency] = key.split("|");
        out.push({
          code: "APERTURA_FALTANTE",
          key: `APERTURA_FALTANTE:${ctx.bahaiYear}:${key}`,
          severity: "media",
          basis: "INTERNO",
          title: `${accountName(ctx, accountId)} cerró con saldo y el ejercicio nuevo arranca en cero`,
          detail: `Al ${shortDate(prevEnd)} quedaban ${formatMoney(amount, currency)} y no hay asiento de apertura en el ${ctx.bahaiYear}. Los saldos de apertura se cargan a mano, así que es un olvido esperable.`,
          entryIds: [],
          figures: { saldo: amount, moneda: currency },
        });
      }
      return out;
    },
  },
  {
    code: "RUBRO_INACTIVO",
    label: "Usa una cuenta, fondo o rubro dado de baja",
    severity: "baja",
    basis: "INTERNO",
    run(ctx) {
      const inactive = (rows: NamedRow[]) =>
        new Set(rows.filter((r) => !r.is_active).map((r) => r.id));
      const accounts = inactive(ctx.catalog.accounts);
      const funds = inactive(ctx.catalog.funds);
      const subs = inactive(ctx.catalog.subcategories);
      return inRange(ctx)
        .filter(
          (e) =>
            accounts.has(e.account_id) ||
            (e.fund_id != null && funds.has(e.fund_id)) ||
            (e.subcategory_id != null && subs.has(e.subcategory_id))
        )
        .map((e) => ({
          code: "RUBRO_INACTIVO",
          key: `RUBRO_INACTIVO:${e.id}`,
          severity: "baja" as const,
          basis: "INTERNO" as const,
          title: `Un movimiento del ${shortDate(e.entry_date)} usa algo dado de baja`,
          detail:
            "No rompe nada, pero los desplegables ya no lo ofrecen: o la baja fue prematura, o alguien está copiando asientos viejos.",
          entryIds: [e.id],
        }));
    },
  },
];

// ═══ D · Comprobantes y respaldo ════════════════════════════════════

const D: Rule[] = [
  {
    code: "GASTO_SIN_COMPROBANTE",
    label: "Un gasto sin factura adjunta",
    severity: "alta",
    basis: "MEC",
    run(ctx) {
      const withFiles = new Set(ctx.attachments.map((a) => a.entry_id));
      return inRange(ctx)
        .filter((e) => e.amount < 0 && isOrdinary(e) && !withFiles.has(e.id))
        .map((e) => ({
          code: "GASTO_SIN_COMPROBANTE",
          key: `GASTO_SIN_COMPROBANTE:${e.id}`,
          severity: "alta" as const,
          basis: "MEC" as const,
          title: `Un gasto del ${shortDate(e.entry_date)} no tiene comprobante`,
          detail: `${formatMoney(e.amount, e.currency)} · ${subcategoryName(ctx, e.subcategory_id)}. El respaldo documental es la exigencia más repetida del instructivo.`,
          entryIds: [e.id],
        }));
    },
  },
  {
    code: "COMPROBANTES_NO_SUMAN",
    label: "Las facturas no llegan al monto del gasto",
    severity: "media",
    basis: "INTERNO",
    run(ctx) {
      const byEntry = new Map<string, AuditAttachment[]>();
      for (const a of ctx.attachments) {
        const list = byEntry.get(a.entry_id) ?? [];
        list.push(a);
        byEntry.set(a.entry_id, list);
      }
      const out: Finding[] = [];
      for (const e of inRange(ctx)) {
        const files = byEntry.get(e.id);
        if (!files || files.length === 0) continue;
        const declared = files.filter((f) => typeof f.amount === "number");
        // Sin montos declarados no hay nada que comparar: el caso común
        // es una sola factura por el total.
        if (declared.length === 0) continue;
        const sum = declared.reduce((acc, f) => addMoney(acc, f.amount ?? 0), 0);
        const target = Math.abs(e.amount);
        if (Math.abs(sum - target) < EPS) continue;
        out.push({
          code: "COMPROBANTES_NO_SUMAN",
          key: `COMPROBANTES_NO_SUMAN:${e.id}`,
          severity: "media",
          basis: "INTERNO",
          title: `Las facturas del ${shortDate(e.entry_date)} no dan el total del gasto`,
          detail: `${declared.length} comprobantes suman ${formatMoney(sum, e.currency)} contra ${formatMoney(target, e.currency)} del movimiento. Se avisa, no se bloquea: una factura puede traer un ítem que no corresponde.`,
          entryIds: [e.id],
          figures: { comprobantes: sum, movimiento: target },
        });
      }
      return out;
    },
  },
  {
    code: "COMPROBANTE_HUERFANO",
    label: "El archivo de un comprobante no está",
    severity: "baja",
    basis: "INTERNO",
    run(ctx) {
      const missing = new Set(ctx.missingAttachmentPaths ?? []);
      if (missing.size === 0) return [];
      return ctx.attachments
        .filter((a) => missing.has(a.storage_path))
        .map((a) => ({
          code: "COMPROBANTE_HUERFANO",
          key: `COMPROBANTE_HUERFANO:${a.id}`,
          severity: "baja" as const,
          basis: "INTERNO" as const,
          title: "Un comprobante promete un archivo que ya no está",
          detail:
            "La ficha nombra una factura que no se puede abrir. El objeto ya no existe en el bucket privado.",
          entryIds: [a.entry_id],
        }));
    },
  },
];

// ═══ E · Saldos y conciliación ══════════════════════════════════════

const E: Rule[] = [
  {
    code: "CONCILIACION_ROTA",
    label: "Fondos y cuentas no dan lo mismo",
    severity: "alta",
    basis: "INTERNO",
    run(ctx) {
      // Toda la plata está a la vez en una cuenta y en un fondo, así que
      // los dos totales tienen que coincidir moneda por moneda. La
      // diferencia es exactamente lo que quedó sin asignar a un fondo;
      // los movimientos culpables los lista ASIENTO_SIN_FONDO.
      const byCurrency = new Map<string, { accounts: number; funds: number }>();
      for (const e of live(ctx)) {
        if (e.entry_date > ctx.to) continue;
        const slot = byCurrency.get(e.currency) ?? { accounts: 0, funds: 0 };
        slot.accounts = addMoney(slot.accounts, e.amount);
        if (e.fund_id) slot.funds = addMoney(slot.funds, e.amount);
        byCurrency.set(e.currency, slot);
      }
      const out: Finding[] = [];
      for (const [currency, slot] of byCurrency) {
        const diff = addMoney(slot.accounts, -slot.funds);
        if (Math.abs(diff) < EPS) continue;
        out.push({
          code: "CONCILIACION_ROTA",
          key: `CONCILIACION_ROTA:${currency}`,
          severity: "alta",
          basis: "INTERNO",
          title: `En ${currency} el total por fondos no coincide con el total por cuentas`,
          detail: `Las cuentas dan ${formatMoney(slot.accounts, currency)} y los fondos ${formatMoney(slot.funds, currency)}: quedan ${formatMoney(diff, currency)} sin asignar a ningún fondo.`,
          entryIds: [],
          figures: { cuentas: slot.accounts, fondos: slot.funds, diferencia: diff },
        });
      }
      return out;
    },
  },
  {
    code: "SALDO_NEGATIVO",
    label: "Una caja quedó en rojo",
    severity: "alta",
    basis: "INTERNO",
    run(ctx) {
      const sorted = live(ctx)
        .filter((e) => e.entry_date <= ctx.to)
        .sort((a, b) =>
          a.entry_date === b.entry_date
            ? a.created_at.localeCompare(b.created_at)
            : a.entry_date.localeCompare(b.entry_date)
        );
      const running = new Map<string, number>();
      // El peor momento de cada cuenta: se informa uno por cuenta, no
      // una línea por cada día en rojo.
      const worst = new Map<string, { date: string; balance: number; id: string }>();
      for (const e of sorted) {
        const key = `${e.account_id}|${e.currency}`;
        const next = addMoney(running.get(key) ?? 0, e.amount);
        running.set(key, next);
        if (next >= -EPS) continue;
        const cur = worst.get(key);
        if (!cur || next < cur.balance) {
          worst.set(key, { date: e.entry_date, balance: next, id: e.id });
        }
      }
      const out: Finding[] = [];
      for (const [key, hit] of worst) {
        const [accountId, currency] = key.split("|");
        out.push({
          code: "SALDO_NEGATIVO",
          key: `SALDO_NEGATIVO:${key}`,
          severity: "alta",
          basis: "INTERNO",
          title: `${accountName(ctx, accountId)} quedó en rojo el ${shortDate(hit.date)}`,
          detail: `Llegó a ${formatMoney(hit.balance, currency)}. En efectivo es imposible: delata un ingreso que falta cargar o un gasto fechado antes de tiempo.`,
          entryIds: [hit.id],
          figures: { saldo: hit.balance, fecha: hit.date },
        });
      }
      return out;
    },
  },
  {
    code: "CUENTA_DORMIDA",
    label: "Cuenta activa sin movimientos",
    severity: "baja",
    basis: "INTERNO",
    run(ctx) {
      const used = new Set(inRange(ctx).map((e) => e.account_id));
      return ctx.catalog.accounts
        .filter((a) => a.is_active && !used.has(a.id))
        .map((a) => ({
          code: "CUENTA_DORMIDA",
          key: `CUENTA_DORMIDA:${a.id}:${ctx.bahaiYear}`,
          severity: "baja" as const,
          basis: "INTERNO" as const,
          title: `${a.name} no tuvo movimientos en el período`,
          detail:
            "O hay que darla de baja, o hay movimientos que no se están registrando en ella. Las dos respuestas sirven y ninguna es urgente.",
          entryIds: [],
        }));
    },
  },
];

// ═══ F · Informes y balance anual ═══════════════════════════════════

function editorialOf(r: AuditReport): Record<string, unknown> {
  return (r.editorial ?? {}) as Record<string, unknown>;
}

function approvalDate(r: AuditReport): string | null {
  const approval = editorialOf(r).approval as { meetingDate?: unknown } | undefined;
  const raw = approval?.meetingDate;
  return typeof raw === "string" && raw.trim() !== "" ? raw : null;
}

const F: Rule[] = [
  {
    code: "INFORME_DESACTUALIZADO",
    label: "Movimientos cargados después de congelar el informe",
    severity: "alta",
    basis: "INTERNO",
    run(ctx) {
      const out: Finding[] = [];
      for (const r of ctx.reports) {
        if (r.status !== "published") continue;
        const late = live(ctx).filter(
          (e) =>
            e.entry_date >= r.period_from &&
            e.entry_date <= r.period_to &&
            e.created_at > r.updated_at
        );
        if (late.length === 0) continue;
        out.push({
          code: "INFORME_DESACTUALIZADO",
          key: `INFORME_DESACTUALIZADO:${r.id}`,
          severity: "alta",
          basis: "INTERNO",
          title: `«${r.title}» ya no coincide con el libro`,
          detail: `${late.length} movimiento${late.length === 1 ? "" : "s"} del período se cargaron después de congelar el informe. El snapshot no cambia, así que nadie se entera.`,
          entryIds: late.map((e) => e.id),
          figures: { movimientos: late.length },
        });
      }
      return out;
    },
  },
  {
    code: "SNAPSHOT_INCOMPLETO",
    label: "Informe sin los totales por rubro",
    severity: "alta",
    basis: "INTERNO",
    run(ctx) {
      return ctx.reports
        .filter((r) => r.audience === "internos" || r.audience === "balance")
        .filter((r) => {
          const s = r.snapshot ?? {};
          return !s || !("incomeByRubro" in s) || !("expenseByRubro" in s);
        })
        .map((r) => ({
          code: "SNAPSHOT_INCOMPLETO",
          key: `SNAPSHOT_INCOMPLETO:${r.id}`,
          severity: "alta" as const,
          basis: "INTERNO" as const,
          title: `«${r.title}» sale con las secciones de rubros vacías`,
          detail:
            "Es un informe guardado antes de la 044, que no trae los agregados por rubro. Se arregla volviendo a guardarlo: el snapshot se recalcula.",
          entryIds: [],
        }));
    },
  },
  {
    code: "PERIODO_SIN_INFORME",
    label: "Un mes bahá'í sin informe presentado",
    severity: "media",
    basis: "ESTATUTOS",
    appliesTo: "ael",
    run(ctx) {
      const published = ctx.reports.filter(
        (r) => r.audience === "comunidad" && r.status === "published"
      );
      const out: Finding[] = [];
      for (const month of treasuryMonths(ctx.bahaiYear)) {
        // Solo tramos ya terminados.
        if (month.to >= ctx.today) continue;
        if (month.partial) continue;
        const covered = published.some(
          (r) => r.period_to >= month.from && r.period_to <= month.to
        );
        if (covered) continue;
        out.push({
          code: "PERIODO_SIN_INFORME",
          key: `PERIODO_SIN_INFORME:${ctx.bahaiYear}:${month.key}`,
          severity: "media",
          basis: "ESTATUTOS",
          title: `${month.name} quedó sin informe presentado`,
          detail:
            "En cada Fiesta se presenta lo del mes que termina. Un período sin informe es una Fiesta en la que la comunidad no supo cómo estaba el Fondo.",
          entryIds: [],
          figures: { mes: month.name },
        });
      }
      return out;
    },
  },
  {
    code: "BALANCE_FALTANTE",
    label: "Un ejercicio terminado sin Memoria y Balance",
    severity: "alta",
    basis: "ESTATUTOS",
    appliesTo: "ael",
    run(ctx) {
      // Ejercicio estatutario: 18 de abril → 17 de abril.
      const year = parseInt(ctx.today.slice(0, 4), 10);
      const lastCloseYear = ctx.today >= `${year}-04-18` ? year : year - 1;
      const from = `${lastCloseYear - 1}-04-18`;
      const to = `${lastCloseYear}-04-17`;
      const has = ctx.reports.some(
        (r) =>
          r.audience === "balance" &&
          r.status === "published" &&
          r.period_to >= to &&
          r.period_from <= from
      );
      if (has) return [];
      return [
        {
          code: "BALANCE_FALTANTE",
          key: `BALANCE_FALTANTE:${to}`,
          severity: "alta",
          basis: "ESTATUTOS",
          title: `No hay Memoria y Balance del ejercicio cerrado el ${shortDate(to)}`,
          detail:
            "Obligación estatutaria, no cortesía: desde el 17 de abril las copias tienen que estar a disposición de todos los bahá'ís (Agregado 3 del art. XI). Es también lo que se transcribe al libro de actas.",
          entryIds: [],
          figures: { desde: from, hasta: to },
        },
      ];
    },
  },
  {
    code: "BALANCE_SIN_COTIZACION",
    label: "Balance con dólares y sin tipo de cambio",
    severity: "alta",
    basis: "INTERNO",
    run(ctx) {
      const hasUsd = live(ctx).some((e) => e.currency === "USD");
      if (!hasUsd) return [];
      return ctx.reports
        .filter((r) => r.audience === "balance" && r.status === "published")
        .filter((r) => {
          const balance = editorialOf(r).balance as { rate?: unknown } | undefined;
          const rate = balance?.rate;
          return !(typeof rate === "number" && rate > 0) && blank(rate as string | null);
        })
        .map((r) => ({
          code: "BALANCE_SIN_COTIZACION",
          key: `BALANCE_SIN_COTIZACION:${r.id}`,
          severity: "alta" as const,
          basis: "INTERNO" as const,
          title: `«${r.title}» no declara la cotización de cierre`,
          detail:
            "Hay saldos en dólares. «Nunca sumar monedas distintas» solo se puede romper con un tipo de cambio dicho y firmado; sin él el balance no totaliza en pesos.",
          entryIds: [],
        }));
    },
  },
  {
    code: "BALANCE_SIN_FIRMAS",
    label: "Falta alguna de las tres firmas",
    severity: "alta",
    basis: "ESTATUTOS",
    appliesTo: "ael",
    run(ctx) {
      return ctx.reports
        .filter((r) => r.audience === "balance" && r.status === "published")
        .filter((r) => {
          const balance = editorialOf(r).balance as { signatures?: unknown } | undefined;
          const sigs = balance?.signatures;
          if (!Array.isArray(sigs)) return true;
          const filled = sigs.filter((s) => typeof s === "string" && s.trim() !== "");
          return filled.length < 3;
        })
        .map((r) => ({
          code: "BALANCE_SIN_FIRMAS",
          key: `BALANCE_SIN_FIRMAS:${r.id}`,
          severity: "alta" as const,
          basis: "ESTATUTOS" as const,
          title: `«${r.title}» no lleva las tres firmas`,
          detail:
            "El artículo VII pide Coordinador, Secretario y Tesorero. Se proponen desde la composición de la Asamblea del ejercicio, así que faltar una suele significar que esa composición no se cargó.",
          entryIds: [],
        }));
    },
  },
  {
    code: "INFORME_SIN_APROBACION",
    label: "Informe emitido sin registrar la reunión",
    severity: "media",
    basis: "ESTATUTOS",
    appliesTo: "ael",
    run(ctx) {
      return ctx.reports
        .filter(
          (r) =>
            (r.audience === "internos" || r.audience === "balance") &&
            r.status === "published" &&
            !approvalDate(r)
        )
        .map((r) => ({
          code: "INFORME_SIN_APROBACION",
          key: `INFORME_SIN_APROBACION:${r.id}`,
          severity: "media" as const,
          basis: "ESTATUTOS" as const,
          title: `«${r.title}» está emitido y figura como no aprobado`,
          detail:
            "Aprueban los nueve miembros en reunión con quórum de cinco; no hay Comisión Fiscal. El estado «Aprobado» se deriva de la fecha de reunión, así que sin ella el registro lo muestra sin aprobar.",
          entryIds: [],
        }));
    },
  },
  {
    code: "BORRADOR_OLVIDADO",
    label: "Un informe quedó en borrador",
    severity: "baja",
    basis: "INTERNO",
    run(ctx) {
      return ctx.reports
        .filter((r) => r.status === "draft" && daysBefore(r.updated_at, ctx.today, 60))
        .map((r) => ({
          code: "BORRADOR_OLVIDADO",
          key: `BORRADOR_OLVIDADO:${r.id}`,
          severity: "baja" as const,
          basis: "INTERNO" as const,
          title: `«${r.title}» sigue en borrador desde el ${shortDate(r.updated_at)}`,
          detail:
            "Probablemente se armó para una Fiesta que ya pasó. Conviene publicarlo o borrarlo antes de que el snapshot congelado confunda a quien lo abra el año que viene.",
          entryIds: [],
        }));
    },
  },
];

// ═══ G · Ficha legal y Asamblea ═════════════════════════════════════

const G: Rule[] = [
  {
    code: "SIN_DATOS_FISCALES",
    label: "Los recibos salen sin datos fiscales",
    severity: "alta",
    basis: "DGI",
    run(ctx) {
      const missing: string[] = [];
      if (!ctx.legal) missing.push("no hay ficha legal cargada");
      else {
        if (blank(ctx.legal.registered_name)) missing.push("el nombre registrado");
        if (blank(ctx.legal.rut)) missing.push("el RUT");
        if (blank(ctx.legal.fiscal_address)) missing.push("el domicilio fiscal");
      }
      if (missing.length === 0) return [];
      return [
        {
          code: "SIN_DATOS_FISCALES",
          key: "SIN_DATOS_FISCALES",
          severity: "alta",
          basis: "DGI",
          title: "Los recibos se emiten sin los datos que pide la DGI",
          detail: `Falta ${missing.join(", ")}. La Res. 688/992 num. 22 pide los tres, y afecta a todos los recibos ya emitidos, no solo a los próximos. Se carga en Asamblea → Datos de la Asamblea.`,
          entryIds: [],
        },
      ];
    },
  },
  {
    code: "SIN_COMPOSICION",
    label: "El ejercicio no tiene cargada la Asamblea",
    severity: "media",
    basis: "ESTATUTOS",
    run(ctx) {
      if (!ctx.assembly || ctx.assembly.members.length === 0) {
        return [
          {
            code: "SIN_COMPOSICION",
            key: `SIN_COMPOSICION:${ctx.bahaiYear}`,
            severity: "media",
            basis: "ESTATUTOS",
            title: `No está cargada la Asamblea del ejercicio ${ctx.bahaiYear}`,
            detail:
              "Sin los miembros y sus cargos, el balance no puede proponer las firmas y la auditoría no puede verificar quién opera el libro.",
            entryIds: [],
          },
        ];
      }
      const offices = new Set(
        ctx.assembly.members.map((m) => m.office).filter((o): o is string => !!o)
      );
      const expected = ["coordinador", "vicecoordinador", "secretario", "tesorero"];
      const missing = expected.filter((o) => !offices.has(o));
      if (missing.length === 0) return [];
      return [
        {
          code: "SIN_COMPOSICION",
          key: `SIN_COMPOSICION:${ctx.bahaiYear}:cargos`,
          severity: "media",
          basis: "ESTATUTOS",
          title: `Faltan cargos en la Asamblea del ejercicio ${ctx.bahaiYear}`,
          detail: `Sin asignar: ${missing.join(", ")}. Los cuatro oficiales son los del artículo VII.`,
          entryIds: [],
        },
      ];
    },
  },
  {
    code: "TESORERO_SIN_TAG",
    label: "El Tesorero declarado no opera el libro",
    severity: "media",
    basis: "INTERNO",
    run(ctx) {
      // ⚠️ El tag es de la MEMBRESÍA de esta comunidad (055), no del
      // sombrero puesto: el cargador lo trae de `profile_localities`.
      const holders = new Set(ctx.treasuryTagHolders);
      if (holders.size === 0) {
        return [
          {
            code: "TESORERO_SIN_TAG",
            key: "TESORERO_SIN_TAG:nadie",
            severity: "media",
            basis: "INTERNO",
            title: "Nadie tiene permiso de Tesorería en esta comunidad",
            detail:
              "La firma del recibo deduce al tesorero del permiso, no del cargo declarado: sin nadie con el tag, los recibos salen sin firma.",
            entryIds: [],
          },
        ];
      }
      if (!ctx.assembly) return [];
      const treasurer = ctx.assembly.members.find((m) => m.office === "tesorero");
      if (!treasurer || !treasurer.profile_id) return [];
      if (holders.has(treasurer.profile_id)) return [];
      return [
        {
          code: "TESORERO_SIN_TAG",
          key: `TESORERO_SIN_TAG:${treasurer.profile_id}`,
          severity: "media",
          basis: "INTERNO",
          title: `${treasurer.display_name} figura como Tesorero/a y no tiene el permiso`,
          detail:
            "La firma del recibo sale del permiso, no del cargo declarado. Si no coinciden, el recibo lleva la firma equivocada. El permiso es de la membresía de esta comunidad.",
          entryIds: [],
        },
      ];
    },
  },
  {
    code: "SIN_ESTATUTOS",
    label: "No hay copia de los estatutos",
    severity: "baja",
    basis: "INTERNO",
    run(ctx) {
      if (ctx.legal && !blank(ctx.legal.statutes_path)) return [];
      return [
        {
          code: "SIN_ESTATUTOS",
          key: "SIN_ESTATUTOS",
          severity: "baja",
          basis: "INTERNO",
          title: "No hay copia de los estatutos cargada",
          detail:
            "Es el documento que se pide en cualquier trámite y el que fija las fechas del balance. Tenerlo a mano ahorra una vuelta al Centro.",
          entryIds: [],
        },
      ];
    },
  },
];

// ═══ H · Presupuesto, metas y contribuyentes ════════════════════════

const H: Rule[] = [
  {
    code: "SIN_PRESUPUESTO",
    label: "El ejercicio no tiene presupuesto",
    severity: "media",
    basis: "INTERNO",
    run(ctx) {
      if (ctx.budget) return [];
      return [
        {
          code: "SIN_PRESUPUESTO",
          key: `SIN_PRESUPUESTO:${ctx.bahaiYear}`,
          severity: "media",
          basis: "INTERNO",
          title: `No se encuentra el presupuesto del ejercicio ${ctx.bahaiYear}`,
          detail:
            "Sin él, el tablero no puede dibujar la pauta ni el necesario por mes. Ojo que puede existir con el año en blanco: la búsqueda pasa por findBudgetForYear().",
          entryIds: [],
        },
      ];
    },
  },
  {
    code: "LINEA_SIN_VINCULAR",
    label: "Línea del presupuesto sin rubro del libro",
    severity: "media",
    basis: "INTERNO",
    run(ctx) {
      if (!ctx.budget) return [];
      return ctx.budget.items
        .filter(
          (i) => i.planned_amount > 0 && !i.ledger_category_id && !i.ledger_subcategory_id
        )
        .map((i) => ({
          code: "LINEA_SIN_VINCULAR",
          key: `LINEA_SIN_VINCULAR:${i.id}`,
          severity: "media" as const,
          basis: "INTERNO" as const,
          title: `«${i.category}» no dice con qué rubro se ejecuta`,
          detail: `${formatMoney(i.planned_amount)} presupuestados que se informan como no comparables. Si son muchas líneas, el total ejecutado deja de significar algo.`,
          entryIds: [],
        }));
    },
  },
  {
    code: "EJECUTADO_A_MANO",
    label: "Gasto tipeado en una línea vinculada",
    severity: "baja",
    basis: "INTERNO",
    run(ctx) {
      if (!ctx.budget) return [];
      return ctx.budget.items
        .filter(
          (i) => i.spent_amount > 0 && (i.ledger_category_id || i.ledger_subcategory_id)
        )
        .map((i) => ({
          code: "EJECUTADO_A_MANO",
          key: `EJECUTADO_A_MANO:${i.id}`,
          severity: "baja" as const,
          basis: "INTERNO" as const,
          title: `«${i.category}» tiene el gasto tipeado y además vinculado al libro`,
          detail:
            "Dos fuentes para el mismo número, y la de la mano gana en las pantallas viejas. Es el rastro del pendiente de jubilar la tabla treasury original.",
          entryIds: [],
        }));
    },
  },
  {
    code: "META_SIN_VINCULO",
    label: "Meta con cifra y sin forma de medirla",
    severity: "baja",
    basis: "INTERNO",
    run(ctx) {
      return ctx.goals
        .filter(
          (g) =>
            g.status === "activa" &&
            g.target_amount != null &&
            !g.ledger_fund_id &&
            !g.ledger_category_id &&
            !g.ledger_subcategory_id
        )
        .map((g) => ({
          code: "META_SIN_VINCULO",
          key: `META_SIN_VINCULO:${g.id}`,
          severity: "baja" as const,
          basis: "INTERNO" as const,
          title: `«${g.title}» promete un porcentaje que nadie puede calcular`,
          detail:
            "Una meta sin monto es legítima y se informa por su etiqueta. Con monto y sin vínculo al libro, no hay forma de medir el avance.",
          entryIds: [],
        }));
    },
  },
  {
    code: "CONTRIBUYENTE_DUPLICADO",
    label: "La misma persona dos veces en el padrón",
    severity: "media",
    basis: "INTERNO",
    run(ctx) {
      // ⚠️ SOLO dentro de esta comunidad. La misma persona es
      // legítimamente contribuyente en el libro de su Asamblea Local y en
      // el de la Nacional: son dos libros, y el índice único es por
      // localidad. El catálogo que llega ya está acotado por la RLS.
      const people = ctx.catalog.contributors.filter(
        (c) => c.is_active && c.kind === "persona"
      );
      const out: Finding[] = [];
      const seen = new Set<string>();

      // Mismo perfil, dos fichas.
      const byProfile = new Map<string, typeof people>();
      for (const c of people) {
        if (!c.profile_id) continue;
        const list = byProfile.get(c.profile_id) ?? [];
        list.push(c);
        byProfile.set(c.profile_id, list);
      }
      for (const [profileId, list] of byProfile) {
        if (list.length < 2) continue;
        const key = `CONTRIBUYENTE_DUPLICADO:perfil:${profileId}`;
        seen.add(list.map((c) => c.id).sort().join("|"));
        out.push({
          code: "CONTRIBUYENTE_DUPLICADO",
          key,
          severity: "media",
          basis: "INTERNO",
          title: `${list[0].name} tiene ${list.length} fichas apuntando al mismo creyente`,
          detail:
            "Sus aportes quedan partidos entre las dos y en «Mis aportes» ve la mitad.",
          entryIds: [],
        });
      }

      // Nombres casi iguales.
      for (let i = 0; i < people.length; i++) {
        for (let j = i + 1; j < people.length; j++) {
          const a = people[i];
          const b = people[j];
          const pairKey = [a.id, b.id].sort().join("|");
          if (seen.has(pairKey)) continue;
          const na = normalizeName(a.name);
          const nb = normalizeName(b.name);
          // Iguales al normalizar, o a un par de letras de distancia
          // ("Juan Pérez" / "Juan Perez", "Juan A. Pérez").
          if (na !== nb && editDistance(na, nb) > 2) continue;
          seen.add(pairKey);
          out.push({
            code: "CONTRIBUYENTE_DUPLICADO",
            key: `CONTRIBUYENTE_DUPLICADO:${pairKey}`,
            severity: "media",
            basis: "INTERNO",
            title: `«${a.name}» y «${b.name}» parecen la misma persona`,
            detail:
              "El índice único ataja los nombres idénticos, no las variantes con inicial o sin acento.",
            entryIds: [],
          });
        }
      }
      return out;
    },
  },
  {
    code: "CONTRIBUYENTE_SIN_PERFIL",
    label: "Contribuyente suelto que coincide con un creyente",
    severity: "media",
    basis: "INTERNO",
    run(ctx) {
      // El universo lo decide el cargador, igual que el buscador del
      // libro: el padrón por membresía en una AEL, todo el país en la
      // Comunidad Nacional (058).
      const roster = new Map<string, string>();
      for (const p of ctx.roster) {
        if (!p.full_name) continue;
        roster.set(normalizeName(p.full_name), p.full_name);
      }
      const national = ctx.locality.kind === "nacional";
      return ctx.catalog.contributors
        .filter((c) => c.is_active && c.kind === "persona" && !c.profile_id)
        .filter((c) => roster.has(normalizeName(c.name)))
        .map((c) => ({
          code: "CONTRIBUYENTE_SIN_PERFIL",
          key: `CONTRIBUYENTE_SIN_PERFIL:${c.id}`,
          severity: "media" as const,
          basis: "INTERNO" as const,
          title: `${c.name} aporta y no está vinculado a su perfil`,
          detail: national
            ? "En la Comunidad Nacional esto pesa: quien giró al Fondo Nacional desde otra localidad no ve su aporte en ningún lado hasta que se lo vincule."
            : "Vincularlo hace que esa persona vea sus aportes y baje sus recibos sin pedírselos al tesorero.",
          entryIds: [],
        }));
    },
  },
];

// ═══ El motor ═══════════════════════════════════════════════════════

export const RULES: Rule[] = [...A, ...B, ...C, ...D, ...E, ...F, ...G, ...H];

/** ¿Corre esta regla en esta clase de comunidad? */
export function ruleApplies(rule: Rule, kind: "ael" | "nacional"): boolean {
  const scope = rule.appliesTo ?? "ambas";
  return scope === "ambas" || scope === kind;
}

/**
 * Corre todas las reglas que apliquen. Una regla que revienta NO tumba la
 * auditoría: se anota como fallida y las demás siguen, igual que las
 * tarjetas del Inicio del panel.
 *
 * Los hallazgos salen ordenados por gravedad y, dentro de cada gravedad,
 * por código: el orden tiene que ser estable entre corridas para que dos
 * informes del mismo libro se puedan comparar.
 */
export function runAudit(ctx: AuditInput): AuditResult {
  const findings: Finding[] = [];
  const failed: Array<{ code: string; message: string }> = [];

  for (const rule of RULES) {
    if (!ruleApplies(rule, ctx.locality.kind)) continue;
    try {
      findings.push(...rule.run(ctx));
    } catch (err) {
      failed.push({
        code: rule.code,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const weight: Record<Severity, number> = { alta: 0, media: 1, baja: 2 };
  findings.sort(
    (a, b) =>
      weight[a.severity] - weight[b.severity] ||
      a.code.localeCompare(b.code) ||
      a.key.localeCompare(b.key)
  );

  return {
    findings,
    counts: {
      alta: findings.filter((f) => f.severity === "alta").length,
      media: findings.filter((f) => f.severity === "media").length,
      baja: findings.filter((f) => f.severity === "baja").length,
      total: findings.length,
    },
    failed,
    ranAt: ctx.today,
  };
}

/**
 * Saca de la lista los hallazgos ya despachados. Las claves vienen de
 * `treasury_audit_dispositions`; un hallazgo en 'pendiente' sigue a la
 * vista, que es lo que permite deshacer un despacho sin perder el
 * registro de quién lo había marcado.
 */
export function withoutDispatched(
  findings: Finding[],
  dispositions: Array<{ finding_key: string; status: string }>
): Finding[] {
  const closed = new Set(
    dispositions.filter((d) => d.status !== "pendiente").map((d) => d.finding_key)
  );
  return findings.filter((f) => !closed.has(f.key));
}
