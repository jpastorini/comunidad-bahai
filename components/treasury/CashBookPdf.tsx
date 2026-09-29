import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  monthLabel,
  summaryTotals,
  type Cashbook,
  type CashbookSheet,
} from "@/lib/treasury-cashbook";
import { fmtAmount, fmtLongDate } from "@/lib/treasury-report-content";
import type { CashBookClosing, CashBookLegal } from "./CashBookSheet";

/**
 * El Libro Mayor de Caja como PDF, generado en el servidor con react-pdf.
 *
 * Es la MISMA hoja que CashBookSheet (la que se imprime desde el
 * navegador): resumen del mes y una hoja por cuenta y moneda, formato
 * MEC (Día · Concepto · Ingresos · Egresos · Saldo). Existe porque el
 * legajo para el auditor se arma sin navegador: hay que producir el PDF
 * de cada mes desde una ruta. Lee el mismo `Cashbook` que la hoja, así
 * que no pueden decir cosas distintas.
 *
 * Helvetica (fuente estándar de PDF, sin registrar nada): el Libro de
 * Caja no lleva nombres bahá'ís con diacríticos raros, y evita cargar
 * fuentes en cada mes del legajo.
 */

const INK = "#1b2033";
const MIST = "#6b7080";
const GOLD = "#96790E";
const LINE = "#d9d4c7";
const RED = "#b42318";

const s = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: INK,
  },
  eyebrow: {
    fontSize: 7,
    letterSpacing: 1.5,
    color: GOLD,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 3 },
  legal: { fontSize: 8, color: MIST, marginTop: 2 },
  metaRow: { flexDirection: "row", gap: 24, marginTop: 8 },
  metaLabel: { fontSize: 6.5, color: MIST, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  metaValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  headerRule: { borderBottomWidth: 1.5, borderBottomColor: GOLD, paddingBottom: 8, marginBottom: 10 },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 6, marginBottom: 6 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 3 },
  trHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#999", paddingVertical: 3 },
  trTotal: { flexDirection: "row", borderTopWidth: 1.5, borderTopColor: "#777", paddingVertical: 4 },
  th: { fontSize: 6.5, color: MIST, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  td: { fontSize: 8.5 },
  bold: { fontFamily: "Helvetica-Bold" },
  right: { textAlign: "right" },
  muted: { color: MIST },
  neg: { color: RED },
  note: { fontSize: 7.5, color: MIST, marginTop: 6, lineHeight: 1.4 },
  footer: {
    position: "absolute",
    left: 40,
    right: 40,
    bottom: 20,
    borderTopWidth: 0.5,
    borderTopColor: "#999",
    paddingTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
  },
  footerText: { fontSize: 7, color: MIST, flex: 1, lineHeight: 1.35 },
  sign: { width: 110, borderTopWidth: 0.5, borderTopColor: "#555", paddingTop: 2, fontSize: 7, textAlign: "center", color: MIST },
  draft: {
    position: "absolute",
    top: 330,
    left: 90,
    transform: "rotate(-22deg)",
    fontSize: 56,
    fontFamily: "Helvetica-Bold",
    color: "#b4231833",
    letterSpacing: 6,
  },
});

// Anchos de columna (puntos), sumando ~515 (A4 menos márgenes).
const SUM_W = [150, 45, 80, 70, 70, 80, 20];
const ACC_W = [30, 245, 80, 80, 80];

function num(value: number, currency: string, opts: { bold?: boolean; blankZero?: boolean } = {}) {
  if (opts.blankZero && Math.abs(value) < 0.005) return "";
  return value < 0 ? `- ${fmtAmount(Math.abs(value), currency)}` : fmtAmount(value, currency);
}

export function CashBookPdf({
  book,
  localityName,
  legal,
  closing,
  bahaiYear,
}: {
  book: Cashbook;
  localityName: string;
  legal: CashBookLegal;
  closing: CashBookClosing | null;
  bahaiYear: number | null;
}) {
  const draft = closing === null;
  const totals = summaryTotals(book.summary);
  const title = legal.registeredName || `Asamblea Espiritual Local de los Bahá'ís de ${localityName}`;
  const legalLine = [legal.rut ? `RUT ${legal.rut}` : null, legal.address].filter(Boolean).join(" · ");

  const header = (sheet: string) => (
    <View style={s.headerRule}>
      <Text style={s.eyebrow}>Libro Mayor de Caja</Text>
      <Text style={s.title}>{title}</Text>
      {legalLine ? <Text style={s.legal}>{legalLine}</Text> : null}
      <View style={s.metaRow}>
        <View>
          <Text style={s.metaLabel}>Mes</Text>
          <Text style={s.metaValue}>{monthLabel(book.month)}</Text>
        </View>
        <View>
          <Text style={s.metaLabel}>Hoja</Text>
          <Text style={s.metaValue}>{sheet}</Text>
        </View>
        {bahaiYear ? (
          <View>
            <Text style={s.metaLabel}>Ejercicio</Text>
            <Text style={s.metaValue}>{bahaiYear} E.B.</Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  const footer = (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>
        {closing
          ? `Mes cerrado en la app el ${fmtLongDate(closing.closedAt.slice(0, 10))}${
              closing.closedBy ? ` por ${closing.closedBy}` : ""
            }. Después del cierre ningún movimiento del mes se puede alterar; las correcciones son contra-asientos en el mes siguiente.`
          : "BORRADOR: el mes todavía está abierto. Esta hoja es para revisar y no debe pegarse en el libro."}
        {"\n"}Resumen más {book.sheets.length} {book.sheets.length === 1 ? "hoja" : "hojas"} de cuenta.
      </Text>
      <Text style={s.sign}>Tesorero/a</Text>
      <Text style={s.sign}>Secretario/a</Text>
    </View>
  );

  const draftMark = draft ? <Text style={s.draft}>BORRADOR</Text> : null;

  return (
    <Document
      title={`Libro de Caja · ${monthLabel(book.month)} · ${localityName}`}
      author={title}
      subject="Libro Mayor de Caja (formato MEC)"
    >
      {/* Resumen del mes */}
      <Page size="A4" style={s.page}>
        {header("Resumen del mes")}
        <Text style={s.h2}>Saldos por cuenta al cierre de {monthLabel(book.month).toLowerCase()}</Text>
        <View style={s.trHead}>
          {["Cuenta", "Moneda", "Saldo anterior", "Ingresos", "Egresos", "Saldo al cierre", "Mov."].map(
            (h, i) => (
              <Text key={h} style={[s.th, { width: SUM_W[i] }, i >= 2 ? s.right : {}]}>
                {h}
              </Text>
            )
          )}
        </View>
        {book.summary.map((r) => (
          <View key={`${r.accountId}|${r.currency}`} style={s.tr}>
            <Text style={[s.td, { width: SUM_W[0] }]}>{r.account}</Text>
            <Text style={[s.td, s.muted, { width: SUM_W[1] }]}>{r.currency}</Text>
            <Text style={[s.td, s.right, { width: SUM_W[2] }, r.opening < 0 ? s.neg : {}]}>{num(r.opening, r.currency)}</Text>
            <Text style={[s.td, s.right, { width: SUM_W[3] }]}>{num(r.income, r.currency)}</Text>
            <Text style={[s.td, s.right, { width: SUM_W[4] }]}>{num(r.expense, r.currency)}</Text>
            <Text style={[s.td, s.right, s.bold, { width: SUM_W[5] }, r.closing < 0 ? s.neg : {}]}>{num(r.closing, r.currency)}</Text>
            <Text style={[s.td, s.right, s.muted, { width: SUM_W[6] }]}>{r.count}</Text>
          </View>
        ))}
        {totals.map((t) => (
          <View key={`t-${t.currency}`} style={s.trTotal}>
            <Text style={[s.td, s.bold, { width: SUM_W[0] + SUM_W[1] }]}>Total {t.currency}</Text>
            <Text style={[s.td, s.right, s.bold, { width: SUM_W[2] }]}>{num(t.opening, t.currency)}</Text>
            <Text style={[s.td, s.right, s.bold, { width: SUM_W[3] }]}>{num(t.income, t.currency)}</Text>
            <Text style={[s.td, s.right, s.bold, { width: SUM_W[4] }]}>{num(t.expense, t.currency)}</Text>
            <Text style={[s.td, s.right, s.bold, { width: SUM_W[5] }]}>{num(t.closing, t.currency)}</Text>
            <Text style={[s.td, s.right, s.bold, { width: SUM_W[6] }]}>{t.count}</Text>
          </View>
        ))}
        <Text style={s.note}>
          Cada moneda se totaliza por separado; los saldos son acumulados desde el inicio del libro.
          Las transferencias entre cuentas figuran en cada cuenta como ingreso o egreso y se cancelan
          entre sí.
          {book.voidedCount > 0
            ? ` Hay ${book.voidedCount} ${book.voidedCount === 1 ? "movimiento anulado" : "movimientos anulados"} en el mes, que no se suman.`
            : ""}
        </Text>
        {book.sheets.length === 0 ? (
          <Text style={[s.note, { marginTop: 14 }]}>
            No hay movimientos ni saldos en {monthLabel(book.month).toLowerCase()}.
          </Text>
        ) : null}
        {draftMark}
        {footer}
      </Page>

      {/* Una hoja por cuenta y moneda */}
      {book.sheets.map((sheet, i) => (
        <Page key={`${sheet.accountId}|${sheet.currency}`} size="A4" style={s.page} wrap>
          {header(`Hoja ${i + 1} de ${book.sheets.length} · ${sheet.account} · ${sheet.currency}`)}
          <AccountTable sheet={sheet} />
          {draftMark}
          {footer}
        </Page>
      ))}
    </Document>
  );
}

function AccountTable({ sheet }: { sheet: CashbookSheet }) {
  const c = sheet.currency;
  return (
    <View>
      <Text style={s.h2}>
        {sheet.account} <Text style={s.muted}>· {c}</Text>
      </Text>
      <View style={s.trHead} fixed>
        {["Día", "Concepto", "Ingresos", "Egresos", "Saldo"].map((h, i) => (
          <Text key={h} style={[s.th, { width: ACC_W[i] }, i >= 2 ? s.right : {}]}>
            {h}
          </Text>
        ))}
      </View>
      <View style={[s.tr, { backgroundColor: "#f4f2ec" }]}>
        <Text style={[s.td, s.muted, { width: ACC_W[0] }]}>—</Text>
        <Text style={[s.td, s.bold, { width: ACC_W[1] }]}>Saldo anterior</Text>
        <Text style={{ width: ACC_W[2] }} />
        <Text style={{ width: ACC_W[3] }} />
        <Text style={[s.td, s.right, s.bold, { width: ACC_W[4] }, sheet.opening < 0 ? s.neg : {}]}>
          {num(sheet.opening, c)}
        </Text>
      </View>
      {sheet.rows.map((r) => (
        <View key={r.id} style={s.tr} wrap={false}>
          <Text style={[s.td, s.muted, { width: ACC_W[0] }]}>{r.day}</Text>
          <Text style={[s.td, { width: ACC_W[1], paddingRight: 6 }]}>
            {r.concept}
            {r.internal ? "  [interna]" : ""}
            {r.adjustment ? "  [contra-asiento]" : ""}
          </Text>
          <Text style={[s.td, s.right, { width: ACC_W[2] }]}>{num(r.income, c, { blankZero: true })}</Text>
          <Text style={[s.td, s.right, { width: ACC_W[3] }]}>{num(r.expense, c, { blankZero: true })}</Text>
          <Text style={[s.td, s.right, { width: ACC_W[4] }, r.balance < 0 ? s.neg : {}]}>{num(r.balance, c)}</Text>
        </View>
      ))}
      <View style={s.trTotal}>
        <Text style={{ width: ACC_W[0] }} />
        <Text style={[s.td, s.bold, { width: ACC_W[1] }]}>Totales del mes y saldo al cierre</Text>
        <Text style={[s.td, s.right, s.bold, { width: ACC_W[2] }]}>{num(sheet.income, c)}</Text>
        <Text style={[s.td, s.right, s.bold, { width: ACC_W[3] }]}>{num(sheet.expense, c)}</Text>
        <Text style={[s.td, s.right, s.bold, { width: ACC_W[4] }, sheet.closing < 0 ? s.neg : {}]}>
          {num(sheet.closing, c)}
        </Text>
      </View>
      {sheet.rows.length === 0 ? <Text style={s.note}>Sin movimientos en el mes.</Text> : null}
    </View>
  );
}
