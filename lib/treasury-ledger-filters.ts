/**
 * Filtros, totales y exportación de la lista del Libro.
 *
 * Módulo PURO (sin React, sin queries), por la misma razón que
 * `lib/treasury-cashbook.ts`: lo usan la lista y el botón de exportar, y
 * los dos tienen que decir exactamente lo mismo. Si el CSV se armara por
 * su cuenta, el archivo que el tesorero pone al lado del extracto podría
 * no coincidir con lo que está viendo en pantalla, que es justo el error
 * que se paga caro cuando se está buscando una diferencia.
 *
 * Los filtros de acá trabajan sobre lo que YA está cargado. El rango de
 * fechas es el único que no: ese viaja en la URL y lo resuelve el
 * servidor, porque un extracto puede cruzar el corte de Riḍván y
 * entonces sus movimientos viven en dos años bahá'ís distintos.
 */

import type { TreasuryEntry } from "./treasury-ledger";
import { addMoney } from "./treasury-format";

/** Qué clase de movimiento es, para el filtro por tipo. */
export type EntryKind = "ingreso" | "gasto" | "transferencia" | "apertura";

/**
 * Un saldo de apertura y una pata de transferencia NO son ingreso ni
 * gasto, aunque tengan signo: es el mismo criterio de `periodTotals()` y
 * del informe. Importa para conciliar: ninguno de los dos aparece como
 * aporte ni como pago en un extracto, y confundirlos es la fuente más
 * común de una diferencia que no cierra.
 */
export function entryKind(e: TreasuryEntry): EntryKind {
  if (e.is_opening_balance) return "apertura";
  if (e.transfer_group_id) return "transferencia";
  return e.amount >= 0 ? "ingreso" : "gasto";
}

export const KIND_LABELS: Record<EntryKind, string> = {
  ingreso: "Ingresos",
  gasto: "Gastos",
  transferencia: "Transferencias internas",
  apertura: "Saldos de apertura",
};

export type LedgerFilters = {
  /** Texto libre: descripción, rubro, cuenta, contribuyente, recibo. */
  search: string;
  accountId: string;
  fundId: string;
  categoryId: string;
  subcategoryId: string;
  currency: string;
  kind: EntryKind | "";
  /** "si" = ya cerró contra el extracto; "no" = todavía no (061). */
  reconciled: "" | "si" | "no";
};

export const EMPTY_FILTERS: LedgerFilters = {
  search: "",
  accountId: "",
  fundId: "",
  categoryId: "",
  subcategoryId: "",
  currency: "",
  kind: "",
  reconciled: "",
};

/** Cuántos filtros están puestos, para el contador del botón. */
export function activeFilterCount(f: LedgerFilters): number {
  return (Object.keys(EMPTY_FILTERS) as Array<keyof LedgerFilters>).filter(
    (k) => f[k] !== ""
  ).length;
}

/** Los nombres del catálogo ya resueltos, para buscar y para exportar. */
export type LedgerNames = {
  accounts: Map<string, string>;
  funds: Map<string, string>;
  categories: Map<string, string>;
  subcategories: Map<string, string>;
  contributors: Map<string, string>;
};

export function applyLedgerFilters(
  entries: TreasuryEntry[],
  f: LedgerFilters,
  names: LedgerNames,
  reconciled: Set<string>
): TreasuryEntry[] {
  const q = f.search.trim().toLowerCase();
  return entries.filter((e) => {
    if (f.accountId && e.account_id !== f.accountId) return false;
    if (f.fundId && e.fund_id !== f.fundId) return false;
    if (f.categoryId && e.category_id !== f.categoryId) return false;
    if (f.subcategoryId && e.subcategory_id !== f.subcategoryId) return false;
    if (f.currency && e.currency !== f.currency) return false;
    if (f.kind && entryKind(e) !== f.kind) return false;
    if (f.reconciled === "si" && !reconciled.has(e.id)) return false;
    if (f.reconciled === "no" && reconciled.has(e.id)) return false;
    if (!q) return true;
    const haystack = [
      e.description ?? "",
      names.subcategories.get(e.subcategory_id) ?? "",
      names.accounts.get(e.account_id) ?? "",
      e.contributor_id ? (names.contributors.get(e.contributor_id) ?? "") : "",
      e.receipt_name ?? "",
      e.receipt_number ? String(e.receipt_number) : "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export type FilteredTotal = {
  currency: string;
  count: number;
  income: number;
  expense: number;
  internal: number;
  opening: number;
  /** Ingresos + gastos: lo que entró y salió de verdad en la selección.
   *  Es el número que se compara contra el neto del extracto. */
  net: number;
};

/**
 * Totales de lo que quedó a la vista, por moneda.
 *
 * Es la pieza que faltaba para cuadrar contra un extracto: filtrar sin
 * ver el total de lo filtrado deja al tesorero sumando a mano. El neto
 * deja afuera las transferencias y las aperturas a propósito —no son
 * movimiento del Fondo— y las informa aparte, porque una transferencia
 * SÍ sale en el extracto de la cuenta que la envió.
 *
 * Los anulados (054) no suman en ninguna columna, pero se cuentan en
 * `count`: están a la vista, tachados, y el contador tiene que
 * corresponderse con lo que se ve.
 */
export function filteredTotals(entries: TreasuryEntry[]): FilteredTotal[] {
  const byCurrency = new Map<string, FilteredTotal>();
  for (const e of entries) {
    const row = byCurrency.get(e.currency) ?? {
      currency: e.currency,
      count: 0,
      income: 0,
      expense: 0,
      internal: 0,
      opening: 0,
      net: 0,
    };
    row.count += 1;
    if (!e.voided_at) {
      const kind = entryKind(e);
      if (kind === "apertura") row.opening = addMoney(row.opening, e.amount);
      else if (kind === "transferencia")
        row.internal = addMoney(row.internal, e.amount);
      else if (kind === "ingreso") row.income = addMoney(row.income, e.amount);
      else row.expense = addMoney(row.expense, e.amount);
      row.net = addMoney(row.income, row.expense);
    }
    byCurrency.set(e.currency, row);
  }
  return [...byCurrency.values()].sort((a, b) =>
    a.currency.localeCompare(b.currency)
  );
}

/** El estado de la fila, en palabras, para la columna del CSV. */
export function entryStateLabel(e: TreasuryEntry): string {
  const parts: string[] = [];
  if (e.voided_at) parts.push("ANULADO");
  if (e.adjusts_entry_id) parts.push("contra-asiento");
  if (e.receipt_issued) parts.push("recibo emitido");
  return parts.join(" · ");
}

const CSV_HEADERS = [
  "Fecha",
  "Cuenta",
  "Categoría",
  "Subcategoría",
  "Fondo",
  "Descripción",
  "Contribuyente",
  "Recibo",
  "Moneda",
  "Ingreso",
  "Gasto",
  "Conciliado",
  "Estado",
];

/**
 * Lo filtrado, como CSV para Excel.
 *
 * Dos decisiones de formato, las dos porque el destino es un Excel en
 * español: separador `;` (en es-UY el separador de lista es el punto y
 * coma, y con `,` Excel mete toda la fila en una sola celda) y coma
 * decimal en los importes, para que la columna se pueda sumar sin
 * convertirla a mano. El BOM del principio es lo que hace que los
 * acentos no salgan rotos.
 *
 * `showNames` viene de la pantalla: si los nombres están ocultos, el
 * archivo tampoco los lleva. El CSV es una copia de lo que se está
 * mirando, no una puerta lateral a los datos confidenciales.
 */
export function ledgerCSV(
  entries: TreasuryEntry[],
  names: LedgerNames,
  reconciled: Set<string>,
  opts: { showNames: boolean }
): string {
  const rows = [CSV_HEADERS];
  for (const e of entries) {
    rows.push([
      e.entry_date,
      names.accounts.get(e.account_id) ?? "",
      names.categories.get(e.category_id) ?? "",
      names.subcategories.get(e.subcategory_id) ?? "",
      e.fund_id ? (names.funds.get(e.fund_id) ?? "") : "",
      e.description ?? "",
      contributorCell(e, names, opts.showNames),
      e.receipt_number ? String(e.receipt_number) : "",
      e.currency,
      e.amount > 0 ? csvAmount(e.amount) : "",
      e.amount < 0 ? csvAmount(-e.amount) : "",
      reconciled.has(e.id) ? "sí" : "no",
      entryStateLabel(e),
    ]);
  }
  return "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
}

function contributorCell(
  e: TreasuryEntry,
  names: LedgerNames,
  showNames: boolean
): string {
  if (!e.contributor_id) {
    return e.contributions_count > 1 ? `${e.contributions_count} aportes` : "";
  }
  if (!showNames) return "(nombre oculto)";
  const name = names.contributors.get(e.contributor_id) ?? "";
  return e.receipt_name ? `${name} (${e.receipt_name})` : name;
}

/** Importe con coma decimal y sin separador de miles: así Excel es-UY lo
 *  reconoce como número y la columna se puede totalizar. */
function csvAmount(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

function csvCell(value: string): string {
  const v = value ?? "";
  return /[";\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function isISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

const SHORT_MONTHS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "set", "oct", "nov", "dic",
];

/** "2026-04-01" + "2026-04-30" → "1 abr – 30 abr 2026". El año se
 *  imprime una sola vez cuando las dos puntas caen en el mismo. */
export function formatRangeLabel(from: string, to: string): string {
  const a = from.split("-").map((p) => parseInt(p, 10));
  const b = to.split("-").map((p) => parseInt(p, 10));
  const left = `${a[2]} ${SHORT_MONTHS[a[1] - 1] ?? ""}`;
  const right = `${b[2]} ${SHORT_MONTHS[b[1] - 1] ?? ""} ${b[0]}`;
  return a[0] === b[0] ? `${left} – ${right}` : `${left} ${a[0]} – ${right}`;
}

/** Nombre del archivo, con el encuadre adentro para no pisar descargas. */
export function ledgerCSVFilename(scope: string): string {
  const slug = scope
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `libro-${slug || "movimientos"}.csv`;
}
