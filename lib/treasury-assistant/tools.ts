import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  balancesBy,
  getLedgerCatalog,
  getLedgerEntriesByIds,
  getLedgerEntriesByRange,
  type LedgerCatalog,
  type TreasuryEntry,
} from "@/lib/treasury-ledger";
import {
  applyLedgerFilters,
  EMPTY_FILTERS,
  entryKind,
  filteredTotals,
  type EntryKind,
  type LedgerNames,
} from "@/lib/treasury-ledger-filters";
import { addMoney, formatMoney } from "@/lib/treasury-format";
import { getReconciledEntryIds, getAccountReconciliation } from "@/lib/treasury-statements";
import { getTreasuryAttention } from "@/lib/treasury-attention";
import { getTreasuryGuide } from "@/lib/treasury-guide";
import { getTreasuryProgress } from "@/lib/treasury-progress";
import { getCommitmentMonthReport } from "@/lib/treasury-commitments";
import { findingsOf, getDispositions } from "@/lib/treasury-audit-server";
import { monthKeyOf, monthLabel, previousMonthKey } from "@/lib/treasury-cashbook";
import { treasuryYearForDate } from "@/lib/treasury-year";
import { isISODate } from "@/lib/treasury-ledger-filters";
import { PLATFORM_LABELS, assignFingerprints, parseStatement, type StatementLine } from "@/lib/bank-statements";
import { readStatementRows } from "@/lib/bank-statements-read";
import { getAccountEntries, getRubroNames } from "@/lib/treasury-statements";
import { DEFAULT_WINDOW_DAYS, reconcile, shiftDate, type ReconcileEntry } from "@/lib/treasury-reconcile";
import { getFile, readFileBuffer, readSheets, type FileRow } from "./files";
import type { AttachedFile, Proposal, ProposalKind, ProposalLine } from "./types";

export type { Proposal } from "./types";

/**
 * Las herramientas del asistente de Tesorería (090).
 *
 * Dos clases, y la diferencia es el diseño:
 *
 *  · LECTURA: corren con el cliente de Supabase del tesorero, así que la
 *    RLS decide lo que ve igual que en las pantallas. Reusan las mismas
 *    funciones que el Libro, la Guía y el tablero: si el asistente y la
 *    pantalla calcularan por su cuenta, dirían cosas distintas.
 *  · ESCRITURA: no escriben. Devuelven una PROPUESTA que la pantalla
 *    muestra con los nombres ya resueltos desde la base (no la paráfrasis
 *    del modelo), y recién cuando el tesorero confirma la ejecuta el MISMO
 *    server action del Libro (`execute.ts`). Mes cerrado, recibo emitido,
 *    numeración: todo lo cuida el camino de siempre.
 */

export type ToolContext = {
  supabase: SupabaseClient;
  localityId: string;
  localityKind: string;
  userId: string;
  today: string;
};

export type ToolOutcome =
  | { type: "result"; content: string; isError?: boolean }
  | { type: "proposal"; proposal: Proposal };

// ─── Definiciones ──────────────────────────────────────────────────────

/**
 * Un campo opcional: queda fuera de `required`. No se usa `strict` (con
 * todo requerido y los opcionales como `[tipo, "null"]`) porque la API
 * pone un tope de 16 campos con unión por pedido, y acá hay ~30. Sin
 * `strict` la API igual valida el input contra el schema, y cada
 * herramienta trata un campo ausente o de otro tipo como "no vino".
 */
const OPTIONAL = new WeakSet<object>();
const nullable = (type: string, description: string) => {
  const schema = { type, description };
  OPTIONAL.add(schema);
  return schema;
};

/** Una lista opcional de ids de archivos adjuntos. */
const FILE_IDS = (description: string) => {
  const schema = { type: "array", items: { type: "string" }, description };
  OPTIONAL.add(schema);
  return schema;
};

function tool(
  name: string,
  description: string,
  properties: Record<string, object>
): Anthropic.Tool {
  return {
    name,
    description,
    input_schema: {
      type: "object",
      properties,
      required: Object.keys(properties).filter((k) => !OPTIONAL.has(properties[k])),
      additionalProperties: false,
    } as Anthropic.Tool.InputSchema,
  };
}

const CONTRIBUTOR_PROPS = {
  contribuyente_id: nullable(
    "string",
    "Id de un contribuyente que ya está en el libro (de buscar_contribuyente). Null si no corresponde."
  ),
  creyente_id: nullable(
    "string",
    "Id de un creyente de la app que todavía no es contribuyente (de buscar_contribuyente). Se usa o crea su ficha vinculada."
  ),
  contribuyente_nuevo: nullable(
    "string",
    "Nombre de un contribuyente que no está en ningún lado (alguien de otra comunidad, una empresa). Solo si buscar_contribuyente no lo encontró."
  ),
};

export const TOOLS: Anthropic.Tool[] = [
  tool(
    "estado_de_la_tesoreria",
    "Qué necesita atención hoy y en qué está el ciclo del mes: las tarjetas del tablero de Tesorería (mes sin cerrar, auditoría, conciliación, publicación, recibos sin emitir, compromisos, cajas chicas) y los pasos de la Guía del mes con su estado. Es lo primero a consultar cuando el tesorero pregunta qué hacer.",
    {}
  ),
  tool(
    "catalogo",
    "Las cuentas, fondos, categorías y subcategorías (rubros) del libro, con sus ids. Hace falta para filtrar movimientos y para proponer cualquier movimiento.",
    {}
  ),
  tool(
    "buscar_contribuyente",
    "Busca por nombre entre los contribuyentes del libro y los creyentes de la comunidad. Devuelve ids para usar al proponer un aporte.",
    { texto: { type: "string", description: "Parte del nombre." } }
  ),
  tool(
    "buscar_movimientos",
    "Movimientos del libro en un rango de fechas, con filtros, y los totales por moneda de lo encontrado (ingresos, gastos, neto, transferencias). Incluye anulados marcados como tales. Devuelve como mucho `limite` filas pero los totales son de todo lo encontrado.",
    {
      desde: { type: "string", description: "Fecha inicial YYYY-MM-DD." },
      hasta: { type: "string", description: "Fecha final YYYY-MM-DD, incluida." },
      cuenta_id: nullable("string", "Filtrar por cuenta."),
      fondo_id: nullable("string", "Filtrar por fondo."),
      categoria_id: nullable("string", "Filtrar por categoría."),
      subcategoria_id: nullable("string", "Filtrar por subcategoría (rubro)."),
      moneda: nullable("string", "UYU o USD."),
      tipo: nullable("string", "ingreso, gasto, transferencia o apertura."),
      texto: nullable("string", "Busca en detalle, rubro, cuenta, contribuyente y número de recibo."),
      conciliado: nullable("string", "'si' = ya cerró contra el extracto; 'no' = todavía no."),
      limite: nullable("integer", "Filas a devolver (por defecto 60, máximo 200)."),
    }
  ),
  tool(
    "ver_movimientos",
    "El detalle de movimientos puntuales por id (por ejemplo los que nombra un hallazgo de auditoría).",
    { ids: { type: "array", items: { type: "string" }, description: "Ids de movimientos." } }
  ),
  tool(
    "saldos",
    "Saldos a una fecha: por cuenta y moneda, y por fondo y moneda. Un saldo es todo el libro hasta esa fecha, arrastre incluido.",
    { al: { type: "string", description: "Fecha de corte YYYY-MM-DD (incluida)." } }
  ),
  tool(
    "totales_por_rubro",
    "Ingresos y gastos de un período agrupados por categoría y subcategoría, por moneda. Sin transferencias, aperturas ni anulados (mismo criterio que el informe).",
    {
      desde: { type: "string", description: "YYYY-MM-DD." },
      hasta: { type: "string", description: "YYYY-MM-DD, incluida." },
    }
  ),
  tool(
    "presupuesto_y_metas",
    "El presupuesto del ejercicio contra lo ejecutado, la pauta del año, los saldos por fondo y las metas, calculados como el tablero de Progreso.",
    { al: nullable("string", "Fecha de corte YYYY-MM-DD; null = hoy.") }
  ),
  tool(
    "conciliacion_de_cuenta",
    "El estado de la conciliación de una cuenta contra los extractos importados: líneas del extracto sin par, movimientos del libro sin par, cobertura, saldo declarado y movimientos sin par de otras cuentas que podrían ser los que faltan.",
    { cuenta_id: { type: "string", description: "Id de la cuenta." } }
  ),
  tool(
    "auditoria",
    "Los hallazgos de la última auditoría guardada que siguen sin resolver, con su gravedad, explicación y movimientos involucrados.",
    {}
  ),
  tool(
    "revisar_extracto",
    "Cruza un extracto ADJUNTO en la conversación (Prex, BROU o Mercado Pago) contra los movimientos del libro de una cuenta, con el mismo motor de Conciliación, SIN importar nada: qué cerró, qué está en el extracto y no en el libro, qué está en el libro y no en el extracto, totales y saldo. Dice además cuántas líneas ya estaban importadas.",
    {
      archivo_id: { type: "string", description: "Id del archivo adjunto." },
      cuenta_id: { type: "string", description: "La cuenta del libro de ese extracto (del catálogo)." },
    }
  ),
  tool(
    "leer_planilla",
    "Lee las filas de una planilla ADJUNTA en la conversación (Excel o CSV), como texto: para comparar a mano con el libro una planilla que no es un extracto (un ejercicio viejo, una lista de compromisos). Devuelve las hojas y un tramo de filas.",
    {
      archivo_id: { type: "string", description: "Id del archivo adjunto." },
      hoja: nullable("string", "Nombre de la hoja; null = la primera."),
      desde_fila: nullable("integer", "Primera fila, desde 1; null = 1."),
      filas: nullable("integer", "Cuántas filas (por defecto 150, máximo 400)."),
    }
  ),
  tool(
    "compromisos_del_mes",
    "El informe de compromisos con el Fondo de un mes civil: quién tiene compromiso, cuánto aportó, quién no, quién aportó sin compromiso.",
    { mes: nullable("string", "YYYY-MM; null = el mes pasado.") }
  ),

  // ─── Escritura: propuestas que confirma el tesorero ───
  tool(
    "proponer_movimiento",
    "Propone registrar un ingreso (aporte) o un gasto en el libro. NO escribe nada: la pantalla le muestra la propuesta al tesorero, que la confirma o descarta, y recién ahí se registra con las reglas del Libro (un aporte recibe solo el próximo número de recibo). Para varios movimientos, una llamada por movimiento.",
    {
      fecha: { type: "string", description: "YYYY-MM-DD." },
      tipo: { type: "string", enum: ["ingreso", "gasto"] },
      cuenta_id: { type: "string", description: "Dónde entró o salió la plata." },
      subcategoria_id: { type: "string", description: "El rubro; la categoría sale de él." },
      fondo_id: nullable("string", "Null = el fondo sugerido por el rubro."),
      moneda: { type: "string", enum: ["UYU", "USD"] },
      monto: { type: "number", description: "Positivo, siempre: el signo lo pone el tipo." },
      detalle: nullable("string", "Descripción breve."),
      ...CONTRIBUTOR_PROPS,
      nombre_en_recibo: nullable("string", "Seudónimo para el recibo (\"Familia Pérez\"); null = el nombre del contribuyente."),
      cantidad_aportes: nullable("integer", "Cuántos aportes agrupa la línea (la canasta de la Fiesta); null = 1 o sin contar."),
      comprobantes: FILE_IDS(
        "Ids de imágenes o PDF adjuntos en la conversación (la factura, la captura del giro) que quedan colgados del movimiento como comprobantes al confirmarlo."
      ),
    }
  ),
  tool(
    "proponer_correccion",
    "Propone corregir un movimiento existente de un mes ABIERTO cuyo recibo NO fue emitido (cuenta equivocada, rubro, fondo, monto, fecha, detalle, contribuyente). Solo se mandan los campos que cambian; los demás en null. Si el mes está cerrado o el recibo emitido, no sirve: usar proponer_contra_asiento o proponer_anulacion.",
    {
      movimiento_id: { type: "string" },
      fecha: nullable("string", "YYYY-MM-DD."),
      cuenta_id: nullable("string", "Nueva cuenta."),
      subcategoria_id: nullable("string", "Nuevo rubro."),
      fondo_id: nullable("string", "Nuevo fondo."),
      moneda: nullable("string", "UYU o USD."),
      monto: nullable("number", "Nuevo monto, positivo."),
      detalle: nullable("string", "Nuevo detalle."),
      ...CONTRIBUTOR_PROPS,
    }
  ),
  tool(
    "proponer_transferencia",
    "Propone un cambio de caja o compra de divisas: una salida y una entrada atadas. Puede cruzar monedas (el tipo de cambio queda en los dos montos). NO escribe hasta que el tesorero confirma.",
    {
      fecha: { type: "string", description: "YYYY-MM-DD." },
      cuenta_origen_id: { type: "string" },
      cuenta_destino_id: { type: "string" },
      moneda_sale: { type: "string", enum: ["UYU", "USD"] },
      monto_sale: { type: "number" },
      moneda_entra: { type: "string", enum: ["UYU", "USD"] },
      monto_entra: { type: "number" },
      subcategoria_id: { type: "string", description: "El rubro de transferencia del catálogo." },
      detalle: nullable("string", "Descripción breve."),
    }
  ),
  tool(
    "proponer_anulacion",
    "Propone anular un movimiento de un mes abierto (típicamente un aporte con recibo emitido que estaba mal). Queda en el libro sin sumar y su número de recibo sigue ocupado. NO escribe hasta que el tesorero confirma.",
    {
      movimiento_id: { type: "string" },
      motivo: { type: "string", description: "Por qué se anula; queda registrado." },
    }
  ),
  tool(
    "proponer_adjuntar_comprobante",
    "Propone colgar una o más imágenes o PDF adjuntos en la conversación como comprobantes de un movimiento que YA está en el libro (típicamente un gasto sin comprobante). NO escribe hasta que el tesorero confirma.",
    {
      movimiento_id: { type: "string" },
      archivos: { type: "array", items: { type: "string" }, description: "Ids de los archivos adjuntos." },
    }
  ),
  tool(
    "proponer_importar_extracto",
    "Propone importar a Conciliación un extracto adjunto en la conversación (Prex, BROU o Mercado Pago), en la cuenta indicada: guarda sus líneas, las que ya estaban no se duplican, y el motor las cruza con el libro. Primero revisalo con revisar_extracto. NO escribe hasta que el tesorero confirma.",
    {
      archivo_id: { type: "string", description: "Id del archivo adjunto." },
      cuenta_id: { type: "string", description: "La cuenta del libro de ese extracto." },
    }
  ),
  tool(
    "proponer_contra_asiento",
    "Propone revertir un movimiento con un contra-asiento con fecha de hoy (la forma de corregir algo de un mes CERRADO). Después, si hace falta, se propone el movimiento correcto aparte. NO escribe hasta que el tesorero confirma.",
    {
      movimiento_id: { type: "string" },
      motivo: { type: "string", description: "Por qué se corrige; queda registrado." },
    }
  ),
];

/** Qué dice la pantalla mientras corre cada herramienta. */
export const TOOL_LABELS: Record<string, string> = {
  estado_de_la_tesoreria: "Mirando qué está pendiente",
  catalogo: "Leyendo el catálogo",
  buscar_contribuyente: "Buscando el contribuyente",
  buscar_movimientos: "Buscando movimientos",
  ver_movimientos: "Abriendo movimientos",
  saldos: "Calculando saldos",
  totales_por_rubro: "Sumando por rubro",
  presupuesto_y_metas: "Mirando el presupuesto",
  conciliacion_de_cuenta: "Revisando la conciliación",
  auditoria: "Leyendo la auditoría",
  compromisos_del_mes: "Revisando los compromisos",
  proponer_movimiento: "Preparando la propuesta",
  proponer_correccion: "Preparando la corrección",
  proponer_transferencia: "Preparando la transferencia",
  proponer_anulacion: "Preparando la anulación",
  proponer_contra_asiento: "Preparando el contra-asiento",
  revisar_extracto: "Cruzando el extracto con el libro",
  leer_planilla: "Leyendo la planilla",
  proponer_adjuntar_comprobante: "Preparando el comprobante",
  proponer_importar_extracto: "Preparando la importación",
};

// ─── Utilidades ────────────────────────────────────────────────────────

type Input = Record<string, unknown>;

const s = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;
const n = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const ok = (data: unknown): ToolOutcome => ({ type: "result", content: JSON.stringify(data) });
const err = (message: string): ToolOutcome => ({ type: "result", content: message, isError: true });

function namesOf(cat: LedgerCatalog): LedgerNames {
  const m = (rows: Array<{ id: string; name: string }>) => new Map(rows.map((r) => [r.id, r.name]));
  return {
    accounts: m(cat.accounts),
    funds: m(cat.funds),
    categories: m(cat.categories),
    subcategories: m(cat.subcategories),
    contributors: m(cat.contributors),
  };
}

/** El catálogo se pide una vez por turno, aunque varias herramientas lo usen. */
const catalogCache = new WeakMap<ToolContext, Promise<LedgerCatalog>>();
function catalogOf(ctx: ToolContext): Promise<LedgerCatalog> {
  let p = catalogCache.get(ctx);
  if (!p) {
    p = getLedgerCatalog(ctx.supabase, ctx.localityId, {
      nationwide: ctx.localityKind === "nacional",
    });
    catalogCache.set(ctx, p);
  }
  return p;
}

function entryRow(e: TreasuryEntry, names: LedgerNames, reconciled: Set<string>) {
  return {
    id: e.id,
    fecha: e.entry_date,
    tipo: entryKind(e),
    cuenta: names.accounts.get(e.account_id) ?? e.account_id,
    moneda: e.currency,
    monto: e.amount,
    rubro: names.subcategories.get(e.subcategory_id) ?? null,
    categoria: names.categories.get(e.category_id) ?? null,
    fondo: e.fund_id ? (names.funds.get(e.fund_id) ?? null) : null,
    detalle: e.description,
    recibo: e.receipt_number,
    recibo_emitido: e.receipt_issued,
    contribuyente: e.contributor_id ? (names.contributors.get(e.contributor_id) ?? null) : null,
    nombre_en_recibo: e.receipt_name,
    aportes_agrupados: e.contributions_count || null,
    anulado: e.voided_at ? { motivo: e.void_reason } : null,
    contra_asiento_de: e.adjusts_entry_id,
    motivo_correccion: e.adjustment_reason,
    transferencia: e.transfer_group_id,
    conciliado: reconciled.has(e.id),
  };
}

async function monthIsClosed(ctx: ToolContext, iso: string): Promise<boolean> {
  const { data, error } = await ctx.supabase.rpc("treasury_month_is_closed", {
    loc: ctx.localityId,
    d: iso,
  });
  return !error && Boolean(data);
}

function money(amount: number, currency: string): string {
  return `${amount < 0 ? "−" : ""}$ ${formatMoney(Math.abs(amount))} ${currency}`;
}

// ─── Lectura ───────────────────────────────────────────────────────────

async function estado(ctx: ToolContext): Promise<ToolOutcome> {
  const [attention, guide] = await Promise.all([
    getTreasuryAttention(ctx.supabase, {
      userId: ctx.userId,
      localityId: ctx.localityId,
      localityKind: ctx.localityKind,
      today: ctx.today,
    }),
    getTreasuryGuide(ctx.supabase, {
      localityId: ctx.localityId,
      localityKind: ctx.localityKind,
      today: ctx.today,
    }),
  ]);
  return ok({
    hoy: ctx.today,
    ejercicio: treasuryYearForDate(ctx.today),
    atencion: [...attention.items, ...attention.hidden].map((i) => ({
      tono: i.tone === "alert" ? "urgente" : "por hacer",
      titulo: i.title,
      detalle: i.detail,
      pantalla: i.href,
      oculta_por_el_tesorero: attention.hidden.includes(i),
    })),
    guia_del_mes: {
      mes: guide.monthLabel,
      pasos: guide.steps.map((st) => ({
        paso: st.order,
        titulo: st.title,
        estado: st.status,
        nota: st.note,
        por_que: st.why,
        como: st.how,
        pantalla: st.href,
      })),
    },
  });
}

async function catalogo(ctx: ToolContext): Promise<ToolOutcome> {
  const cat = await catalogOf(ctx);
  const cats = new Map(cat.categories.map((c) => [c.id, c.name]));
  const funds = new Map(cat.funds.map((f) => [f.id, f.name]));
  return ok({
    cuentas: cat.accounts.map((a) => ({ id: a.id, nombre: a.name, activa: a.is_active })),
    fondos: cat.funds.map((f) => ({ id: f.id, nombre: f.name, activo: f.is_active })),
    categorias: cat.categories.map((c) => ({ id: c.id, nombre: c.name, activa: c.is_active })),
    subcategorias: cat.subcategories.map((sc) => ({
      id: sc.id,
      nombre: sc.name,
      categoria: cats.get(sc.category_id) ?? null,
      fondo_sugerido: sc.default_fund_id ? (funds.get(sc.default_fund_id) ?? null) : null,
      activa: sc.is_active,
    })),
  });
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

async function buscarContribuyente(ctx: ToolContext, input: Input): Promise<ToolOutcome> {
  const q = normalize(s(input.texto) ?? "");
  if (!q) return err("Falta el texto a buscar.");
  const words = q.split(/\s+/).filter(Boolean);
  const hit = (name: string | null) => {
    const h = normalize(name ?? "");
    return words.every((w) => h.includes(w));
  };
  const cat = await catalogOf(ctx);
  const linked = new Set(cat.contributors.map((c) => c.profile_id).filter(Boolean));
  const found = cat.contributors.filter((c) => hit(c.name));
  return ok({
    ...(found.length > 1
      ? { aviso: "Hay más de una coincidencia: si no es obvio cuál es, preguntale al tesorero antes de proponer." }
      : {}),
    contribuyentes: found
      .slice(0, 20)
      .map((c) => ({
        contribuyente_id: c.id,
        nombre: c.name,
        tipo: c.kind,
        vinculado_a_un_creyente: !!c.profile_id,
        activo: c.is_active,
      })),
    creyentes_sin_ficha: cat.members
      .filter((m) => !linked.has(m.id) && hit(m.full_name))
      .slice(0, 20)
      .map((m) => ({ creyente_id: m.id, nombre: m.full_name })),
  });
}

function checkRange(input: Input): { from: string; to: string } | string {
  const from = s(input.desde);
  const to = s(input.hasta);
  if (!from || !to || !isISODate(from) || !isISODate(to)) {
    return "Las fechas van como YYYY-MM-DD.";
  }
  if (from > to) return "La fecha inicial es posterior a la final.";
  return { from, to };
}

async function buscarMovimientos(ctx: ToolContext, input: Input): Promise<ToolOutcome> {
  const range = checkRange(input);
  if (typeof range === "string") return err(range);
  const [cat, entries, reconciled] = await Promise.all([
    catalogOf(ctx),
    getLedgerEntriesByRange(ctx.supabase, range.from, range.to),
    getReconciledEntryIds(ctx.supabase),
  ]);
  const names = namesOf(cat);
  const kind = s(input.tipo);
  const conc = s(input.conciliado);
  const filtered = applyLedgerFilters(
    entries,
    {
      ...EMPTY_FILTERS,
      search: s(input.texto) ?? "",
      accountId: s(input.cuenta_id) ?? "",
      fundId: s(input.fondo_id) ?? "",
      categoryId: s(input.categoria_id) ?? "",
      subcategoryId: s(input.subcategoria_id) ?? "",
      currency: s(input.moneda) ?? "",
      kind: (["ingreso", "gasto", "transferencia", "apertura"].includes(kind ?? "")
        ? kind
        : "") as EntryKind | "",
      reconciled: conc === "si" || conc === "no" ? conc : "",
    },
    names,
    reconciled
  );
  const limit = Math.min(Math.max(n(input.limite) ?? 60, 1), 200);
  return ok({
    encontrados: filtered.length,
    mostrados: Math.min(limit, filtered.length),
    totales_por_moneda: filteredTotals(filtered),
    movimientos: filtered.slice(0, limit).map((e) => entryRow(e, names, reconciled)),
  });
}

async function verMovimientos(ctx: ToolContext, input: Input): Promise<ToolOutcome> {
  const ids = Array.isArray(input.ids) ? input.ids.filter((x): x is string => typeof x === "string") : [];
  if (ids.length === 0) return err("Faltan los ids.");
  const [cat, entries, reconciled] = await Promise.all([
    catalogOf(ctx),
    getLedgerEntriesByIds(ctx.supabase, ids.slice(0, 100)),
    getReconciledEntryIds(ctx.supabase),
  ]);
  const names = namesOf(cat);
  return ok(entries.map((e) => entryRow(e, names, reconciled)));
}

async function saldos(ctx: ToolContext, input: Input): Promise<ToolOutcome> {
  const asOf = s(input.al) ?? ctx.today;
  if (!isISODate(asOf)) return err("La fecha va como YYYY-MM-DD.");
  const [cat, entries] = await Promise.all([
    catalogOf(ctx),
    getLedgerEntriesByRange(ctx.supabase, "1900-01-01", asOf),
  ]);
  const names = namesOf(cat);
  const shape = (rows: ReturnType<typeof balancesBy>) =>
    rows.map((r) => ({ nombre: r.label, moneda: r.currency, saldo: r.amount }));
  return ok({
    al: asOf,
    por_cuenta: shape(balancesBy(entries, "account_id", names.accounts)),
    por_fondo: shape(balancesBy(entries, "fund_id", names.funds, "Sin fondo")),
  });
}

async function totalesPorRubro(ctx: ToolContext, input: Input): Promise<ToolOutcome> {
  const range = checkRange(input);
  if (typeof range === "string") return err(range);
  const [cat, entries] = await Promise.all([
    catalogOf(ctx),
    getLedgerEntriesByRange(ctx.supabase, range.from, range.to),
  ]);
  const names = namesOf(cat);
  const rows = new Map<
    string,
    { categoria: string; subcategoria: string; moneda: string; ingresos: number; gastos: number; movimientos: number }
  >();
  for (const e of entries) {
    const k = entryKind(e);
    if (e.voided_at || k === "transferencia" || k === "apertura") continue;
    const key = `${e.subcategory_id}|${e.currency}`;
    const row = rows.get(key) ?? {
      categoria: names.categories.get(e.category_id) ?? "—",
      subcategoria: names.subcategories.get(e.subcategory_id) ?? "—",
      moneda: e.currency,
      ingresos: 0,
      gastos: 0,
      movimientos: 0,
    };
    if (e.amount > 0) row.ingresos = addMoney(row.ingresos, e.amount);
    else row.gastos = addMoney(row.gastos, e.amount);
    row.movimientos += 1;
    rows.set(key, row);
  }
  return ok({
    desde: range.from,
    hasta: range.to,
    rubros: [...rows.values()].sort(
      (a, b) => a.categoria.localeCompare(b.categoria, "es") || a.subcategoria.localeCompare(b.subcategoria, "es")
    ),
  });
}

async function presupuesto(ctx: ToolContext, input: Input): Promise<ToolOutcome> {
  const asOf = s(input.al) ?? ctx.today;
  if (!isISODate(asOf)) return err("La fecha va como YYYY-MM-DD.");
  const data = await getTreasuryProgress(ctx.supabase, { localityId: ctx.localityId, asOf });
  if (!data) return err("No hay ejercicio para esa fecha.");
  return ok(data);
}

async function conciliacion(ctx: ToolContext, input: Input): Promise<ToolOutcome> {
  const accountId = s(input.cuenta_id);
  if (!accountId) return err("Falta la cuenta.");
  const r = await getAccountReconciliation(ctx.supabase, accountId);
  if (!r) return err("La conciliación todavía no está disponible (falta la migración 061).");
  const line = (l: (typeof r.pending)[number]) => ({
    fecha: l.line_date,
    monto: l.amount,
    moneda: l.currency,
    descripcion: l.description,
    asunto: l.memo,
    referencia: l.reference,
  });
  return ok({
    cobertura_del_extracto: r.coverage,
    saldo_declarado: r.latestBalance,
    totales: r.totals,
    importaciones: r.imports.length,
    lineas_del_extracto_sin_par: r.pending.map(line),
    movimientos_del_libro_sin_par: r.pendingEntries,
    lineas_conciliadas: r.matched.length,
    lineas_descartadas: r.dismissed.length,
    sin_par_en_otras_cuentas: r.elsewhere.map((e) => ({
      id: e.id,
      fecha: e.entry_date,
      monto: e.amount,
      moneda: e.currency,
      cuenta: e.account_name,
      detalle: e.description,
      contribuyente: e.contributor_name,
    })),
  });
}

async function auditoria(ctx: ToolContext): Promise<ToolOutcome> {
  const { data, error } = await ctx.supabase
    .from("treasury_audits")
    .select("id, run_at, period_from, period_to, findings")
    .order("run_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return err("La auditoría todavía no está disponible.");
  if (!data) return ok({ mensaje: "Nunca se corrió una auditoría. Se corre en Tesorería → Auditoría." });
  const audit = data as { run_at: string; period_from: string; period_to: string; findings: unknown };
  const dispositions = await getDispositions(ctx.supabase);
  const decided = new Map(dispositions.map((d) => [d.finding_key, d]));
  const open = findingsOf(audit.findings).filter((f) => {
    const d = decided.get(f.key);
    return !d || d.status === "pendiente";
  });
  return ok({
    corrida: audit.run_at,
    periodo: { desde: audit.period_from, hasta: audit.period_to },
    sin_resolver: open.map((f) => ({
      codigo: f.code,
      gravedad: f.severity,
      titulo: f.title,
      detalle: f.detail,
      cifras: f.figures ?? null,
      movimientos: f.entryIds,
    })),
    resueltos: findingsOf(audit.findings).length - open.length,
  });
}

async function compromisos(ctx: ToolContext, input: Input): Promise<ToolOutcome> {
  const month = s(input.mes) ?? previousMonthKey(monthKeyOf(ctx.today));
  if (!/^\d{4}-\d{2}$/.test(month)) return err("El mes va como YYYY-MM.");
  const r = await getCommitmentMonthReport(ctx.supabase, ctx.localityId, month);
  if (r.schemaMissing) return err("Los compromisos todavía no están disponibles (falta la migración 063).");
  return ok({
    mes: monthLabel(month),
    totales: r.totals,
    con_compromiso: r.rows.map((row) => ({
      nombre: row.display_name,
      compromiso: row.amount,
      moneda: row.currency,
      aportado: row.paid,
      en_otra_moneda: row.otherCurrency,
      por_fondo: row.byFund,
      vinculado_al_libro: row.linked,
      pidio_recordatorio: row.want_reminder,
      telefono: row.phone,
    })),
    aportaron_sin_compromiso: r.others,
  });
}

// ─── Propuestas ────────────────────────────────────────────────────────

type ContributorChoice =
  | { fields: Record<string, string>; label: string }
  | { error: string }
  | null;

/** El contribuyente elegido, verificado contra el catálogo. */
function contributorChoice(cat: LedgerCatalog, input: Input): ContributorChoice {
  const id = s(input.contribuyente_id);
  const profileId = s(input.creyente_id);
  const fresh = s(input.contribuyente_nuevo);
  if (id) {
    const c = cat.contributors.find((x) => x.id === id);
    if (!c) return { error: `No hay un contribuyente con id ${id}. Buscalo con buscar_contribuyente.` };
    return { fields: { contributor_id: id }, label: c.name };
  }
  if (profileId) {
    const m = cat.members.find((x) => x.id === profileId);
    if (!m) return { error: `No hay un creyente de la comunidad con id ${profileId}.` };
    return { fields: { contributor_profile_id: profileId }, label: `${m.full_name ?? "Creyente"} (creyente de la app)` };
  }
  if (fresh) return { fields: { contributor_name: fresh }, label: `${fresh} (contribuyente nuevo)` };
  return null;
}

const HONORIFICS = new Set(["sr", "sra", "srta", "dr", "dra", "flia", "familia"]);
const nameWords = (name: string) =>
  normalize(name)
    .split(/[^a-z0-9ñ]+/)
    .filter((w) => w && !HONORIFICS.has(w));

/** Otras fichas del padrón que parecen la misma persona ("Sr. Carlos Cardona"). */
function lookalikes(cat: LedgerCatalog, contributorId: string | undefined): string[] {
  const me = contributorId && cat.contributors.find((c) => c.id === contributorId);
  if (!me) return [];
  const words = nameWords(me.name);
  if (words.length === 0) return [];
  return cat.contributors
    .filter((c) => c.id !== me.id && c.is_active)
    .filter((c) => {
      const other = nameWords(c.name);
      return words.every((w) => other.includes(w)) || other.every((w) => words.includes(w));
    })
    .map((c) => c.name)
    .slice(0, 4);
}

function proposal(
  toolUseId: string,
  kind: ProposalKind,
  title: string,
  lines: ProposalLine[],
  fields: Record<string, string>,
  warnings: string[] = []
): ToolOutcome {
  return {
    type: "proposal",
    proposal: { toolUseId, kind, title, lines, warnings, fields, status: "pendiente", outcome: null },
  };
}

async function proponerMovimiento(ctx: ToolContext, input: Input, toolUseId: string): Promise<ToolOutcome> {
  const cat = await catalogOf(ctx);
  const date = s(input.fecha);
  const kind = s(input.tipo);
  const amount = n(input.monto);
  const currency = s(input.moneda);
  if (!date || !isISODate(date)) return err("La fecha va como YYYY-MM-DD.");
  if (kind !== "ingreso" && kind !== "gasto") return err("El tipo es ingreso o gasto.");
  if (!amount || amount <= 0) return err("El monto tiene que ser positivo.");
  if (currency !== "UYU" && currency !== "USD") return err("La moneda es UYU o USD.");
  const account = cat.accounts.find((a) => a.id === s(input.cuenta_id));
  if (!account) return err("Esa cuenta no está en el catálogo.");
  const sub = cat.subcategories.find((x) => x.id === s(input.subcategoria_id));
  if (!sub) return err("Esa subcategoría no está en el catálogo.");
  const fundId = s(input.fondo_id) ?? sub.default_fund_id;
  const fund = fundId ? cat.funds.find((f) => f.id === fundId) : null;
  if (fundId && !fund) return err("Ese fondo no está en el catálogo.");
  if (await monthIsClosed(ctx, date)) {
    return err(
      `${monthLabel(monthKeyOf(date))} está cerrado: no se puede cargar ahí. Proponé la fecha de hoy (con la original en el detalle) o un contra-asiento.`
    );
  }
  const who = contributorChoice(cat, input);
  if (who && "error" in who) return err(who.error);
  if (kind === "ingreso" && !who) {
    return err("Un aporte lleva contribuyente: buscalo con buscar_contribuyente o pedile el nombre al tesorero.");
  }

  const category = cat.categories.find((c) => c.id === sub.category_id);
  const warnings: string[] = [];
  const twins = who && "fields" in who ? lookalikes(cat, who.fields.contributor_id) : [];
  if (twins.length > 0) {
    warnings.push(
      `Hay otras fichas con un nombre parecido (${twins.join(", ")}): fijate que sea la correcta. Los dobles se fusionan en Tesorería → Contribuyentes.`
    );
  }
  if (!account.is_active) warnings.push("La cuenta está desactivada en el catálogo.");
  if (!sub.is_active) warnings.push("El rubro está desactivado en el catálogo.");
  if (date > ctx.today) warnings.push("La fecha es posterior a hoy.");

  const count = n(input.cantidad_aportes);
  const receiptName = s(input.nombre_en_recibo);
  const lines: ProposalLine[] = [
    { label: "Fecha", value: date },
    { label: "Monto", value: money(kind === "gasto" ? -amount : amount, currency) },
    { label: "Cuenta", value: account.name },
    { label: "Rubro", value: `${category?.name ?? "—"} · ${sub.name}` },
    { label: "Fondo", value: fund?.name ?? "Sin fondo" },
  ];
  if (who) lines.push({ label: "Contribuyente", value: who.label });
  if (receiptName) lines.push({ label: "En el recibo", value: receiptName });
  if (s(input.detalle)) lines.push({ label: "Detalle", value: s(input.detalle)! });
  if (kind === "ingreso") lines.push({ label: "Recibo", value: "el próximo de la serie" });

  const receipts = await receiptFiles(ctx, input.comprobantes);
  if (typeof receipts === "string") return err(receipts);
  if (receipts.length > 0) lines.push({ label: "Comprobante", value: receipts.map((f) => f.name).join(", ") });

  return withFiles(receipts, proposal(
    toolUseId,
    "movimiento",
    kind === "ingreso" ? "Registrar un aporte" : "Registrar un gasto",
    lines,
    {
      entry_date: date,
      bahai_year: String(treasuryYearForDate(date) ?? ""),
      direction: kind,
      account_id: account.id,
      subcategory_id: sub.id,
      fund_id: fund?.id ?? "",
      currency,
      amount: String(amount),
      description: s(input.detalle) ?? "",
      receipt_name: receiptName ?? "",
      contributions_count: count ? String(count) : "",
      ...(who ? who.fields : {}),
    },
    warnings
  ));
}

async function loadOne(ctx: ToolContext, id: string | null): Promise<TreasuryEntry | null> {
  if (!id) return null;
  const [e] = await getLedgerEntriesByIds(ctx.supabase, [id]);
  return e ?? null;
}

async function proponerCorreccion(ctx: ToolContext, input: Input, toolUseId: string): Promise<ToolOutcome> {
  const e = await loadOne(ctx, s(input.movimiento_id));
  if (!e) return err("Ese movimiento no existe.");
  if (e.voided_at) return err("Ese movimiento está anulado: no se corrige.");
  if (e.transfer_group_id || e.is_opening_balance) {
    return err("Las transferencias y los saldos de apertura no se corrigen así: se revierten con un contra-asiento.");
  }
  if (e.receipt_issued) {
    return err(`El recibo N.º ${e.receipt_number} ya fue emitido: se anula (proponer_anulacion) y se carga uno nuevo.`);
  }
  if (await monthIsClosed(ctx, e.entry_date)) {
    return err(`${monthLabel(monthKeyOf(e.entry_date))} está cerrado: se corrige con un contra-asiento.`);
  }
  const cat = await catalogOf(ctx);
  const names = namesOf(cat);
  const date = s(input.fecha) ?? e.entry_date;
  if (!isISODate(date)) return err("La fecha va como YYYY-MM-DD.");
  if (date !== e.entry_date && (await monthIsClosed(ctx, date))) {
    return err(`${monthLabel(monthKeyOf(date))} está cerrado: no se puede mover ahí.`);
  }
  const accountId = s(input.cuenta_id) ?? e.account_id;
  const subId = s(input.subcategoria_id) ?? e.subcategory_id;
  const sub = cat.subcategories.find((x) => x.id === subId);
  if (!names.accounts.has(accountId)) return err("Esa cuenta no está en el catálogo.");
  if (!sub) return err("Esa subcategoría no está en el catálogo.");
  const fundId = s(input.fondo_id) ?? (s(input.subcategoria_id) ? sub.default_fund_id : e.fund_id);
  if (fundId && !names.funds.has(fundId)) return err("Ese fondo no está en el catálogo.");
  const currency = s(input.moneda) ?? e.currency;
  if (currency !== "UYU" && currency !== "USD") return err("La moneda es UYU o USD.");
  const amount = n(input.monto) ?? Math.abs(e.amount);
  if (amount <= 0) return err("El monto tiene que ser positivo.");
  const description = s(input.detalle) ?? e.description ?? "";
  const who = contributorChoice(cat, input);
  if (who && "error" in who) return err(who.error);

  const changes: ProposalLine[] = [];
  const diff = (label: string, before: string, after: string) => {
    if (before !== after) changes.push({ label, value: `${before} → ${after}` });
  };
  diff("Fecha", e.entry_date, date);
  diff("Cuenta", names.accounts.get(e.account_id) ?? "—", names.accounts.get(accountId) ?? "—");
  diff("Rubro", names.subcategories.get(e.subcategory_id) ?? "—", sub.name);
  diff(
    "Fondo",
    (e.fund_id && names.funds.get(e.fund_id)) || "Sin fondo",
    (fundId && names.funds.get(fundId)) || "Sin fondo"
  );
  diff("Moneda", e.currency, currency);
  diff("Monto", formatMoney(Math.abs(e.amount)), formatMoney(amount));
  diff("Detalle", e.description ?? "", description);
  if (who) {
    diff("Contribuyente", (e.contributor_id && names.contributors.get(e.contributor_id)) || "—", who.label);
  }
  if (changes.length === 0) return err("La corrección no cambia nada.");

  const lines: ProposalLine[] = [
    {
      label: "Movimiento",
      value: `${e.entry_date} · ${money(e.amount, e.currency)} · ${names.subcategories.get(e.subcategory_id) ?? ""}${
        e.receipt_number ? ` · recibo N.º ${e.receipt_number}` : ""
      }`,
    },
    ...changes,
  ];
  return proposal(toolUseId, "correccion", "Corregir un movimiento", lines, {
    id: e.id,
    entry_date: date,
    bahai_year: String(treasuryYearForDate(date) ?? ""),
    direction: e.amount > 0 ? "ingreso" : "gasto",
    account_id: accountId,
    subcategory_id: sub.id,
    fund_id: fundId ?? "",
    currency,
    amount: String(amount),
    description,
    receipt_number: e.receipt_number ? String(e.receipt_number) : "",
    contributions_count: e.contributions_count ? String(e.contributions_count) : "",
    receipt_name: e.receipt_name ?? "",
    ...(who ? who.fields : e.contributor_id ? { contributor_id: e.contributor_id } : {}),
  });
}

async function proponerTransferencia(ctx: ToolContext, input: Input, toolUseId: string): Promise<ToolOutcome> {
  const cat = await catalogOf(ctx);
  const date = s(input.fecha);
  if (!date || !isISODate(date)) return err("La fecha va como YYYY-MM-DD.");
  const from = cat.accounts.find((a) => a.id === s(input.cuenta_origen_id));
  const to = cat.accounts.find((a) => a.id === s(input.cuenta_destino_id));
  if (!from || !to) return err("Alguna de las cuentas no está en el catálogo.");
  const outCur = s(input.moneda_sale);
  const inCur = s(input.moneda_entra);
  const outAmt = n(input.monto_sale);
  const inAmt = n(input.monto_entra);
  if (!outCur || !inCur || !["UYU", "USD"].includes(outCur) || !["UYU", "USD"].includes(inCur)) {
    return err("Las monedas son UYU o USD.");
  }
  if (!outAmt || outAmt <= 0 || !inAmt || inAmt <= 0) return err("Los montos tienen que ser positivos.");
  if (from.id === to.id && outCur === inCur) return err("Origen y destino son la misma cuenta y moneda.");
  if (outCur === inCur && outAmt !== inAmt) {
    return err("En la misma moneda sale y entra lo mismo; la comisión del giro es un gasto aparte.");
  }
  const sub = cat.subcategories.find((x) => x.id === s(input.subcategoria_id));
  if (!sub) return err("Esa subcategoría no está en el catálogo.");
  if (await monthIsClosed(ctx, date)) return err(`${monthLabel(monthKeyOf(date))} está cerrado.`);

  const lines: ProposalLine[] = [
    { label: "Fecha", value: date },
    { label: "Sale de", value: `${from.name} · ${money(-outAmt, outCur)}` },
    { label: "Entra a", value: `${to.name} · ${money(inAmt, inCur)}` },
    { label: "Rubro", value: sub.name },
  ];
  if (outCur !== inCur) {
    const rate = outCur === "UYU" ? outAmt / inAmt : inAmt / outAmt;
    lines.push({ label: "Cambio", value: `$ ${formatMoney(rate)} por dólar (la cotización BCU se guarda al registrar)` });
  }
  if (s(input.detalle)) lines.push({ label: "Detalle", value: s(input.detalle)! });
  return proposal(toolUseId, "transferencia", "Registrar una transferencia", lines, {
    entry_date: date,
    bahai_year: String(treasuryYearForDate(date) ?? ""),
    from_account_id: from.id,
    to_account_id: to.id,
    from_currency: outCur,
    to_currency: inCur,
    from_amount: String(outAmt),
    to_amount: String(inAmt),
    subcategory_id: sub.id,
    fund_id: sub.default_fund_id ?? "",
    description: s(input.detalle) ?? "",
  });
}

async function proponerSobreUno(
  ctx: ToolContext,
  input: Input,
  toolUseId: string,
  kind: "anulacion" | "contra_asiento"
): Promise<ToolOutcome> {
  const e = await loadOne(ctx, s(input.movimiento_id));
  if (!e) return err("Ese movimiento no existe.");
  const reason = s(input.motivo);
  if (!reason || reason.length < 3) return err("Falta el motivo.");
  if (e.voided_at) return err("Ese movimiento ya está anulado.");
  const closed = await monthIsClosed(ctx, e.entry_date);
  if (kind === "anulacion") {
    if (e.transfer_group_id || e.is_opening_balance) {
      return err("Las transferencias y los saldos de apertura no se anulan: se revierten con un contra-asiento.");
    }
    if (closed) return err(`${monthLabel(monthKeyOf(e.entry_date))} está cerrado: se revierte con un contra-asiento.`);
  } else if (await monthIsClosed(ctx, ctx.today)) {
    return err("El mes de hoy está cerrado: no hay dónde cargar el contra-asiento.");
  }
  const cat = await catalogOf(ctx);
  const names = namesOf(cat);
  const lines: ProposalLine[] = [
    { label: "Fecha", value: e.entry_date },
    { label: "Monto", value: money(e.amount, e.currency) },
    { label: "Cuenta", value: names.accounts.get(e.account_id) ?? "—" },
    { label: "Rubro", value: names.subcategories.get(e.subcategory_id) ?? "—" },
  ];
  if (e.receipt_number) lines.push({ label: "Recibo", value: `N.º ${e.receipt_number}` });
  if (e.contributor_id) lines.push({ label: "Contribuyente", value: names.contributors.get(e.contributor_id) ?? "—" });
  if (e.description) lines.push({ label: "Detalle", value: e.description });
  lines.push({ label: "Motivo", value: reason });
  const warnings =
    kind === "contra_asiento"
      ? [
          e.transfer_group_id
            ? `Se revierten las dos patas de la transferencia, con fecha de hoy (${ctx.today}).`
            : `Se carga el mismo movimiento con el monto invertido, con fecha de hoy (${ctx.today}).`,
        ]
      : ["Queda en el libro sin sumar; su número de recibo sigue ocupado en la serie."];
  return proposal(
    toolUseId,
    kind,
    kind === "anulacion" ? "Anular un movimiento" : "Revertir con un contra-asiento",
    lines,
    { id: e.id, reason, bahai_year: String(treasuryYearForDate(ctx.today) ?? "") },
    warnings
  );
}

// ─── Archivos adjuntos (092) ───────────────────────────────────────────

/** Le pone a una propuesta los archivos que usa. */
function withFiles(files: AttachedFile[], out: ToolOutcome): ToolOutcome {
  if (out.type === "proposal" && files.length > 0) out.proposal.files = files;
  return out;
}

const asAttached = (row: FileRow): AttachedFile => ({ id: row.id, name: row.file_name, kind: row.kind });

/**
 * Los comprobantes que pidió el modelo: tienen que ser imágenes o PDF de
 * las conversaciones de esta persona (la RLS de la 092 no devuelve otros).
 * Devuelve el error en palabras si alguno no sirve.
 */
async function receiptFiles(ctx: ToolContext, raw: unknown): Promise<AttachedFile[] | string> {
  const ids = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string" && x.length > 0) : [];
  const out: AttachedFile[] = [];
  for (const id of [...new Set(ids)].slice(0, 5)) {
    const row = await getFile(ctx.supabase, id);
    if (!row) return `El archivo ${id} no está en la conversación.`;
    if (row.kind === "planilla") return `"${row.file_name}" es una planilla: un comprobante es una imagen o un PDF.`;
    out.push(asAttached(row));
  }
  return out;
}

/** Un extracto adjunto, ya leído. */
async function statementFile(ctx: ToolContext, input: Input) {
  const row = await getFile(ctx.supabase, s(input.archivo_id));
  if (!row) return { error: "Ese archivo no está en la conversación." } as const;
  if (row.kind !== "planilla") return { error: `"${row.file_name}" no es una planilla: un extracto es el Excel que exporta la plataforma.` } as const;
  const cat = await catalogOf(ctx);
  const account = cat.accounts.find((a) => a.id === s(input.cuenta_id));
  if (!account) return { error: "Esa cuenta no está en el catálogo." } as const;
  const parsed = parseStatement(readStatementRows(await readFileBuffer(ctx.supabase, row)));
  if ("error" in parsed) return { error: parsed.error } as const;

  // Los mismos avisos que da Conciliación al importar: no bloquean.
  const warnings = [...parsed.warnings];
  const platformWord = { prex: /prex/i, brou: /brou/i, mercadopago: /mercado\s*(pago|libre)|\bmp\b|point|pos\b/i }[
    parsed.platform
  ];
  if (!platformWord.test(account.name)) {
    warnings.unshift(`El archivo es de ${PLATFORM_LABELS[parsed.platform]} y la cuenta elegida es "${account.name}".`);
  }
  const currency = parsed.lines[0]?.currency ?? "UYU";
  if (currency === "USD" && /peso/i.test(account.name)) warnings.unshift(`El extracto está en dólares y la cuenta es "${account.name}".`);
  if (currency === "UYU" && /d[oó]lar|usd/i.test(account.name)) warnings.unshift(`El extracto está en pesos y la cuenta es "${account.name}".`);

  // Cuántas líneas ya están importadas (misma huella que Conciliación).
  const fingerprints = assignFingerprints(parsed.lines);
  const { data: knownRows } = await ctx.supabase
    .from("treasury_statement_lines")
    .select("fingerprint")
    .eq("account_id", account.id)
    .in("fingerprint", [...fingerprints.values()]);
  const known = new Set(((knownRows ?? []) as Array<{ fingerprint: string }>).map((r) => r.fingerprint));
  const alreadyImported = parsed.lines.filter((l) => known.has(fingerprints.get(l.key)!)).length;

  return { row, account, parsed, warnings, alreadyImported } as const;
}

const lineOut = (l: StatementLine) => ({
  fila: l.row,
  fecha: l.date,
  monto: l.amount,
  moneda: l.currency,
  descripcion: l.description,
  ...(l.memo ? { asunto: l.memo } : {}),
  ...(l.grossAmount != null ? { valor_bruto: l.grossAmount } : {}),
});

const entryOut = (e: ReconcileEntry) => ({
  id: e.id,
  fecha: e.entry_date,
  monto: e.amount,
  moneda: e.currency,
  rubro: e.rubro,
  detalle: e.description,
  recibo: e.receipt_number,
});

async function revisarExtracto(ctx: ToolContext, input: Input): Promise<ToolOutcome> {
  const st = await statementFile(ctx, input);
  if ("error" in st) return err(st.error!);
  const { account, parsed } = st;
  const rubroOf = await getRubroNames(ctx.supabase);
  const { entries, error } = await getAccountEntries(
    ctx.supabase,
    account.id,
    shiftDate(parsed.to, DEFAULT_WINDOW_DAYS),
    rubroOf
  );
  if (error) return err(`No pude leer el libro: ${error}`);
  // Contra TODO el libro de la cuenta, haya o no pares guardados: es un
  // chequeo del archivo contra el libro, no del estado de Conciliación.
  const result = reconcile(parsed.lines, entries, {
    from: parsed.from,
    to: parsed.to,
    statementBalance: parsed.closingBalance
      ? { amount: parsed.closingBalance.amount, currency: parsed.closingBalance.currency }
      : null,
  });
  const LIMIT = 80;
  return ok({
    plataforma: PLATFORM_LABELS[parsed.platform],
    cuenta: account.name,
    desde: parsed.from,
    hasta: parsed.to,
    lineas: parsed.lines.length,
    ya_importadas_en_conciliacion: st.alreadyImported,
    filas_omitidas: parsed.skipped.slice(0, 20),
    avisos: st.warnings,
    todo_cierra: result.clean,
    totales: result.totals,
    cerraron: result.matched.slice(0, LIMIT).map((m) => ({
      tipo: m.kind,
      lineas: m.lines.map(lineOut),
      movimientos: m.entries.map(entryOut),
      dias_de_diferencia: m.dayDiff,
      ...(m.missingFee ? { comision_sin_registrar: m.missingFee } : {}),
    })),
    devueltas_por_la_plataforma: result.reversed.map((r) => ({ salida: lineOut(r.out), devolucion: lineOut(r.back) })),
    en_extracto_y_no_en_libro: result.unmatchedLines.slice(0, LIMIT).map(lineOut),
    en_libro_y_no_en_extracto: result.unmatchedEntries.slice(0, LIMIT).map(entryOut),
    ...(result.matched.length > LIMIT || result.unmatchedLines.length > LIMIT || result.unmatchedEntries.length > LIMIT
      ? { aviso: `Las listas se cortaron en ${LIMIT}.` }
      : {}),
  });
}

async function leerPlanilla(ctx: ToolContext, input: Input): Promise<ToolOutcome> {
  const row = await getFile(ctx.supabase, s(input.archivo_id));
  if (!row) return err("Ese archivo no está en la conversación.");
  if (row.kind !== "planilla") return err(`"${row.file_name}" no es una planilla.`);
  const sheets = readSheets(await readFileBuffer(ctx.supabase, row));
  if (sheets.length === 0) return err("La planilla no tiene hojas.");
  const wanted = s(input.hoja);
  const sheet = wanted ? sheets.find((sh) => sh.name.toLowerCase() === wanted.toLowerCase()) : sheets[0];
  if (!sheet) return err(`No hay una hoja "${wanted}". Las hojas son: ${sheets.map((sh) => sh.name).join(", ")}.`);
  const from = Math.max(1, Math.floor(n(input.desde_fila) ?? 1));
  const count = Math.min(400, Math.max(1, Math.floor(n(input.filas) ?? 150)));
  // Una fila es la lista de sus celdas como texto; las vacías del final
  // se recortan y una celda larga se corta, para que entre más planilla.
  const rows: Array<{ fila: number; celdas: string[] }> = [];
  let chars = 0;
  for (let i = from - 1; i < sheet.rows.length && rows.length < count; i++) {
    const cells = (sheet.rows[i] ?? []).map((c) => String(c ?? "").trim().slice(0, 120));
    while (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
    if (cells.length === 0) continue;
    chars += cells.join("|").length;
    if (chars > 60000) break;
    rows.push({ fila: i + 1, celdas: cells });
  }
  const last = rows[rows.length - 1]?.fila ?? from;
  return ok({
    hojas: sheets.map((sh) => ({ nombre: sh.name, filas: sh.rows.length })),
    hoja: sheet.name,
    filas: rows,
    ...(last < sheet.rows.length ? { sigue_desde_fila: last + 1 } : {}),
  });
}

async function proponerAdjuntarComprobante(ctx: ToolContext, input: Input, toolUseId: string): Promise<ToolOutcome> {
  const e = await loadOne(ctx, s(input.movimiento_id));
  if (!e) return err("Ese movimiento no existe.");
  if (e.voided_at) return err("Ese movimiento está anulado.");
  const files = await receiptFiles(ctx, input.archivos);
  if (typeof files === "string") return err(files);
  if (files.length === 0) return err("Falta el archivo a adjuntar.");
  const names = namesOf(await catalogOf(ctx));
  const { count } = await ctx.supabase
    .from("treasury_attachments")
    .select("id", { count: "exact", head: true })
    .eq("entry_id", e.id);
  const lines: ProposalLine[] = [
    { label: "Movimiento", value: `${e.entry_date} · ${money(e.amount, e.currency)}` },
    { label: "Cuenta", value: names.accounts.get(e.account_id) ?? "—" },
    { label: "Rubro", value: names.subcategories.get(e.subcategory_id) ?? "—" },
  ];
  if (e.description) lines.push({ label: "Detalle", value: e.description });
  lines.push({ label: files.length > 1 ? "Comprobantes" : "Comprobante", value: files.map((f) => f.name).join(", ") });
  const warnings: string[] = [];
  if (count) warnings.push(`El movimiento ya tiene ${count === 1 ? "un comprobante" : `${count} comprobantes`}: este se suma.`);
  if (e.amount > 0) warnings.push("Es un ingreso: el comprobante de un aporte suele ser el recibo que emitimos.");
  return withFiles(
    files,
    proposal(toolUseId, "comprobante", files.length > 1 ? "Adjuntar comprobantes" : "Adjuntar un comprobante", lines, { entry_id: e.id }, warnings)
  );
}

async function proponerImportarExtracto(ctx: ToolContext, input: Input, toolUseId: string): Promise<ToolOutcome> {
  const st = await statementFile(ctx, input);
  if ("error" in st) return err(st.error!);
  const { row, account, parsed, alreadyImported } = st;
  const warnings = [...st.warnings];
  if (row.size_bytes > 2 * 1024 * 1024) warnings.push("El archivo pesa más de 2 MB: Conciliación lo va a rechazar.");
  if (alreadyImported === parsed.lines.length) warnings.push("Todas las líneas ya están importadas: no va a sumar nada.");
  const lines: ProposalLine[] = [
    { label: "Archivo", value: row.file_name },
    { label: "Plataforma", value: PLATFORM_LABELS[parsed.platform] },
    { label: "Cuenta", value: account.name },
    { label: "Período", value: `${parsed.from} al ${parsed.to}` },
    {
      label: "Líneas",
      value: `${parsed.lines.length}${alreadyImported > 0 ? ` (${alreadyImported} ya estaban, no se duplican)` : ""}`,
    },
  ];
  return withFiles(
    [asAttached(row)],
    proposal(toolUseId, "importar_extracto", "Importar el extracto a Conciliación", lines, { account_id: account.id }, warnings)
  );
}

// ─── Despacho ──────────────────────────────────────────────────────────

export async function runTool(
  ctx: ToolContext,
  name: string,
  input: Input,
  toolUseId: string
): Promise<ToolOutcome> {
  try {
    switch (name) {
      case "estado_de_la_tesoreria":
        return await estado(ctx);
      case "catalogo":
        return await catalogo(ctx);
      case "buscar_contribuyente":
        return await buscarContribuyente(ctx, input);
      case "buscar_movimientos":
        return await buscarMovimientos(ctx, input);
      case "ver_movimientos":
        return await verMovimientos(ctx, input);
      case "saldos":
        return await saldos(ctx, input);
      case "totales_por_rubro":
        return await totalesPorRubro(ctx, input);
      case "presupuesto_y_metas":
        return await presupuesto(ctx, input);
      case "conciliacion_de_cuenta":
        return await conciliacion(ctx, input);
      case "auditoria":
        return await auditoria(ctx);
      case "compromisos_del_mes":
        return await compromisos(ctx, input);
      case "proponer_movimiento":
        return await proponerMovimiento(ctx, input, toolUseId);
      case "proponer_correccion":
        return await proponerCorreccion(ctx, input, toolUseId);
      case "proponer_transferencia":
        return await proponerTransferencia(ctx, input, toolUseId);
      case "proponer_anulacion":
        return await proponerSobreUno(ctx, input, toolUseId, "anulacion");
      case "proponer_contra_asiento":
        return await proponerSobreUno(ctx, input, toolUseId, "contra_asiento");
      case "revisar_extracto":
        return await revisarExtracto(ctx, input);
      case "leer_planilla":
        return await leerPlanilla(ctx, input);
      case "proponer_adjuntar_comprobante":
        return await proponerAdjuntarComprobante(ctx, input, toolUseId);
      case "proponer_importar_extracto":
        return await proponerImportarExtracto(ctx, input, toolUseId);
      default:
        return err(`No existe la herramienta ${name}.`);
    }
  } catch (e) {
    console.error(`[treasury-assistant] ${name}`, e);
    return err(`Falló la consulta: ${e instanceof Error ? e.message : String(e)}`);
  }
}
