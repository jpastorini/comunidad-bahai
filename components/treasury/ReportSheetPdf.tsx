import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  fmtAmount,
  fmtLongDate,
  primaryCurrency,
  type NoteKey,
  type ReportBalanceRow,
  type ReportBudgetLine,
  type ReportEditorial,
  type ReportInternalLine,
  type ReportMoney,
  type ReportRubro,
  type ReportSnapshot,
} from "@/lib/treasury-report-content";
import type { ReportSheetData } from "./ReportSheet";

/**
 * La hoja interna de Tesorería en PDF, para mandarla por WhatsApp a la
 * Asamblea. Es la MISMA hoja que ReportSheet (la que se imprime desde el
 * navegador), sección por sección y con el mismo snapshot, así que el
 * archivo y la pantalla no pueden decir cosas distintas. Si se agrega una
 * sección a la hoja, va acá también.
 *
 * Dos fuentes, por los diacríticos: el texto (títulos, rubros, cuentas,
 * notas) va en Cormorant, que tiene ḍ, ḥ, Ḥ y ṭ —un fondo puede llamarse
 * Ḥuqúqu'lláh y "Riḍván" está en el encabezado—; las cifras y los rótulos
 * en mayúscula van en Outfit, que se lee mejor en una tabla y no tiene
 * esos signos. Helvetica (la del Libro de Caja) no sirve: no tiene ni ḍ ni
 * el signo menos. Las fuentes las registra la ruta (registerBookletFonts).
 *
 * Igual que la hoja, no lleva NINGÚN nombre de contribuyente.
 */

const INK = "#1b2033";
const MIST = "#6b7080";
const GOLD = "#96790E";
const LINE = "#e2ddd0";
const RED = "#b42318";
const GREEN = "#3f6b35";

const s = StyleSheet.create({
  page: {
    paddingTop: 38,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontFamily: "Cormorant",
    fontSize: 10.5,
    color: INK,
  },
  eyebrow: {
    fontFamily: "Outfit",
    fontWeight: 600,
    fontSize: 6.5,
    letterSpacing: 1.6,
    color: GOLD,
    textTransform: "uppercase",
  },
  title: { fontSize: 21, fontWeight: 600, marginTop: 2, lineHeight: 1.15 },
  subtitle: { fontSize: 11, color: MIST, marginTop: 1 },
  institution: { fontSize: 11, marginTop: 5 },
  header: { borderBottomWidth: 1.5, borderBottomColor: GOLD, paddingBottom: 9 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 22, marginTop: 9 },
  metaLabel: {
    fontFamily: "Outfit",
    fontWeight: 600,
    fontSize: 6,
    color: MIST,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  metaValue: { fontSize: 10.5, fontWeight: 600 },
  section: { marginTop: 15 },
  h2: {
    fontSize: 13.5,
    fontWeight: 600,
    borderBottomWidth: 0.5,
    borderBottomColor: "#bbb",
    paddingBottom: 2,
    marginBottom: 5,
  },
  h3: {
    fontFamily: "Outfit",
    fontWeight: 600,
    fontSize: 6.5,
    color: MIST,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  tr: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
    paddingVertical: 2.5,
    alignItems: "flex-end",
  },
  trHead: {
    flexDirection: "row",
    borderBottomWidth: 0.8,
    borderBottomColor: "#999",
    paddingVertical: 2.5,
  },
  trTotal: {
    flexDirection: "row",
    borderTopWidth: 1.2,
    borderTopColor: "#888",
    paddingVertical: 3,
    alignItems: "flex-end",
  },
  trCategory: { backgroundColor: "#f6f3ea", paddingVertical: 2, paddingHorizontal: 2 },
  th: {
    fontFamily: "Outfit",
    fontWeight: 600,
    fontSize: 6,
    color: MIST,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  categoryText: {
    fontFamily: "Outfit",
    fontWeight: 600,
    fontSize: 6.5,
    color: GOLD,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  label: { fontSize: 10.5 },
  num: { fontFamily: "Outfit", fontSize: 8.5, textAlign: "right" },
  bold: { fontWeight: 600 },
  muted: { color: MIST },
  neg: { color: RED },
  pos: { color: GREEN },
  small: { fontSize: 9.5, color: MIST, marginTop: 4, lineHeight: 1.3 },
  note: {
    fontSize: 10,
    color: MIST,
    marginTop: 5,
    paddingLeft: 7,
    borderLeftWidth: 1.5,
    borderLeftColor: "#d8c78f",
    lineHeight: 1.35,
  },
  empty: {
    fontSize: 10,
    color: MIST,
    textAlign: "center",
    borderWidth: 0.5,
    borderStyle: "dashed",
    borderColor: "#bbb",
    paddingVertical: 7,
  },
  recon: { marginTop: 7, borderWidth: 0.5, paddingVertical: 4, paddingHorizontal: 7 },
  footer: {
    position: "absolute",
    left: 40,
    right: 40,
    bottom: 20,
    borderTopWidth: 0.5,
    borderTopColor: "#aaa",
    paddingTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontFamily: "Outfit", fontSize: 6.5, color: MIST },
  draft: {
    position: "absolute",
    top: 330,
    left: 95,
    transform: "rotate(-22deg)",
    fontFamily: "Outfit",
    fontWeight: 600,
    fontSize: 56,
    color: "#b4231826",
    letterSpacing: 6,
  },
});

export function ReportSheetPdf({
  report,
  localityName,
  institution,
  approvedBy,
  emittedBy,
  draft,
}: {
  report: ReportSheetData;
  localityName: string;
  institution?: string | null;
  approvedBy?: string | null;
  emittedBy?: string | null;
  /** Todavía no emitido: sale con marca de agua, para que nadie lo tome
   *  por el que se aprueba. */
  draft: boolean;
}) {
  const sn = report.snapshot;
  const ed = report.editorial;
  const main = primaryCurrency([...sn.income, ...sn.expenses]);
  const cols = currencyColumns(sn, main);
  const issuer = institution ?? `Asamblea Espiritual Local de los Bahá'ís de ${localityName}`;
  let n = 0;
  const num = () => ++n;

  return (
    <Document
      title={`Informe de Tesorería · ${report.title}`}
      author={issuer}
      subject="Informe de Tesorería · Uso interno"
    >
      <Page size="A4" style={s.page} wrap>
        {draft ? <Text style={s.draft} fixed>BORRADOR</Text> : null}

        {/* ─── Encabezado ─── */}
        <View style={s.header}>
          <Text style={s.eyebrow}>Informe de Tesorería · Uso interno</Text>
          <Text style={s.title}>{report.title}</Text>
          {report.subtitle ? <Text style={s.subtitle}>{report.subtitle}</Text> : null}
          <Text style={s.institution}>{issuer}</Text>
          <View style={s.metaRow}>
            <Meta label="Período" value={`${fmtLongDate(sn.from)} al ${fmtLongDate(sn.to)}`} />
            {sn.bahaiYear ? (
              <Meta label="Ejercicio" value={`${sn.bahaiYear} E.B. (Riḍván a Riḍván)`} />
            ) : null}
            {emittedBy ? <Meta label="Emitido por" value={emittedBy} /> : null}
          </View>
        </View>

        {/* ─── 1 · Resumen ─── */}
        <Section title={`${num()} · Resumen del período`}>
          <View style={s.trHead}>
            <Text style={[s.th, { flex: 1 }]}>Concepto</Text>
            {cols.map((c) => (
              <Text key={c} style={[s.th, { width: 90, textAlign: "right" }]}>
                {c}
              </Text>
            ))}
          </View>
          <SummaryRow label="Contribuciones recibidas" amounts={sn.income} cols={cols} />
          <SummaryRow label="Egresos aplicados" amounts={sn.expenses} cols={cols} negative />
          <SummaryRow label="Resultado del período" amounts={sn.result} cols={cols} strong />
          <Text style={s.small}>
            {sn.incomeCount} {sn.incomeCount === 1 ? "aporte" : "aportes"}
            {sn.receiptFrom && sn.receiptTo
              ? sn.receiptFrom === sn.receiptTo
                ? ` · recibo N.º ${sn.receiptFrom}`
                : ` · recibos N.º ${sn.receiptFrom} al ${sn.receiptTo}`
              : " · sin recibos numerados"}
            {" · "}
            {sn.expenseLines.length}{" "}
            {sn.expenseLines.length === 1 ? "movimiento de egreso" : "movimientos de egreso"}. Las
            transferencias entre cuentas no cuentan como ingreso ni como gasto; van en la sección 5.
          </Text>
          <Note text={note(ed, "summary")} />
        </Section>

        {/* ─── 2 · Ingresos por rubro ─── */}
        <Section title={`${num()} · Ingresos por rubro`}>
          {sn.incomeByRubro.length === 0 ? (
            <Text style={s.empty}>Sin contribuciones registradas en el período.</Text>
          ) : (
            <RubroTable rubros={sn.incomeByRubro} countLabel="Aportes" />
          )}
          <Text style={s.small}>
            El detalle por contribuyente no forma parte de este informe: las contribuciones son
            confidenciales y quedan en el libro, a cargo de la Tesorería.
          </Text>
          <Note text={note(ed, "income")} />
        </Section>

        {/* ─── 3 · Egresos por rubro ─── */}
        <Section title={`${num()} · Egresos por rubro`}>
          {sn.expenseByRubro.length === 0 ? (
            <Text style={s.empty}>No se aplicaron gastos del Fondo en el período.</Text>
          ) : (
            <RubroTable rubros={sn.expenseByRubro} countLabel="Movim." negative />
          )}
          <Note text={note(ed, "expenses")} />
        </Section>

        {/* ─── 4 · Saldos y conciliación ─── */}
        <Section title={`${num()} · Saldos al cierre y conciliación`}>
          <View style={{ flexDirection: "row", gap: 18 }}>
            <BalanceTable title="Por fondo" rows={sn.byFund} />
            <BalanceTable title="Por cuenta" rows={sn.byAccount} />
          </View>
          <Reconciliation byFund={sn.byFund} byAccount={sn.byAccount} />
          <Text style={s.small}>
            Los saldos son acumulados a la fecha de cierre —incluyen el arrastre del ejercicio
            anterior—, no del período informado.
          </Text>
          <Note text={note(ed, "funds")} />
          <Note text={note(ed, "accounts")} />
        </Section>

        {/* ─── 5 · Movimientos internos ─── */}
        <Section title={`${num()} · Movimientos internos`}>
          {sn.internalLines.length === 0 ? (
            <Text style={s.empty}>Sin cambios de caja ni compras de divisas en el período.</Text>
          ) : (
            <InternalTable lines={sn.internalLines} />
          )}
        </Section>

        {/* ─── 6 · Presupuesto ─── */}
        {sn.budget && sn.budget.lines.length > 0 ? (
          <Section title={`${num()} · Presupuesto ${sn.budget.period} y ejecución`}>
            <BudgetTable lines={sn.budget.lines} />
            <Text style={s.small}>
              El ejecutado es del ejercicio a la fecha de cierre, no del período informado: el
              presupuesto es anual.
            </Text>
            <Note text={note(ed, "budget")} />
          </Section>
        ) : null}

        {/* ─── 7 · Observaciones ─── */}
        {ed.observations ? (
          <Section title={`${num()} · Observaciones y pendientes`}>
            <Text style={{ fontSize: 10.5, lineHeight: 1.4 }}>{ed.observations}</Text>
          </Section>
        ) : null}

        {/* ─── Aprobación ─── */}
        <Approval editorial={ed} emittedBy={emittedBy} approvedBy={approvedBy} />

        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            {issuer} · Informe de Tesorería de uso interno de la Asamblea
          </Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

// ─── Piezas ──────────────────────────────────────────────────────

function note(ed: ReportEditorial, key: NoteKey): string | undefined {
  return ed.notes[key] || undefined;
}

/** "− $ 7.561" y no "$ -7.561": el signo va antes del símbolo. */
function fmtSigned(amount: number, currency?: string): string {
  const rounded = Math.round(amount * 100) / 100;
  if (rounded < 0) return `− ${fmtAmount(Math.abs(rounded), currency)}`;
  return fmtAmount(rounded, currency);
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={s.metaLabel}>{label}</Text>
      <Text style={s.metaValue}>{value}</Text>
    </View>
  );
}

/** Una sección no empieza al pie de una hoja con su título solo. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.h2} minPresenceAhead={60}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Note({ text }: { text?: string }) {
  if (!text) return null;
  return <Text style={s.note}>{text}</Text>;
}

/** Las monedas que aparecen en el informe, en orden: la principal primero. */
function currencyColumns(sn: ReportSnapshot, main: string): string[] {
  const all = new Set<string>();
  for (const m of [...sn.income, ...sn.expenses, ...sn.result]) all.add(m.currency);
  const rest = [...all].filter((c) => c !== main).sort();
  return all.has(main) ? [main, ...rest] : rest.length > 0 ? rest : [main];
}

function SummaryRow({
  label,
  amounts,
  cols,
  negative = false,
  strong = false,
}: {
  label: string;
  amounts: ReportMoney[];
  cols: string[];
  negative?: boolean;
  strong?: boolean;
}) {
  return (
    <View style={s.tr} wrap={false}>
      <Text style={[s.label, { flex: 1 }, strong ? s.bold : {}]}>{label}</Text>
      {cols.map((currency) => {
        const found = amounts.find((a) => a.currency === currency);
        if (!found) {
          return (
            <Text key={currency} style={[s.num, s.muted, { width: 90 }]}>
              —
            </Text>
          );
        }
        const value = found.amount;
        const sign = negative ? "− " : strong && value >= 0 ? "+ " : value < 0 ? "− " : "";
        const tone = negative || value < 0 ? s.neg : strong ? s.pos : {};
        return (
          <Text key={currency} style={[s.num, { width: 90 }, tone, strong ? s.bold : {}]}>
            {sign}
            {fmtAmount(Math.abs(value), currency)}
          </Text>
        );
      })}
    </View>
  );
}

/** Rubros agrupados por categoría, con subtotal si la categoría tiene más de uno. */
function RubroTable({
  rubros,
  countLabel,
  negative = false,
}: {
  rubros: ReportRubro[];
  countLabel: string;
  negative?: boolean;
}) {
  const byCategory = new Map<string, ReportRubro[]>();
  for (const r of rubros) {
    const list = byCategory.get(r.category) ?? [];
    list.push(r);
    byCategory.set(r.category, list);
  }
  const sign = negative ? "− " : "";
  const money = (amount: number, currency: string) =>
    `${sign}${fmtAmount(amount, currency)}${currency !== "UYU" ? ` ${currency}` : ""}`;

  return (
    <View>
      <View style={s.trHead} fixed>
        <Text style={[s.th, { flex: 1 }]}>Rubro</Text>
        <Text style={[s.th, { width: 55, textAlign: "right" }]}>{countLabel}</Text>
        <Text style={[s.th, { width: 120, textAlign: "right" }]}>Monto</Text>
      </View>
      {[...byCategory.entries()].map(([category, list]) => {
        const totals = new Map<string, number>();
        for (const r of list) totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.amount);
        return (
          <View key={category}>
            <View style={s.trCategory} minPresenceAhead={30}>
              <Text style={s.categoryText}>{category || "Sin categoría"}</Text>
            </View>
            {list.map((r, i) => (
              <View key={`${r.subcategory}-${r.currency}-${i}`} style={s.tr} wrap={false}>
                <Text style={[s.label, { flex: 1, paddingLeft: 8 }]}>{r.subcategory || "—"}</Text>
                <Text style={[s.num, s.muted, { width: 55 }]}>{r.count}</Text>
                <Text style={[s.num, { width: 120 }, negative ? s.neg : {}]}>
                  {money(r.amount, r.currency)}
                </Text>
              </View>
            ))}
            {list.length > 1 ? (
              <View style={[s.tr, { borderBottomColor: "#bbb" }]} wrap={false}>
                <Text style={[s.label, s.muted, s.bold, { flex: 1, paddingLeft: 8 }]}>
                  Subtotal {category}
                </Text>
                <Text style={[s.num, s.bold, { width: 175 }]}>
                  {[...totals.entries()].map(([c, a]) => money(a, c)).join("  ·  ")}
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function totalByCurrency(rows: ReportBalanceRow[]): ReportMoney[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.currency, Math.round(((map.get(r.currency) ?? 0) + r.amount) * 100) / 100);
  }
  return [...map.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}

function BalanceTable({ title, rows }: { title: string; rows: ReportBalanceRow[] }) {
  const totals = totalByCurrency(rows);
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.h3}>{title}</Text>
      {rows.map((r) => (
        <View key={`${r.label}|${r.currency}`} style={s.tr} wrap={false}>
          <Text style={[s.label, { flex: 1, fontSize: 10 }]}>{r.label}</Text>
          <Text style={[s.num, { width: 95 }, r.amount < 0 ? s.neg : {}]}>
            {fmtAmount(r.amount, r.currency)} <Text style={s.muted}>{r.currency}</Text>
          </Text>
        </View>
      ))}
      {totals.map((t) => (
        <View key={`t-${t.currency}`} style={s.trTotal} wrap={false}>
          <Text style={[s.label, s.bold, { flex: 1, fontSize: 10 }]}>Total {t.currency}</Text>
          <Text style={[s.num, s.bold, { width: 95 }]}>{fmtAmount(t.amount, t.currency)}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Fondos y cuentas tienen que dar lo mismo, moneda por moneda. Si no da,
 * se dice en rojo en vez de disimularlo.
 */
function Reconciliation({
  byFund,
  byAccount,
}: {
  byFund: ReportBalanceRow[];
  byAccount: ReportBalanceRow[];
}) {
  const funds = totalByCurrency(byFund);
  const accounts = totalByCurrency(byAccount);
  const currencies = [...new Set([...funds, ...accounts].map((r) => r.currency))].sort();
  if (currencies.length === 0) return null;

  const checks = currencies.map((currency) => {
    const f = funds.find((r) => r.currency === currency)?.amount ?? 0;
    const a = accounts.find((r) => r.currency === currency)?.amount ?? 0;
    return { currency, fund: f, account: a, diff: Math.round((f - a) * 100) / 100 };
  });
  const ok = checks.every((c) => Math.abs(c.diff) < 0.005);

  return (
    <View
      style={[
        s.recon,
        ok
          ? { borderColor: "#9fbf94", backgroundColor: "#f1f6ee" }
          : { borderColor: "#e8a29a", backgroundColor: "#fdf1ef" },
      ]}
      wrap={false}
    >
      <Text style={[s.h3, { marginBottom: 1 }]}>Conciliación</Text>
      {checks.map((c) => {
        const same = Math.abs(c.diff) < 0.005;
        return (
          <View key={c.currency} style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 10 }}>
              {c.currency}: fondos {fmtAmount(c.fund, c.currency)} · cuentas{" "}
              {fmtAmount(c.account, c.currency)}
            </Text>
            <Text style={[{ fontSize: 10 }, s.bold, same ? s.pos : s.neg]}>
              {same ? "coincide" : `diferencia ${fmtAmount(c.diff, c.currency)}`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Las transferencias con sus dos patas, agrupadas por operación. */
function InternalTable({ lines }: { lines: ReportInternalLine[] }) {
  const groups = new Map<string, ReportInternalLine[]>();
  for (const l of lines) {
    const list = groups.get(l.group) ?? [];
    list.push(l);
    groups.set(l.group, list);
  }
  const W = [80, 145, 145, 145];

  return (
    <View>
      <View style={s.trHead} fixed>
        {["Fecha", "Operación", "Sale de", "Entra a"].map((h, i) => (
          <Text key={h} style={[s.th, { width: W[i] }]}>
            {h}
          </Text>
        ))}
      </View>
      {[...groups.values()].map((legs, i) => {
        const out = legs.find((l) => l.amount < 0);
        const into = legs.find((l) => l.amount > 0);
        // Entre monedas, el tipo de cambio queda implícito en los dos
        // montos: lo explicitamos.
        const rate =
          out && into && out.currency !== into.currency && into.amount !== 0
            ? Math.abs(out.amount) / into.amount
            : null;
        return (
          <View key={i} style={[s.tr, { alignItems: "flex-start" }]} wrap={false}>
            <Text style={[s.label, s.muted, { width: W[0], fontSize: 9.5 }]}>
              {fmtLongDate(legs[0].date)}
            </Text>
            <Text style={[s.label, { width: W[1], fontSize: 10, paddingRight: 4 }]}>
              {legs[0].label}
              {rate ? ` (tipo de cambio ${rate.toFixed(2)})` : ""}
            </Text>
            <Text style={[s.label, s.neg, { width: W[2], fontSize: 10, paddingRight: 4 }]}>
              {out
                ? `${out.account} · ${fmtAmount(Math.abs(out.amount), out.currency)} ${out.currency}`
                : "—"}
            </Text>
            <Text style={[s.label, s.pos, { width: W[3], fontSize: 10 }]}>
              {into ? `${into.account} · ${fmtAmount(into.amount, into.currency)} ${into.currency}` : "—"}
            </Text>
          </View>
        );
      })}
      <Text style={s.small}>
        Estas operaciones mueven la plata de lugar sin que entre ni salga nada del Fondo, así que no
        figuran en los ingresos ni en los egresos. El costo del giro, cuando lo hay, sí se informa
        como gasto.
      </Text>
    </View>
  );
}

function BudgetTable({ lines }: { lines: ReportBudgetLine[] }) {
  // El total compara solo lo comparable: una línea sin ejecutado conocido
  // daría un "saldo" que parece sobrante y no lo es.
  const linked = lines.filter((l) => l.linked);
  const planned = linked.reduce((acc, l) => acc + l.planned, 0);
  const actual = linked.reduce((acc, l) => acc + l.actual, 0);
  const unlinkedPlanned = lines.filter((l) => !l.linked).reduce((acc, l) => acc + l.planned, 0);
  const W = 85;

  return (
    <View>
      <View style={s.trHead} fixed>
        <Text style={[s.th, { flex: 1 }]}>Categoría</Text>
        {["Presupuestado", "Ejecutado", "Saldo"].map((h) => (
          <Text key={h} style={[s.th, { width: W, textAlign: "right" }]}>
            {h}
          </Text>
        ))}
      </View>
      {lines.map((l) => {
        const rest = l.planned - l.actual;
        return (
          <View key={l.category} style={s.tr} wrap={false}>
            <Text style={[s.label, { flex: 1 }]}>
              {l.category}
              {l.linked ? "" : <Text style={[s.muted, { fontStyle: "italic" }]}> (sin vincular al libro)</Text>}
            </Text>
            <Text style={[s.num, { width: W }]}>{fmtAmount(l.planned)}</Text>
            <Text style={[s.num, { width: W }]}>{l.linked ? fmtAmount(l.actual) : "—"}</Text>
            <Text style={[s.num, { width: W }, ...(l.linked && rest < 0 ? [s.neg, s.bold] : [s.muted])]}>
              {l.linked ? fmtSigned(rest) : "—"}
            </Text>
          </View>
        );
      })}
      <View style={s.trTotal} wrap={false}>
        <Text style={[s.label, s.bold, { flex: 1 }]}>Total comparable</Text>
        <Text style={[s.num, s.bold, { width: W }]}>{fmtAmount(planned)}</Text>
        <Text style={[s.num, s.bold, { width: W }]}>{fmtAmount(actual)}</Text>
        <Text style={[s.num, s.bold, { width: W }]}>{fmtSigned(planned - actual)}</Text>
      </View>
      {unlinkedPlanned > 0 ? (
        <Text style={s.small}>
          El total incluye únicamente las categorías vinculadas al libro. Quedan{" "}
          {fmtAmount(unlinkedPlanned)} presupuestados que todavía no se pueden comparar.
        </Text>
      ) : null}
    </View>
  );
}

// ─── Aprobación ──────────────────────────────────────────────────

function Approval({
  editorial,
  emittedBy,
  approvedBy,
}: {
  editorial: ReportEditorial;
  emittedBy?: string | null;
  approvedBy?: string | null;
}) {
  const appr = editorial.approval;
  const signature = editorial.signature;
  return (
    <View
      style={{ marginTop: 22, borderTopWidth: 1.5, borderTopColor: GOLD, paddingTop: 9 }}
      wrap={false}
    >
      <Text style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
        Visto y aprobado por la {approvedBy ?? "Asamblea Espiritual Local"}
      </Text>
      <View style={{ flexDirection: "row", gap: 24 }}>
        <FillLine label="En su reunión del" value={appr?.meetingDate} />
        <FillLine label="Acta N.º" value={appr?.actaNumber} />
      </View>
      <View style={{ flexDirection: "row", gap: 40, marginTop: 34 }}>
        <SignLine name={signature?.name || emittedBy || " "} role={signature?.role || "Tesorero/a"} />
        <SignLine name=" " role="Secretario/a de la Asamblea" />
      </View>
    </View>
  );
}

/** Dato cargado, o una línea de puntos para completar a mano. */
function FillLine({ label, value }: { label: string; value?: string }) {
  return (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-end", gap: 5 }}>
      <Text style={[s.muted, { fontSize: 10.5 }]}>{label}</Text>
      {value ? (
        <Text style={[s.bold, { fontSize: 10.5 }]}>{value}</Text>
      ) : (
        <View style={{ flex: 1, borderBottomWidth: 0.7, borderBottomStyle: "dotted", borderBottomColor: "#555", marginBottom: 2 }} />
      )}
    </View>
  );
}

function SignLine({ name, role }: { name: string; role: string }) {
  return (
    <View style={{ flex: 1, borderTopWidth: 0.7, borderTopColor: "#555", paddingTop: 2 }}>
      <Text style={{ fontSize: 10.5, textAlign: "center" }}>{name}</Text>
      <Text style={[s.muted, { fontSize: 9.5, textAlign: "center" }]}>{role}</Text>
    </View>
  );
}

export function reportPdfFileName(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  // Casi todos los títulos ya empiezan con "Informe de Tesorería".
  if (/^informe/i.test(slug)) return `${slug}.pdf`;
  return `Informe-Tesoreria-${slug || "interno"}.pdf`;
}

