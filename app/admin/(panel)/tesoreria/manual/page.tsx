import Link from "next/link";
import { PrintButton } from "@/components/admin/PrintButton";
import { Card, PageHeader } from "@/components/admin/ui";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createSupabaseServer } from "@/lib/supabase/server";
import { HANDOVER_STEPS, getTreasuryGuide } from "@/lib/treasury-guide";
import { FIELD_SCREEN, SCREEN_INDEX, TREASURY_HELP } from "@/lib/treasury-help";
import { todayISO } from "@/lib/treasury-ledger";

export const dynamic = "force-dynamic";

/**
 * El manual del tesorero: los mismos textos de ayuda que están repartidos
 * por el panel (lib/treasury-help.ts), juntos y en el orden del menú, más
 * el ciclo del mes y los pasos del traspaso. Para imprimir o guardar en
 * PDF el primer día. No se escribe dos veces: si un "?" cambia, cambia
 * acá.
 */
export default async function ManualPage() {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();
  const guide = await getTreasuryGuide(supabase, {
    localityId: session.locality.id,
    localityKind: session.locality.kind ?? "ael",
  });

  const fieldsByScreen = new Map<string, Array<{ key: string; text: string }>>();
  for (const [key, screen] of Object.entries(FIELD_SCREEN)) {
    const text = TREASURY_HELP.fields[key as keyof typeof TREASURY_HELP.fields];
    if (!text) continue;
    fieldsByScreen.set(screen, [...(fieldsByScreen.get(screen) ?? []), { key, text }]);
  }

  return (
    <div className="cb-manual">
      <style>{MANUAL_CSS}</style>
      <PageHeader
        eyebrow="Tesorería"
        help={TREASURY_HELP.screens.manual}
        title="Manual del tesorero"
        description={`Cómo se lleva la Tesorería de ${session.locality.name} en la app: qué es cada pantalla, el ciclo del mes y el traspaso. Impreso el ${formatDate(todayISO())}.`}
        actions={<PrintButton />}
      />

      <Card className="mb-4">
        <h2 className="font-display text-[18px] font-semibold text-dark">Cómo empezar</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] text-dark/85">
          <li>Instalá la app en el celular y activá los avisos: los recordatorios del cierre y las rendiciones llegan por ahí.</li>
          <li>Abrí <strong>Tesorería → Guía del mes</strong>: es la lista de lo que hay que hacer, con el estado de cada paso.</li>
          <li>Cada pantalla tiene un «?» al lado del título y en los campos difíciles: es este mismo texto, en el lugar.</li>
          <li>Cuando algo no cierre, corré la <strong>Auditoría</strong>: dice qué está mal y cómo se arregla.</li>
        </ol>
      </Card>

      {/* El ciclo del mes */}
      <h2 className="mt-6 font-display text-[22px] font-semibold text-dark">El ciclo del mes</h2>
      <p className="mt-1 text-[13px] text-muted">
        Los pasos, en orden. En la app (Guía del mes) cada uno aparece tildado según lo que ya está hecho.
      </p>
      <ol className="mt-3 flex flex-col gap-3">
        {guide.steps.map((s) => (
          <li key={s.key} className="cb-block">
            <Card>
              <h3 className="font-display text-[17px] font-semibold text-dark">
                {s.order}. {s.title}
              </h3>
              <p className="mt-1 text-[13px] text-dark/80">{s.why}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-dark/85">
                {s.how.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
              <p className="mt-2 text-[11.5px] text-muted">
                En la app: <Link href={s.href} className="font-semibold text-terra">{s.cta}</Link>
              </p>
            </Card>
          </li>
        ))}
      </ol>

      {/* Las pantallas */}
      <h2 className="mt-8 font-display text-[22px] font-semibold text-dark">Las pantallas, en el orden del menú</h2>
      <div className="mt-3 flex flex-col gap-3">
        {SCREEN_INDEX.map((sc) => {
          const fields = fieldsByScreen.get(sc.key) ?? [];
          return (
            <Card key={sc.key} className="cb-block">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-[17px] font-semibold text-dark">{sc.label}</h3>
                <span className="text-[11px] text-muted">{sc.section}</span>
              </div>
              <p className="mt-1 text-[13px] text-dark/85">{TREASURY_HELP.screens[sc.key]}</p>
              {fields.length > 0 && (
                <dl className="mt-3 grid gap-x-6 gap-y-2 border-t border-black/[0.06] pt-3 text-[12.5px] sm:grid-cols-[150px_1fr]">
                  {fields.map((f) => (
                    <FieldRow key={f.key} label={FIELD_LABEL[f.key] ?? f.key} text={f.text} />
                  ))}
                </dl>
              )}
            </Card>
          );
        })}
      </div>

      {/* Traspaso */}
      <h2 className="mt-8 font-display text-[22px] font-semibold text-dark">Cuando cambia el tesorero</h2>
      <ol className="mt-3 flex flex-col gap-2">
        {HANDOVER_STEPS.map((step, i) => (
          <li key={step.title} className="cb-block">
            <Card>
              <h3 className="text-[15px] font-semibold text-dark">
                {i + 1}. {step.title}
              </h3>
              <p className="mt-0.5 text-[12.5px] text-dark/80">{step.detail}</p>
            </Card>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-[12px] text-muted">
        El acta de traspaso (Tesorería → Traspaso) imprime la foto del libro del día del cambio para que la firmen quien
        entrega y quien recibe.
      </p>
    </div>
  );
}

function FieldRow({ label, text }: { label: string; text: string }) {
  return (
    <>
      <dt className="font-semibold text-dark">{label}</dt>
      <dd className="text-dark/80">{text}</dd>
    </>
  );
}

/** Etiquetas legibles de los campos con ayuda (las claves son internas). */
const FIELD_LABEL: Record<string, string> = {
  cuenta: "Cuenta",
  fondo: "Fondo",
  rubro: "Rubro (subcategoría)",
  recibo: "N.º de recibo",
  contribuyente: "Contribuyente",
  seudonimo: "En el recibo figura como",
  aportes: "Aportes agrupados",
  cuentaExtracto: "Cuenta del libro (extracto)",
  destinatario: "Destinatario del informe",
  periodoInforme: "Período del informe",
  estadoPresupuesto: "Estado del presupuesto",
  montoPresupuesto: "Monto por categoría",
  cadenciaMeta: "El monto es (meta)",
  direccionMeta: "Se mide por (meta)",
  ejercicioMeta: "Ejercicio (meta)",
  nombreTesorero: "Nombre del Tesorero/a",
  firma: "Firma escaneada",
  calcular: "Calcular",
  compartir: "Compartir",
  vincularContribuyente: "Vincular a un creyente",
  fusionarContribuyente: "Fusionar fichas",
};

const MANUAL_CSS = `
@media print {
  @page { size: A4 portrait; margin: 14mm; }
  body * { visibility: hidden; }
  .cb-manual, .cb-manual * { visibility: visible; }
  .cb-manual { position: absolute; left: 0; top: 0; width: 100%; }
  .cb-manual .cb-noprint { display: none !important; }
  .cb-manual .cb-block { break-inside: avoid; }
  .cb-manual a { color: inherit; text-decoration: none; }
}
`;
