import { Banner, Card, PageHeader } from "@/components/admin/ui";
import { TREASURY_HELP } from "@/lib/treasury-help";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { todayISO } from "@/lib/treasury-ledger";
import { statutoryYears } from "@/lib/treasury-reports";
import { treasuryYearEnd, treasuryYearForDate, treasuryYearStart } from "@/lib/treasury-year";
import { LegajoClient, type PeriodOption } from "./legajo-client";

export const dynamic = "force-dynamic";

/**
 * Legajo para el auditor: elegir el período y bajar UNA carpeta
 * comprimida con todo lo que una auditoría pide. El armado pasa por el
 * navegador (ver lib/treasury-dossier.ts): esta página solo ofrece los
 * períodos que tienen sentido y explica qué va adentro.
 */
export default async function LegajoPage() {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);

  const today = todayISO();
  const currentYear = treasuryYearForDate(today) ?? 183;
  const options: PeriodOption[] = [];
  for (const y of [currentYear, currentYear - 1, currentYear - 2]) {
    const from = treasuryYearStart(y);
    const to = treasuryYearEnd(y);
    if (!from || !to) continue;
    options.push({
      key: `eb-${y}`,
      label: `Ejercicio ${y} E.B. (Riḍván a Riḍván)${y === currentYear ? " · en curso, hasta hoy" : ""}`,
      from,
      to: y === currentYear ? today : to,
    });
  }
  for (const r of statutoryYears(today).reverse()) {
    options.push({
      key: `est-${r.from}`,
      label: `Ejercicio estatutario ${r.from.slice(0, 4)}–${r.to.slice(0, 4)} (18 abr → 17 abr)${
        r.to > today ? " · en curso, hasta hoy" : ""
      }`,
      from: r.from,
      to: r.to > today ? today : r.to,
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="Tesorería"
        help={TREASURY_HELP.screens.legajo}
        title="Legajo para el auditor"
        description="Todo lo que una auditoría pide, de un período, en una sola carpeta comprimida para entregar."
      />

      <div className="mb-5">
        <Banner tone="warning">
          <strong>Confidencial.</strong> El legajo lleva los nombres de los contribuyentes y
          los comprobantes con datos de proveedores. Es para el auditor designado por la
          Asamblea Nacional; no se comparte por el grupo ni se publica.
        </Banner>
      </div>

      <Card className="mb-5">
        <LegajoClient options={options} today={today} localityName={session.locality.name} />
      </Card>

      <Card>
        <h2 className="font-display text-[18px] font-semibold text-dark">Qué va adentro</h2>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-[170px_1fr]">
          <Item k="00-LEEME.txt" v="Qué contiene, cómo leerlo, totales y saldos del período, y los avisos (meses sin cerrar, huecos de recibos, gastos sin comprobante)." />
          <Item k="01-libro" v="El libro completo del período en CSV, con nombres; el catálogo (cuentas, fondos, rubros); los saldos al cierre." />
          <Item k="02-libro-de-caja" v="Un PDF por mes con el Libro Mayor de Caja en el formato del MEC, y quién cerró cada mes. Un mes sin cerrar sale como BORRADOR." />
          <Item k="03-recibos" v="La serie correlativa del período: número, fecha, contribuyente, monto, emitido, anulado y su motivo." />
          <Item k="04-comprobantes" v="Las facturas adjuntas a cada gasto, en carpetas por mes y movimiento, con su índice; y la lista de gastos sin comprobante." />
          <Item k="05-extractos" v="Los extractos importados (archivo original), y el estado de conciliación por cuenta y mes." />
          <Item k="06-auditoria" v="Los hallazgos de la última corrida de las reglas, con qué decidió la Asamblea sobre cada uno." />
          <Item k="07-informes" v="Los informes emitidos que cubren el período, con fecha de reunión y acta si fueron aprobados." />
          <Item k="08-asamblea" v="La ficha legal (nombre registrado, RUT, domicilio), la composición con cargos y vigencias, y los estatutos." />
        </dl>
        <p className="mt-4 text-[12px] text-muted">
          Los CSV abren en Excel (separador «;», coma decimal). Los PDF del Libro de Caja se
          generan en el momento, así que reflejan el libro tal como está hoy: conviene cerrar los
          meses antes de armar el legajo. Antes de entregarlo, mirá los avisos del LEEME.
        </p>
      </Card>
    </>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="font-mono text-[12px] font-semibold text-terra">{k}</dt>
      <dd className="text-dark/85">{v}</dd>
    </>
  );
}
