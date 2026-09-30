import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { monthLabel } from "@/lib/treasury-cashbook";
import type { HandoverData } from "@/lib/treasury-handover";
import { fmtAmount, fmtLongDate } from "@/lib/treasury-report-content";

/**
 * El acta de traspaso de la Tesorería en PDF (react-pdf, Helvetica): la
 * foto del libro el día del cambio, la lista de lo que se entrega con
 * casilleros para tildar a mano, observaciones y tres firmas. Se firma en
 * papel; la app la regenera para la misma fecha cuando haga falta.
 */

const INK = "#1b2033";
const MIST = "#6b7080";
const GOLD = "#96790E";
const LINE = "#d9d4c7";
const RED = "#b42318";
const GREEN = "#4f7a45";

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 56, paddingHorizontal: 44, fontFamily: "Helvetica", fontSize: 9.5, color: INK, lineHeight: 1.35 },
  eyebrow: { fontSize: 7, letterSpacing: 1.5, color: GOLD, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  title: { fontSize: 17, fontFamily: "Helvetica-Bold", marginTop: 4 },
  legal: { fontSize: 8, color: MIST, marginTop: 2 },
  rule: { borderBottomWidth: 1.5, borderBottomColor: GOLD, paddingBottom: 8, marginBottom: 10 },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 4 },
  p: { fontSize: 9.5, marginBottom: 4 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 3 },
  trHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#999", paddingVertical: 3 },
  trTotal: { flexDirection: "row", borderTopWidth: 1.5, borderTopColor: "#777", paddingVertical: 4 },
  th: { fontSize: 6.5, color: MIST, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  td: { fontSize: 9 },
  bold: { fontFamily: "Helvetica-Bold" },
  right: { textAlign: "right" },
  muted: { color: MIST },
  red: { color: RED },
  green: { color: GREEN },
  box: { width: 9, height: 9, borderWidth: 0.8, borderColor: "#555", marginRight: 6, marginTop: 1.5 },
  check: { flexDirection: "row", alignItems: "flex-start", marginBottom: 3 },
  notes: { borderWidth: 0.5, borderColor: LINE, minHeight: 70, padding: 6, marginTop: 4, fontSize: 9 },
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 34 },
  sig: { width: 150, borderTopWidth: 0.6, borderTopColor: "#555", paddingTop: 3, fontSize: 8, textAlign: "center", color: MIST },
  sigName: { fontSize: 9, fontFamily: "Helvetica-Bold", color: INK, textAlign: "center", marginBottom: 1 },
  footer: { position: "absolute", left: 44, right: 44, bottom: 22, fontSize: 7, color: MIST, borderTopWidth: 0.5, borderTopColor: "#999", paddingTop: 4 },
});

const W = [220, 60, 110];

function money(n: number, c: string) {
  return n < 0 ? `- ${fmtAmount(Math.abs(n), c)}` : fmtAmount(n, c);
}

export function HandoverActPdf({
  data,
  localityName,
  outgoing,
  incoming,
  witness,
  notes,
}: {
  data: HandoverData;
  localityName: string;
  outgoing: string;
  incoming: string;
  witness: string;
  notes: string;
}) {
  const title = data.legal.registeredName || `Asamblea Espiritual Local de los Bahá'ís de ${localityName}`;
  const legalLine = [data.legal.rut ? `RUT ${data.legal.rut}` : null, data.legal.address].filter(Boolean).join(" · ");
  const open = data.closings.openMonths;

  return (
    <Document title={`Acta de traspaso de la Tesorería · ${localityName} · ${data.asOf}`} author={title}>
      <Page size="A4" style={s.page} wrap>
        <View style={s.rule}>
          <Text style={s.eyebrow}>Tesorería</Text>
          <Text style={s.title}>Acta de traspaso de la Tesorería</Text>
          <Text style={s.legal}>{title}{legalLine ? ` · ${legalLine}` : ""}</Text>
        </View>

        <Text style={s.p}>
          En {localityName}, el {fmtLongDate(data.asOf)}
          {data.bahaiYear ? ` (ejercicio ${data.bahaiYear} E.B.)` : ""}, <Text style={s.bold}>{outgoing || "________________"}</Text>,
          Tesorero/a saliente, entrega a <Text style={s.bold}>{incoming || "________________"}</Text>, Tesorero/a entrante,
          la Tesorería de la Asamblea en el estado que se detalla, según el libro llevado en la aplicación de la
          comunidad al cierre de ese día.
        </Text>

        {/* 1 · Saldos */}
        <Text style={s.h2}>1. Saldos del libro al {fmtLongDate(data.asOf)}</Text>
        <View style={s.trHead}>
          <Text style={[s.th, { width: W[0] }]}>Cuenta</Text>
          <Text style={[s.th, { width: W[1] }]}>Moneda</Text>
          <Text style={[s.th, s.right, { width: W[2] }]}>Saldo</Text>
        </View>
        {data.balances.map((b) => (
          <View key={`${b.account}|${b.currency}`} style={s.tr}>
            <Text style={[s.td, { width: W[0] }]}>{b.account}</Text>
            <Text style={[s.td, s.muted, { width: W[1] }]}>{b.currency}</Text>
            <Text style={[s.td, s.right, { width: W[2] }, b.amount < 0 ? s.red : {}]}>{money(b.amount, b.currency)}</Text>
          </View>
        ))}
        {data.totals.map((t) => (
          <View key={t.currency} style={s.trTotal}>
            <Text style={[s.td, s.bold, { width: W[0] + W[1] }]}>Total {t.currency}</Text>
            <Text style={[s.td, s.right, s.bold, { width: W[2] }]}>{money(t.amount, t.currency)}</Text>
          </View>
        ))}
        <Text style={[s.p, s.muted, { marginTop: 3, fontSize: 8 }]}>
          Cada moneda por separado; el libro no convierte. {data.entriesCount} movimientos vigentes hasta la fecha.
        </Text>

        {/* 2 · Cajas */}
        <Text style={s.h2}>2. Efectivo en cajas chicas</Text>
        {data.cashBoxes.length === 0 ? (
          <Text style={[s.p, s.muted]}>No hay cajas chicas registradas en la aplicación.</Text>
        ) : (
          data.cashBoxes.map((c) => (
            <View key={c.name} style={{ marginBottom: 5 }}>
              <Text style={[s.td, s.bold]}>
                {c.name}
                {c.holder ? ` · responsable: ${c.holder}` : ""}
              </Text>
              <Text style={s.td}>
                Fondo fijo: {c.fixed.length ? c.fixed.map((f) => fmtAmount(f.amount, f.currency)).join(" y ") : "sin definir"} ·
                Saldo en el libro: {c.balance.length ? c.balance.map((b) => fmtAmount(b.amount, b.currency)).join(" · ") : "—"}
              </Text>
              <Text style={[s.td, c.lastCount ? (c.lastCount.ok ? s.green : s.red) : s.red]}>
                {c.lastCount
                  ? `Último arqueo el ${fmtLongDate(c.lastCount.on)}: ${c.lastCount.ok ? "cuadró" : c.lastCount.diffs.join(", ")}`
                  : "Sin arqueo registrado: contar el efectivo al firmar y anotar el resultado abajo."}
                {c.pendingReports > 0 ? ` · ${c.pendingReports} rendición(es) sin aprobar` : ""}
              </Text>
            </View>
          ))
        )}
        <View style={s.check}>
          <View style={s.box} />
          <Text style={s.td}>Efectivo contado delante de ambos y coincide con el libro (o la diferencia queda anotada en Observaciones).</Text>
        </View>

        {/* 3 · Estado del libro */}
        <Text style={s.h2}>3. Estado del libro</Text>
        <Text style={s.p}>
          Meses cerrados hasta: <Text style={s.bold}>{data.closings.lastClosed ? monthLabel(data.closings.lastClosed) : "ninguno"}</Text>.
          {open.length > 0 ? (
            <Text style={s.red}> Quedan abiertos: {open.map(monthLabel).join(", ")}.</Text>
          ) : (
            <Text style={s.green}> Todos los meses completos están cerrados.</Text>
          )}
        </Text>
        <Text style={s.p}>
          Recibos: último número {data.receipts.lastNumber ?? "—"} · {data.receipts.unissued} sin marcar como emitido ·{" "}
          {data.receipts.voided} anulado(s) en la serie.
        </Text>
        <Text style={s.p}>
          Auditoría:{" "}
          {data.audit === null
            ? "no habilitada."
            : data.audit.runAt === null
              ? "nunca se corrió."
              : `última corrida el ${fmtLongDate(data.audit.runAt.slice(0, 10))} · ${data.audit.pendingHigh} hallazgo(s) grave(s) y ${data.audit.pendingMedium} medio(s) sin resolver.`}
        </Text>
        {data.reconciliation.length > 0 && (
          <Text style={s.p}>
            Conciliación bancaria de {data.reconciliation[0].month}:{" "}
            {data.reconciliation
              .map((r) => `${r.account} ${r.status === "conciliado" ? "conciliada" : r.status === "sin-extracto" ? "sin extracto" : `${r.pending} pendiente(s)`}`)
              .join(" · ")}
            .
          </Text>
        )}
        <Text style={s.p}>
          Estado del Fondo compartido con la comunidad: {data.publication ? `el ${fmtLongDate(data.publication.slice(0, 10))}` : "nunca"}.
        </Text>

        {/* 4 · Lo que se entrega */}
        <Text style={s.h2}>4. Documentación y accesos que se entregan</Text>
        {[
          "Legajo del ejercicio (ZIP generado desde la aplicación, con libro, Libro de Caja, recibos, comprobantes, extractos y auditoría).",
          "Libro de tapas duras con las hojas del Libro de Caja pegadas hasta el último mes cerrado.",
          "Comprobantes en papel que no estén digitalizados, y recibos impresos pendientes de entregar.",
          "Acceso a las cuentas: BROU (firmas autorizadas), Prex, Mercado Pago; claves de DGI y BPS de la Asamblea.",
          "Firma escaneada del Tesorero/a entrante cargada en Recibo y medios de pago.",
          "Permiso de Tesorería asignado al entrante y retirado al saliente; cambio registrado en Datos de la Asamblea con fecha.",
        ].map((t) => (
          <View key={t} style={s.check}>
            <View style={s.box} />
            <Text style={s.td}>{t}</Text>
          </View>
        ))}

        {/* 5 · Observaciones */}
        <Text style={s.h2}>5. Observaciones</Text>
        <View style={s.notes}>
          <Text>{notes || " "}</Text>
        </View>

        {/* Firmas */}
        <View style={s.sigRow} wrap={false}>
          <View>
            <Text style={s.sigName}>{outgoing || " "}</Text>
            <Text style={s.sig}>Entrega · Tesorero/a saliente</Text>
          </View>
          <View>
            <Text style={s.sigName}>{incoming || " "}</Text>
            <Text style={s.sig}>Recibe · Tesorero/a entrante</Text>
          </View>
          <View>
            <Text style={s.sigName}>{witness || " "}</Text>
            <Text style={s.sig}>Testigo · Secretario/a</Text>
          </View>
        </View>

        <Text style={s.footer} fixed>
          Acta generada desde la aplicación de la comunidad el {fmtLongDate(data.asOf)}. Las cifras salen del libro tal como estaba ese día;
          los meses cerrados no pueden cambiar. Se firma en papel y se archiva con el legajo.
        </Text>
      </Page>
    </Document>
  );
}
