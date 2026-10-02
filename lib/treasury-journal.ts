/**
 * El Libro como Libro Diario: cada movimiento en partida doble, con Debe y
 * Haber, para el contador.
 *
 * El libro de la app es un libro de CAJA: cada movimiento se carga una vez,
 * con la cuenta (dónde está la plata) y el rubro (qué es). Las dos caras del
 * asiento ya están ahí; este módulo solo las escribe:
 *
 *  · Ingreso — Debe la cuenta, Haber el rubro ("Debe Banco / Haber
 *    Alquileres").
 *  · Gasto — Debe el rubro, Haber la cuenta.
 *  · Contra-asiento (054) — por el signo cae solo del lado contrario, que es
 *    exactamente revertir.
 *  · Saldo de apertura — Debe la cuenta, Haber "Saldo de apertura".
 *  · Transferencia — las dos patas en UN asiento: Debe la cuenta que recibe,
 *    Haber la que entrega. Entre monedas no se puede igualar pesos con
 *    dólares, así que el asiento pasa por "Cambio de moneda": cuadra en cada
 *    moneda por separado (nunca se suman monedas distintas) y el concepto
 *    lleva el tipo de cambio de los dos montos y el del BCU (078).
 *
 * Los anulados no entran: no tienen efecto contable. Tampoco los nombres de
 * contribuyentes, por la misma regla del Libro de Caja: es un documento que
 * sale de las manos del tesorero.
 *
 * PURO (sin React ni queries), como `treasury-ledger-filters.ts`.
 */

import type { TreasuryEntry } from "./treasury-ledger";
import type { LedgerNames } from "./treasury-ledger-filters";

export const OPENING_ACCOUNT = "Saldo de apertura";
export const FX_ACCOUNT = "Cambio de moneda";

export type JournalLine = {
  account: string;
  currency: "UYU" | "USD";
  debit: number;
  credit: number;
  fund: string;
};

export type JournalEntry = {
  number: number;
  date: string;
  concept: string;
  lines: JournalLine[];
};

const round = (n: number) => Math.round(n * 100) / 100;

function rubro(e: TreasuryEntry, names: LedgerNames): string {
  const cat = names.categories.get(e.category_id) ?? "";
  const sub = names.subcategories.get(e.subcategory_id) ?? "";
  if (!cat) return sub || "Sin rubro";
  if (!sub || sub === cat) return cat;
  return `${cat} / ${sub}`;
}

function concept(e: TreasuryEntry, names: LedgerNames): string {
  const parts: string[] = [];
  if (e.description) parts.push(e.description);
  else parts.push(names.subcategories.get(e.subcategory_id) ?? "");
  if (e.receipt_number) parts.push(`Recibo N.º ${e.receipt_number}`);
  if (e.contributions_count > 1) parts.push(`${e.contributions_count} aportes`);
  if (e.adjusts_entry_id) {
    parts.push(`Contra-asiento${e.adjustment_reason ? `: ${e.adjustment_reason}` : ""}`);
  }
  return parts.filter(Boolean).join(" · ");
}

/** Debe o Haber de una cuenta según el signo: lo que entra va al Debe. */
function side(account: string, e: TreasuryEntry, fund: string): JournalLine {
  const amt = round(Math.abs(e.amount));
  return {
    account,
    currency: e.currency,
    debit: e.amount > 0 ? amt : 0,
    credit: e.amount < 0 ? amt : 0,
    fund,
  };
}

/** La contrapartida: el mismo importe del otro lado. */
function mirror(account: string, e: TreasuryEntry, fund: string): JournalLine {
  const l = side(account, e, fund);
  return { ...l, debit: l.credit, credit: l.debit };
}

const fmtRate = (n: number) =>
  n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 3 });

function transferConcept(legs: TreasuryEntry[], names: LedgerNames): string {
  const first = legs[0];
  const parts = [first.description || names.subcategories.get(first.subcategory_id) || "Transferencia"];
  const uyu = legs.find((l) => l.currency === "UYU");
  const usd = legs.find((l) => l.currency === "USD");
  if (uyu && usd && usd.amount !== 0) {
    parts.push(`Cambio de los montos: $ ${fmtRate(Math.abs(uyu.amount) / Math.abs(usd.amount))}`);
    const bcu = legs.find((l) => l.bcu_rate)?.bcu_rate;
    const bcuDate = legs.find((l) => l.bcu_rate_date)?.bcu_rate_date;
    if (bcu) {
      parts.push(`BCU dólar billete${bcuDate ? ` ${fmtDate(bcuDate)}` : ""}: $ ${fmtRate(bcu)}`);
    }
  }
  return parts.join(" · ");
}

/**
 * Los asientos, en orden de fecha. `entries` es lo que el tesorero está
 * mirando; `all` es todo lo cargado, para completar una transferencia de la
 * que el filtro dejó a la vista una sola pata (filtrar por cuenta deja la
 * otra afuera, y media transferencia es un asiento que no cuadra).
 */
export function buildJournal(
  entries: TreasuryEntry[],
  all: TreasuryEntry[],
  names: LedgerNames
): JournalEntry[] {
  const groups = new Map<string, TreasuryEntry[]>();
  for (const e of all) {
    if (!e.transfer_group_id) continue;
    const g = groups.get(e.transfer_group_id) ?? [];
    g.push(e);
    groups.set(e.transfer_group_id, g);
  }

  const seenGroups = new Set<string>();
  const drafts: Array<Omit<JournalEntry, "number"> & { sortKey: string }> = [];

  for (const e of entries) {
    if (e.voided_at) continue;
    const fund = e.fund_id ? (names.funds.get(e.fund_id) ?? "") : "";
    const account = names.accounts.get(e.account_id) ?? "Cuenta";

    if (e.transfer_group_id) {
      if (seenGroups.has(e.transfer_group_id)) continue;
      seenGroups.add(e.transfer_group_id);
      const legs = (groups.get(e.transfer_group_id) ?? [e]).filter((l) => !l.voided_at);
      const lines = legs
        .slice()
        .sort((a, b) => b.amount - a.amount) // primero el Debe
        .map((l) =>
          side(names.accounts.get(l.account_id) ?? "Cuenta", l, l.fund_id ? (names.funds.get(l.fund_id) ?? "") : "")
        );
      // Lo que no cuadra dentro de cada moneda (siempre, entre monedas) va
      // contra "Cambio de moneda".
      for (const cur of ["UYU", "USD"] as const) {
        const net = round(
          lines.filter((l) => l.currency === cur).reduce((s, l) => s + l.debit - l.credit, 0)
        );
        if (net === 0) continue;
        lines.push({
          account: FX_ACCOUNT,
          currency: cur,
          debit: net < 0 ? -net : 0,
          credit: net > 0 ? net : 0,
          fund,
        });
      }
      drafts.push({
        date: e.entry_date,
        concept: transferConcept(legs, names),
        lines,
        sortKey: `${e.entry_date}|${e.id}`,
      });
      continue;
    }

    const counter = e.is_opening_balance ? OPENING_ACCOUNT : rubro(e, names);
    const lines =
      e.amount >= 0
        ? [side(account, e, fund), mirror(counter, e, fund)]
        : [mirror(counter, e, fund), side(account, e, fund)];
    drafts.push({
      date: e.entry_date,
      concept: e.is_opening_balance ? `Saldo de apertura · ${account}` : concept(e, names),
      lines,
      sortKey: `${e.entry_date}|${String(e.receipt_number ?? 0).padStart(8, "0")}|${e.id}`,
    });
  }

  drafts.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  return drafts.map(({ sortKey: _k, ...d }, i) => ({ ...d, number: i + 1 }));
}

const HEADERS = ["Asiento", "Fecha", "Cuenta", "Debe", "Haber", "Moneda", "Fondo", "Concepto"];

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const csvAmount = (n: number) => (n ? n.toFixed(2).replace(".", ",") : "");

function csvCell(value: string): string {
  const v = value ?? "";
  return /[";\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/**
 * El Libro Diario como CSV para Excel es-UY (mismo formato que el CSV del
 * Libro: `;`, coma decimal, BOM). El concepto va en la primera línea de
 * cada asiento y una línea en blanco los separa. Al pie, los totales de
 * Debe y Haber por moneda: tienen que ser iguales, y si no lo son el
 * archivo lo dice.
 */
export function journalCSV(journal: JournalEntry[], title: string): string {
  const rows: string[][] = [[`Libro Diario · ${title}`], [], HEADERS];
  const totals = new Map<string, { debit: number; credit: number }>();
  for (const a of journal) {
    a.lines.forEach((l, i) => {
      rows.push([
        i === 0 ? String(a.number) : "",
        i === 0 ? fmtDate(a.date) : "",
        l.account,
        csvAmount(l.debit),
        csvAmount(l.credit),
        l.currency,
        l.fund,
        i === 0 ? a.concept : "",
      ]);
      const t = totals.get(l.currency) ?? { debit: 0, credit: 0 };
      t.debit = round(t.debit + l.debit);
      t.credit = round(t.credit + l.credit);
      totals.set(l.currency, t);
    });
    rows.push([]);
  }
  for (const [cur, t] of [...totals].sort()) {
    rows.push([
      "",
      "",
      `Totales ${cur}`,
      csvAmount(t.debit),
      csvAmount(t.credit),
      cur,
      "",
      t.debit === t.credit ? "Debe = Haber" : "NO CUADRA: revisar",
    ]);
  }
  return "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
}
