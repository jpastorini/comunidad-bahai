import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAssemblyData } from "./assembly";
import { formatDate, formatDateTime } from "./format";
import { ASSEMBLY_OFFICE_LABELS, type AssemblyOffice } from "./types";
import { findingsOf, getDispositions } from "./treasury-audit-server";
import type { Finding } from "./treasury-audit";
import {
  RECEIPTS_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  type TreasuryAttachment,
} from "./treasury-attachments";
import {
  buildCashbook,
  monthKeyOf,
  monthKeysBetween,
  monthLabel,
  monthRange,
} from "./treasury-cashbook";
import {
  getCashbookEntries,
  getCashbookNames,
  getCloserNames,
  getClosings,
  closingMonthKey,
} from "./treasury-closings";
import {
  getLedgerCatalog,
  getLedgerEntriesByRange,
  getReceiptLegal,
  type TreasuryEntry,
} from "./treasury-ledger";
import { ledgerCSV } from "./treasury-ledger-filters";
import { AUDIENCE_LABEL } from "./treasury-report-content";
import { getAdminReports } from "./treasury-reports";
import {
  STATEMENTS_BUCKET,
  getImports,
  getMatches,
  getReconciledEntryIds,
  getStoredLines,
  monthReconciliation,
} from "./treasury-statements";
import { treasuryYearForDate } from "./treasury-year";

/**
 * El legajo para el auditor: todo lo que una auditoría de la Tesorería
 * pide, de un período, listo para bajar como UNA carpeta comprimida.
 *
 * El servidor NO arma el ZIP. Arma un MANIFIESTO: los archivos de texto
 * ya generados (CSV, LEEME) y, para todo lo que es un archivo (los PDF
 * del Libro de Caja, los comprobantes, los extractos, los estatutos), una
 * URL —firmada, de una hora, para lo que vive en un bucket privado; de la
 * propia app para los PDF—. El navegador baja cada uno y comprime con
 * jszip. La razón es Vercel: una función no puede devolver más de 4,5 MB
 * y los comprobantes de un ejercicio pasan eso de sobra.
 *
 * Qué va y qué no, decidido con el criterio de la 043 al revés: acá SÍ
 * van los nombres de contribuyentes y los comprobantes con RUT de
 * proveedores, porque el destinatario es el auditor y quien lo genera es
 * el tesorero. El ZIP es tan reservado como el libro; la pantalla lo dice.
 */

export type DossierFile =
  | { path: string; kind: "text"; content: string }
  | { path: string; kind: "url"; url: string };

export type DossierManifest = {
  /** Carpeta raíz dentro del ZIP y nombre del archivo. */
  folder: string;
  from: string;
  to: string;
  generatedAt: string;
  files: DossierFile[];
  /** Lo que no se pudo incluir o conviene saber, para el LEEME y la pantalla. */
  warnings: string[];
  /** Conteos para la pantalla. */
  counts: { entries: number; months: number; attachments: number; statements: number };
};

// ─── CSV ─────────────────────────────────────────────────────────

function cell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV para Excel es-UY: BOM, `;`, coma decimal (misma regla que el Libro). */
function csv(rows: Array<Array<string | number | null | undefined>>): string {
  return "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
}

function money(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function safe<T>(label: string, warnings: string[], p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[dossier] ${label}:`, msg);
    warnings.push(`No se pudo incluir ${label}: ${msg}`);
    return fallback;
  }
}

/** Todas las filas de una tabla, de a 1000 (el tope de PostgREST). */
async function allRows<T>(
  make: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < 50; page++) {
    const { data, error } = await make(page * 1000, page * 1000 + 999);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

// ─── El legajo ───────────────────────────────────────────────────

export async function buildDossierManifest(
  supabase: SupabaseClient,
  opts: {
    localityId: string;
    localityName: string;
    localityKind: string;
    from: string;
    to: string;
    generatedBy: string;
    now?: Date;
  }
): Promise<DossierManifest> {
  const { from, to } = opts;
  const now = opts.now ?? new Date();
  const warnings: string[] = [];
  const files: DossierFile[] = [];
  const months = monthKeysBetween(monthKeyOf(from), monthKeyOf(to));
  const yearFrom = treasuryYearForDate(from);
  const yearTo = treasuryYearForDate(to);
  const yearLabel =
    yearFrom && yearTo ? (yearFrom === yearTo ? `${yearFrom}EB` : `${yearFrom}-${yearTo}EB`) : `${from}_${to}`;
  const folder = `Legajo-Tesoreria-${slug(opts.localityName)}-${yearLabel}`;

  const [catalog, entries, reconciled, legal, closings] = await Promise.all([
    getLedgerCatalog(supabase, opts.localityId, { nationwide: opts.localityKind === "nacional" }),
    getLedgerEntriesByRange(supabase, from, to),
    safe("la marca de conciliación", warnings, getReconciledEntryIds(supabase), new Set<string>()),
    getReceiptLegal(supabase, opts.localityId),
    safe("los cierres", warnings, getClosings(supabase), []),
  ]);

  const names = {
    accounts: new Map(catalog.accounts.map((a) => [a.id, a.name])),
    funds: new Map(catalog.funds.map((f) => [f.id, f.name])),
    categories: new Map(catalog.categories.map((c) => [c.id, c.name])),
    subcategories: new Map(catalog.subcategories.map((s) => [s.id, s.name])),
    contributors: new Map(catalog.contributors.map((c) => [c.id, c.name])),
  };
  const sortedEntries = [...entries].sort(
    (a, b) => a.entry_date.localeCompare(b.entry_date) || (a.receipt_number ?? 0) - (b.receipt_number ?? 0)
  );

  // ── 01 · El libro ──────────────────────────────────────────────
  files.push({
    path: `${folder}/01-libro/movimientos.csv`,
    kind: "text",
    content: ledgerCSV(sortedEntries, names, reconciled, { showNames: true }),
  });
  files.push({
    path: `${folder}/01-libro/catalogo.csv`,
    kind: "text",
    content: csv([
      ["Tipo", "Nombre", "Categoría (subcategorías)", "Fondo sugerido", "Activo"],
      ...catalog.accounts.map((a) => ["Cuenta", a.name, "", "", a.is_active ? "sí" : "no"]),
      ...catalog.funds.map((f) => ["Fondo", f.name, "", "", f.is_active ? "sí" : "no"]),
      ...catalog.categories.map((c) => ["Categoría", c.name, "", "", c.is_active ? "sí" : "no"]),
      ...catalog.subcategories.map((s) => [
        "Subcategoría",
        s.name,
        names.categories.get(s.category_id) ?? "",
        s.default_fund_id ? names.funds.get(s.default_fund_id) ?? "" : "",
        s.is_active ? "sí" : "no",
      ]),
    ]),
  });

  // Saldos al cierre del período: el Libro de Caja del último mes.
  const lastMonth = monthKeyOf(to);
  const cashNames = await getCashbookNames(supabase);
  const lastBook = buildCashbook(await getCashbookEntries(supabase, lastMonth), lastMonth, cashNames);
  files.push({
    path: `${folder}/01-libro/saldos-al-${to}.csv`,
    kind: "text",
    content: csv([
      ["Cuenta", "Moneda", "Saldo anterior al mes", "Ingresos del mes", "Egresos del mes", `Saldo al ${formatDate(to)}`],
      ...lastBook.summary.map((r) => [r.account, r.currency, money(r.opening), money(r.income), money(r.expense), money(r.closing)]),
    ]),
  });

  // ── 02 · Libro de Caja por mes (PDF de la app) y cierres ───────
  for (const m of months) {
    files.push({ path: `${folder}/02-libro-de-caja/${m}.pdf`, kind: "url", url: `/admin/libro-caja/${m}/pdf` });
  }
  const closerNames = await safe("quién cerró", warnings, getCloserNames(supabase, closings), new Map<string, string>());
  const closingsInRange = closings.filter((c) => months.includes(closingMonthKey(c)));
  const closingRows: Array<Array<string | number>> = [];
  for (const m of months) {
    const c = closingsInRange.filter((x) => closingMonthKey(x) === m);
    if (c.length === 0) {
      closingRows.push([monthLabel(m), "ABIERTO", "", "", "", "", "", ""]);
      continue;
    }
    // Un mes reabierto y vuelto a cerrar tiene dos filas: las dos son historia.
    for (const x of c) {
      closingRows.push([
        monthLabel(m),
        x.status === "closed" ? "cerrado" : "reabierto",
        formatDateTime(x.closed_at),
        x.closed_by ? closerNames.get(x.closed_by) ?? "" : "",
        x.entries_count,
        x.reopened_at ? formatDateTime(x.reopened_at) : "",
        x.reopened_by ? closerNames.get(x.reopened_by) ?? "" : "",
        x.reopen_reason ?? "",
      ]);
    }
  }
  files.push({
    path: `${folder}/02-libro-de-caja/cierres.csv`,
    kind: "text",
    content: csv([
      ["Mes", "Estado", "Cerrado el", "Cerrado por", "Movimientos", "Reabierto el", "Reabierto por", "Motivo de reapertura"],
      ...closingRows,
    ]),
  });
  const openMonths = months.filter((m) => !closings.some((c) => c.status === "closed" && closingMonthKey(c) === m));
  if (openMonths.length > 0) {
    warnings.push(
      `${openMonths.length === 1 ? "Hay un mes sin cerrar" : `Hay ${openMonths.length} meses sin cerrar`} en el período (${openMonths
        .map(monthLabel)
        .join(", ")}): su Libro de Caja sale como BORRADOR.`
    );
  }

  // ── 03 · Recibos ───────────────────────────────────────────────
  const receipts = sortedEntries
    .filter((e) => e.receipt_number !== null)
    .sort((a, b) => (a.receipt_number ?? 0) - (b.receipt_number ?? 0));
  const receiptRows = receipts.map((e) => [
    e.receipt_number,
    e.entry_date,
    contributorLabel(e, names.contributors),
    e.contributions_count > 1 ? e.contributions_count : "",
    e.currency,
    money(Math.abs(e.amount)),
    e.fund_id ? names.funds.get(e.fund_id) ?? "" : "",
    names.accounts.get(e.account_id) ?? "",
    e.receipt_issued ? "sí" : "no",
    e.voided_at ? `ANULADO ${formatDate(e.voided_at)}` : "",
    e.void_reason ?? "",
  ]);
  const gaps: number[] = [];
  for (let i = 1; i < receipts.length; i++) {
    const prev = receipts[i - 1].receipt_number ?? 0;
    const cur = receipts[i].receipt_number ?? 0;
    for (let n = prev + 1; n < cur && gaps.length < 200; n++) gaps.push(n);
  }
  files.push({
    path: `${folder}/03-recibos/recibos.csv`,
    kind: "text",
    content: csv([
      ["N.º", "Fecha", "Contribuyente", "Aportes agrupados", "Moneda", "Monto", "Fondo", "Cuenta", "Emitido", "Anulado", "Motivo de anulación"],
      ...receiptRows,
    ]),
  });
  if (gaps.length > 0) {
    warnings.push(
      `La serie de recibos del período tiene ${gaps.length === 1 ? "un hueco" : `${gaps.length} huecos`}: ${gaps.slice(0, 30).join(", ")}${gaps.length > 30 ? "…" : ""}. Un número puede estar en otro ejercicio o corresponder a un recibo anulado que no se cargó.`
    );
  }

  // ── 04 · Comprobantes ──────────────────────────────────────────
  const entryIds = new Set(entries.map((e) => e.id));
  const byEntry = new Map(entries.map((e) => [e.id, e]));
  const attachments = (
    await safe(
      "los comprobantes",
      warnings,
      allRows<TreasuryAttachment>((a, b) =>
        supabase
          .from("treasury_attachments")
          .select("id, entry_id, storage_path, file_name, mime_type, size_bytes, amount, label, sort_order, created_at")
          .order("created_at", { ascending: true })
          .range(a, b)
      ),
      []
    )
  ).filter((a) => entryIds.has(a.entry_id));
  const signedAtt = await safe(
    "las URL de los comprobantes",
    warnings,
    (async () => {
      if (attachments.length === 0) return new Map<string, string>();
      const out = new Map<string, string>();
      for (let i = 0; i < attachments.length; i += 100) {
        const chunk = attachments.slice(i, i + 100);
        const { data, error } = await supabase.storage
          .from(RECEIPTS_BUCKET)
          .createSignedUrls(chunk.map((a) => a.storage_path), SIGNED_URL_TTL_SECONDS);
        if (error) throw new Error(error.message);
        for (const row of data ?? []) if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
      }
      return out;
    })(),
    new Map<string, string>()
  );
  const attRows: Array<Array<string | number | null>> = [];
  let attCount = 0;
  for (const a of attachments) {
    const e = byEntry.get(a.entry_id)!;
    const url = signedAtt.get(a.storage_path);
    const dir = `${folder}/04-comprobantes/${monthKeyOf(e.entry_date)}/${e.entry_date}_${slug(
      names.subcategories.get(e.subcategory_id) ?? "movimiento"
    )}_${money(Math.abs(e.amount)).replace(",", ".")}${e.currency}`;
    const path = `${dir}/${slug(a.file_name) || a.id}`;
    if (url) {
      files.push({ path, kind: "url", url });
      attCount++;
    } else {
      warnings.push(`El comprobante ${a.file_name} (${e.entry_date}) no se pudo firmar y no va en el ZIP.`);
    }
    attRows.push([
      e.entry_date,
      names.accounts.get(e.account_id) ?? "",
      names.subcategories.get(e.subcategory_id) ?? "",
      e.description ?? "",
      e.currency,
      money(Math.abs(e.amount)),
      a.file_name,
      a.label ?? "",
      a.amount === null ? "" : money(a.amount),
      url ? path.slice(folder.length + 1) : "(no incluido)",
    ]);
  }
  // Gastos del período sin ningún comprobante: lo primero que mira un auditor.
  const withAtt = new Set(attachments.map((a) => a.entry_id));
  const expensesNoDoc = sortedEntries.filter(
    (e) => e.amount < 0 && !e.transfer_group_id && !e.is_opening_balance && !e.voided_at && !withAtt.has(e.id)
  );
  files.push({
    path: `${folder}/04-comprobantes/indice.csv`,
    kind: "text",
    content: csv([
      ["Fecha", "Cuenta", "Rubro", "Descripción", "Moneda", "Monto del movimiento", "Archivo", "Etiqueta", "Monto del comprobante", "Ruta en el legajo"],
      ...attRows,
    ]),
  });
  files.push({
    path: `${folder}/04-comprobantes/gastos-sin-comprobante.csv`,
    kind: "text",
    content: csv([
      ["Fecha", "Cuenta", "Rubro", "Descripción", "Moneda", "Monto"],
      ...expensesNoDoc.map((e) => [
        e.entry_date,
        names.accounts.get(e.account_id) ?? "",
        names.subcategories.get(e.subcategory_id) ?? "",
        e.description ?? "",
        e.currency,
        money(-e.amount),
      ]),
    ]),
  });
  if (expensesNoDoc.length > 0) {
    warnings.push(
      `${expensesNoDoc.length === 1 ? "Un gasto" : `${expensesNoDoc.length} gastos`} del período no ${
        expensesNoDoc.length === 1 ? "tiene" : "tienen"
      } comprobante adjunto (ver 04-comprobantes/gastos-sin-comprobante.csv).`
    );
  }

  // ── 05 · Extractos y conciliación ──────────────────────────────
  let statementsCount = 0;
  const imports = await safe("los extractos", warnings, getImports(supabase), { rows: [], missing: true });
  if (!imports.missing) {
    const inRange = imports.rows.filter((i) => i.period_from <= to && i.period_to >= from);
    const paths = inRange.map((i) => i.storage_path).filter((p): p is string => !!p);
    const signed = new Map<string, string>();
    if (paths.length > 0) {
      const { data, error } = await supabase.storage.from(STATEMENTS_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
      if (error) warnings.push(`No se pudieron firmar los extractos: ${error.message}`);
      for (const row of data ?? []) if (row.path && row.signedUrl) signed.set(row.path, row.signedUrl);
    }
    for (const i of inRange) {
      const url = i.storage_path ? signed.get(i.storage_path) : undefined;
      const account = slug(names.accounts.get(i.account_id) ?? "cuenta");
      if (url) {
        files.push({
          path: `${folder}/05-extractos/${account}/${i.period_from}_${i.period_to}_${slug(i.file_name) || i.id}`,
          kind: "url",
          url,
        });
        statementsCount++;
      }
    }
    files.push({
      path: `${folder}/05-extractos/importaciones.csv`,
      kind: "text",
      content: csv([
        ["Cuenta", "Plataforma", "Archivo", "Desde", "Hasta", "Moneda", "Saldo declarado", "Al", "Líneas", "Nuevas", "Importado el"],
        ...inRange.map((i) => [
          names.accounts.get(i.account_id) ?? "",
          i.platform,
          i.file_name,
          i.period_from,
          i.period_to,
          i.currency,
          i.closing_balance === null ? "" : money(i.closing_balance),
          i.closing_balance_as_of ?? "",
          i.lines_count,
          i.new_lines_count,
          formatDateTime(i.created_at),
        ]),
      ]),
    });
    // Conciliado por cuenta y mes, la misma regla que Cierres.
    const [lines, matches] = await Promise.all([getStoredLines(supabase), getMatches(supabase)]);
    const accountsWithImports = new Set(imports.rows.map((i) => i.account_id));
    const monthEntries = entries.map((e) => ({
      id: e.id,
      account_id: e.account_id,
      entry_date: e.entry_date,
      voided_at: e.voided_at,
      is_opening_balance: e.is_opening_balance,
    }));
    const recRows: Array<Array<string | number>> = [];
    for (const m of months) {
      for (const st of monthReconciliation(m, lines, matches, monthEntries, names.accounts, accountsWithImports)) {
        recRows.push([monthLabel(m), st.accountName, st.status, st.pendingLines, st.pendingEntries]);
      }
    }
    files.push({
      path: `${folder}/05-extractos/conciliacion.csv`,
      kind: "text",
      content: csv([
        ["Mes", "Cuenta", "Estado", "Líneas del extracto sin movimiento", "Movimientos sin par en el extracto"],
        ...recRows,
      ]),
    });
    if (accountsWithImports.size === 0) warnings.push("Nunca se importó un extracto: no hay conciliación bancaria que mostrar.");
  } else {
    warnings.push("La conciliación con extractos no está habilitada en esta base (migración 061).");
  }

  // ── 06 · Auditoría ─────────────────────────────────────────────
  const auditRes = await supabase
    .from("treasury_audits")
    .select("id, run_at, period_from, period_to, findings, findings_count, high_count, medium_count, low_count")
    .order("run_at", { ascending: false })
    .limit(10);
  if (auditRes.error) {
    warnings.push("La auditoría no está habilitada en esta base (migración 059).");
  } else {
    type A = { id: string; run_at: string; period_from: string; period_to: string; findings: unknown; findings_count: number; high_count: number; medium_count: number; low_count: number };
    const audits = (auditRes.data ?? []) as A[];
    const dispositions = await safe("los despachos", warnings, getDispositions(supabase), []);
    const dispByKey = new Map(dispositions.map((d) => [d.finding_key, d]));
    const last = audits[0];
    const findings: Finding[] = last ? findingsOf(last.findings) : [];
    files.push({
      path: `${folder}/06-auditoria/hallazgos.csv`,
      kind: "text",
      content: csv([
        ["Corrida", "Código", "Gravedad", "Norma", "Hallazgo", "Detalle", "Decisión de la Asamblea", "Motivo", "Decidido el"],
        ...findings.map((f) => {
          const d = dispByKey.get(f.key);
          return [
            last ? formatDateTime(last.run_at) : "",
            f.code,
            f.severity,
            f.basis,
            f.title,
            f.detail,
            d ? d.status : "pendiente",
            d?.reason ?? "",
            d ? formatDateTime(d.decided_at) : "",
          ];
        }),
      ]),
    });
    files.push({
      path: `${folder}/06-auditoria/corridas.csv`,
      kind: "text",
      content: csv([
        ["Corrida el", "Desde", "Hasta", "Hallazgos", "Graves", "Medios", "Leves"],
        ...audits.map((a) => [formatDateTime(a.run_at), a.period_from, a.period_to, a.findings_count, a.high_count, a.medium_count, a.low_count]),
      ]),
    });
    if (!last) warnings.push("La auditoría nunca se corrió: 06-auditoria va vacío. Conviene correrla antes de entregar el legajo.");
    else if (last.run_at.slice(0, 10) < to && to <= now.toISOString().slice(0, 10)) {
      // Una corrida vieja no cubre lo cargado después.
      const pendingHigh = findings.filter((f) => f.severity === "alta" && (dispByKey.get(f.key)?.status ?? "pendiente") === "pendiente").length;
      if (pendingHigh > 0) warnings.push(`La última auditoría dejó ${pendingHigh} ${pendingHigh === 1 ? "hallazgo grave" : "hallazgos graves"} sin resolver.`);
    }
  }

  // ── 07 · Informes emitidos ─────────────────────────────────────
  const reports = await safe("los informes", warnings, getAdminReports(supabase, opts.localityId), []);
  const reportsInRange = reports.filter((r) => r.period_from <= to && r.period_to >= from);
  files.push({
    path: `${folder}/07-informes/informes.csv`,
    kind: "text",
    content: csv([
      ["Título", "Destinatario", "Desde", "Hasta", "Estado", "Emitido el", "Aprobado en reunión del", "Acta N.º"],
      ...reportsInRange.map((r) => [
        r.title,
        AUDIENCE_LABEL[r.audience],
        r.period_from,
        r.period_to,
        r.status === "published" ? "emitido" : "borrador",
        r.published_at ? formatDateTime(r.published_at) : "",
        // Texto libre del editor: se formatea solo si es ISO (ver la Guía).
        r.editorial.approval?.meetingDate
          ? /^d{4}-d{2}-d{2}/.test(r.editorial.approval.meetingDate)
            ? formatDate(r.editorial.approval.meetingDate.slice(0, 10))
            : r.editorial.approval.meetingDate
          : "",
        r.editorial.approval?.actaNumber ?? "",
      ]),
    ]),
  });

  // ── 08 · La Asamblea ───────────────────────────────────────────
  const years = Array.from(new Set([yearFrom, yearTo].filter((y): y is number => y !== null)));
  const compRows: Array<Array<string | number>> = [];
  let statutesUrl: string | null = null;
  for (const y of years) {
    const data = await safe(`la composición ${y}`, warnings, getAssemblyData(supabase, opts.localityId, y), null);
    if (!data) continue;
    statutesUrl = statutesUrl ?? data.statutesUrl;
    for (const m of data.term?.members ?? []) {
      compRows.push([
        y,
        data.term?.elected_on ?? "",
        m.position,
        m.display_name,
        m.office ? ASSEMBLY_OFFICE_LABELS[m.office as AssemblyOffice] : "Miembro",
        m.since ?? "",
        m.until ?? "",
      ]);
    }
  }
  files.push({
    path: `${folder}/08-asamblea/composicion.csv`,
    kind: "text",
    content: csv([["Ejercicio", "Elegida el", "Posición", "Nombre", "Cargo", "Desde", "Hasta"], ...compRows]),
  });
  if (statutesUrl) files.push({ path: `${folder}/08-asamblea/estatutos.pdf`, kind: "url", url: statutesUrl });
  const registeredName = legal.registeredName || `Asamblea Espiritual Local de los Bahá'ís de ${opts.localityName}`;
  files.push({
    path: `${folder}/08-asamblea/ficha-legal.txt`,
    kind: "text",
    content: [
      registeredName,
      legal.rut ? `RUT: ${legal.rut}` : "RUT: (no cargado)",
      legal.address ? `Domicilio fiscal: ${legal.address}` : "Domicilio fiscal: (no cargado)",
      "",
      "Los datos salen de Asamblea → Datos de la Asamblea.",
    ].join("\r\n"),
  });

  // ── 00 · LEEME ─────────────────────────────────────────────────
  const totalsByCurrency = new Map<string, { income: number; expense: number }>();
  for (const e of entries) {
    if (e.voided_at || e.is_opening_balance || e.transfer_group_id) continue;
    const t = totalsByCurrency.get(e.currency) ?? { income: 0, expense: 0 };
    if (e.amount > 0) t.income += e.amount;
    else t.expense += -e.amount;
    totalsByCurrency.set(e.currency, t);
  }
  const leeme = [
    `LEGAJO DE TESORERÍA · ${registeredName}`,
    `Período: ${formatDate(from)} a ${formatDate(to)}${yearFrom ? ` · ejercicio ${yearLabel.replace("EB", " E.B.")}` : ""}`,
    `Generado el ${formatDateTime(now.toISOString())} por ${opts.generatedBy} desde la app de la comunidad.`,
    legal.rut ? `RUT ${legal.rut}${legal.address ? ` · ${legal.address}` : ""}` : "",
    "",
    "CONFIDENCIAL. Este legajo lleva los nombres de los contribuyentes y los comprobantes con datos de",
    "proveedores. Es para el auditor designado; no se comparte ni se publica.",
    "",
    "RESUMEN DEL PERÍODO (sin transferencias internas, sin saldos de apertura, sin anulados)",
    ...[...totalsByCurrency.entries()].map(
      ([c, t]) => `  ${c}: ingresos ${money(t.income)} · egresos ${money(t.expense)} · neto ${money(t.income - t.expense)}`
    ),
    `  Movimientos en el período: ${entries.length} (${entries.filter((e) => e.voided_at).length} anulados)`,
    "",
    `SALDOS AL ${formatDate(to)} (todo el libro hasta esa fecha, por cuenta y moneda)`,
    ...lastBook.summary.map((r) => `  ${r.account} · ${r.currency}: ${money(r.closing)}`),
    "",
    "CONTENIDO",
    "  01-libro/            movimientos.csv (el libro completo del período, con nombres), catalogo.csv, saldos.",
    "  02-libro-de-caja/    Un PDF por mes con el Libro Mayor de Caja (formato MEC: Día · Concepto ·",
    "                       Ingresos · Egresos · Saldo; resumen del mes + una hoja por cuenta y moneda) y",
    "                       cierres.csv (quién cerró cada mes y cuándo). Un mes sin cerrar sale como BORRADOR.",
    "  03-recibos/          recibos.csv: la serie correlativa del período, con anulados y su motivo.",
    "  04-comprobantes/     Los archivos adjuntos a cada gasto, en carpetas por mes y movimiento; indice.csv",
    "                       los relaciona con el libro; gastos-sin-comprobante.csv lista lo que falta.",
    "  05-extractos/        Los extractos importados de cada plataforma (archivo original), importaciones.csv",
    "                       y conciliacion.csv (estado por cuenta y mes contra el libro).",
    "  06-auditoria/        hallazgos.csv: la última corrida de las reglas (MEC, DGI, estatutos, internas) y",
    "                       qué decidió la Asamblea sobre cada uno; corridas.csv: el historial.",
    "  07-informes/         informes.csv: los informes emitidos que cubren el período, con su aprobación.",
    "  08-asamblea/         ficha-legal.txt, composicion.csv (con cargos y vigencias) y estatutos.pdf.",
    "",
    "CÓMO LEERLO",
    "  · Los CSV abren en Excel (es-UY): separador «;», coma decimal.",
    "  · Un movimiento de un mes cerrado no se puede alterar: las correcciones son contra-asientos con",
    "    fecha del mes abierto, marcados como tales en el Libro de Caja y en movimientos.csv (columna Estado).",
    "  · Un recibo anulado conserva su número (numeración correlativa) y no suma.",
    "  · Cada moneda se totaliza por separado; el libro no convierte dólares a pesos.",
    "",
    warnings.length > 0 ? "AVISOS" : "AVISOS: ninguno.",
    ...warnings.map((w) => `  · ${w}`),
    "",
  ].join("\r\n");
  files.unshift({ path: `${folder}/00-LEEME.txt`, kind: "text", content: "﻿" + leeme });

  return {
    folder,
    from,
    to,
    generatedAt: now.toISOString(),
    files,
    warnings,
    counts: { entries: entries.length, months: months.length, attachments: attCount, statements: statementsCount },
  };
}

function contributorLabel(e: TreasuryEntry, contributors: Map<string, string>): string {
  if (!e.contributor_id) return e.contributions_count > 1 ? `${e.contributions_count} aportes (colecta)` : "";
  const name = contributors.get(e.contributor_id) ?? "";
  return e.receipt_name ? `${name} (en el recibo: ${e.receipt_name})` : name;
}

