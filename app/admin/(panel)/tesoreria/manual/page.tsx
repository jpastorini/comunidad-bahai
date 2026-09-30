import Link from "next/link";
import { PrintButton } from "@/components/admin/PrintButton";
import { Card, PageHeader } from "@/components/admin/ui";
import {
  FigureClosedMonth,
  FigureMoneyFlow,
  FigureMonthCycle,
  FigureReportStates,
} from "@/components/treasury/ManualFigures";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createSupabaseServer } from "@/lib/supabase/server";
import { HANDOVER_STEPS, getTreasuryGuide } from "@/lib/treasury-guide";
import { FIELD_SCREEN, SCREEN_INDEX, TREASURY_HELP } from "@/lib/treasury-help";
import { todayISO } from "@/lib/treasury-ledger";

export const dynamic = "force-dynamic";

/**
 * El manual del tesorero: los mismos textos de ayuda que están repartidos
 * por el panel (lib/treasury-help.ts), juntos y en el orden del menú, con
 * cuatro dibujos de lo que en prosa cuesta armar (el ciclo, cómo se
 * mueve la plata, la rendición, el mes cerrado), el glosario de cinco
 * palabras, quién ve qué, y los pasos del traspaso. Para leer en
 * pantalla o imprimir el primer día. No se escribe dos veces: si un "?"
 * cambia, cambia acá.
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
  const sections = Array.from(new Set(SCREEN_INDEX.map((s) => s.section)));

  return (
    <div className="cb-manual">
      <style>{MANUAL_CSS}</style>
      <PageHeader
        eyebrow="Tesorería"
        help={TREASURY_HELP.screens.manual}
        title="Manual del tesorero"
        description={`Cómo se lleva la Tesorería de ${session.locality.name} en la app, contado para quien recién agarra el cargo. Versión del ${formatDate(todayISO())}.`}
        actions={<PrintButton />}
      />

      {/* Índice */}
      <nav className="cb-noprint mb-6 rounded-2xl border border-gold/25 bg-gold/[0.06] p-4">
        <div className="text-[10px] font-semibold uppercase tracking-[2px] text-gold-dark">En este manual</div>
        <ol className="mt-2 grid gap-1 text-[13px] sm:grid-cols-2">
          {TOC.map((t, i) => (
            <li key={t.id}>
              <a href={`#${t.id}`} className="font-semibold text-terra hover:underline">
                {i + 1}. {t.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* 1 · Bienvenida */}
      <Section id="bienvenida" n={1} title="Antes de empezar">
        <p className="text-[14px] leading-relaxed text-dark/85">
          La Tesorería en la app es un <strong>libro</strong>: cada aporte y cada gasto es una línea, y todo lo demás
          —saldos, recibos, informes, el balance anual— se calcula solo a partir de esas líneas. Tu trabajo es que las
          líneas estén completas y a tiempo; la app se encarga de que no se te olvide nada y de que un auditor encuentre
          todo en orden.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Tip title="Empezá por la Guía del mes">
            Es la lista de lo que hay que hacer, tildada según lo que ya está hecho. Si dudás, abrila.
          </Tip>
          <Tip title="Los «?» son este manual">
            Cada pantalla y cada campo difícil tiene un «?» con el mismo texto que leés acá, en el lugar.
          </Tip>
          <Tip title="Cuando algo no cierra, auditá">
            La Auditoría dice qué está mal, contra qué norma, y cómo se arregla en la app. No cambia nada.
          </Tip>
        </div>
        <p className="mt-4 text-[13px] text-dark/80">
          Instalá la app en el celular y activá los avisos: los recordatorios del cierre (el día 5), las rendiciones
          de las cajas chicas y los mensajes de la gente llegan por ahí.
        </p>
      </Section>

      {/* 2 · Glosario */}
      <Section id="glosario" n={2} title="Cinco palabras">
        <dl className="grid gap-3 sm:grid-cols-2">
          {GLOSSARY.map((g) => (
            <div key={g.term} className="rounded-xl bg-bg/60 px-4 py-3">
              <dt className="font-display text-[16px] font-semibold text-dark">{g.term}</dt>
              <dd className="mt-0.5 text-[13px] text-dark/80">{g.text}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* 3 · Cómo se mueve la plata */}
      <Section id="plata" n={3} title="Cómo se mueve la plata">
        <p className="text-[14px] leading-relaxed text-dark/85">
          Hay dos maneras de que entre un aporte y dos de que salga un gasto. Los giros entran a la{" "}
          <strong>cuenta</strong>; el efectivo de la Fiesta entra a la <strong>caja chica del tesorero</strong> y desde
          ahí se pagan los gastos chicos, cada uno con su comprobante. Las cajas con responsable (Secretaría, un
          coordinador) se reponen desde la cuenta con lo que rinden.
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-dark/85">
          <strong>Un consejo, no una regla:</strong> lo que entra y sale en efectivo no lo verifica ningún extracto, solo
          tu arqueo. Cuando puedas, depositá el efectivo en Prex y pagá desde la cuenta: cada aporte queda verificado por
          el banco y la conciliación cierra sola. La auditoría te lo recuerda como hallazgo leve; si preferís seguir con
          la caja, despachalo con ese motivo.
        </p>
        <FigureMoneyFlow />
      </Section>

      {/* 4 · El ciclo del mes */}
      <Section id="ciclo" n={4} title="El ciclo del mes">
        <p className="text-[14px] leading-relaxed text-dark/85">
          Todo el trabajo se ordena en un ciclo que se repite cada mes. En la app (Guía del mes) cada paso aparece
          tildado según lo que ya está hecho.
        </p>
        <FigureMonthCycle />
        <ol className="mt-3 flex flex-col gap-3">
          {guide.steps.map((s) => (
            <li key={s.key} className="cb-block flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gold/15 font-display text-[15px] font-bold text-gold-dark">
                {s.order}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-semibold text-dark">{s.title}</h3>
                <p className="mt-0.5 text-[13px] text-dark/80">{s.why}</p>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[13px] text-dark/85">
                  {s.how.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
                <p className="mt-1 text-[11.5px] text-muted">
                  En la app: <Link href={s.href} className="font-semibold text-terra">{s.cta}</Link>
                </p>
              </div>
            </li>
          ))}
        </ol>
        <FigureClosedMonth />
      </Section>

      {/* 5 · Cajas chicas */}
      <Section id="cajas" n={5} title="Las cajas chicas">
        <p className="text-[14px] leading-relaxed text-dark/85">
          El efectivo que manejan la Secretaría o un coordinador tiene un <strong>fondo fijo</strong> y una persona{" "}
          <strong>responsable</strong>, que carga sus gastos con la foto del comprobante desde su celular y rinde cuando
          corresponde. Vos revisás y aprobás; al aprobar, los gastos entran al libro y la caja se repone.
        </p>
        <FigureReportStates />
        <p className="text-[13px] text-dark/80">
          El <strong>arqueo</strong> es contar la plata y compararla con lo que dice el libro, con fecha. Conviene uno
          por mes, en cada caja, también la tuya. Si no cuadra, el ajuste va al libro con su motivo.
        </p>
      </Section>

      {/* 6 · Quién ve qué */}
      <Section id="quien" n={6} title="Quién ve qué">
        <div className="grid gap-3 sm:grid-cols-3">
          {WHO_SEES.map((w) => (
            <div key={w.who} className="rounded-xl border border-black/[0.06] p-4">
              <h3 className="font-display text-[16px] font-semibold text-dark">{w.who}</h3>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[12.5px] text-dark/85">
                {w.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12.5px] text-muted">
          Los nombres de quienes aportan los ve solo quien tiene el permiso de Tesorería. Ningún informe ni la
          publicación del estado del Fondo los lleva.
        </p>
      </Section>

      {/* 7 · Visitas y enseñanza */}
      <Section id="ensenanza" n={7} title="Visitas y enseñanza sobre el Fondo">
        <p className="text-[14px] leading-relaxed text-dark/85">
          Llevar el libro es la mitad del cargo. La otra mitad es que la comunidad entienda el Fondo: que contribuir
          es un privilegio espiritual y un acto voluntario y confidencial, que nadie pide a nadie una cifra, y que la
          Asamblea rinde cuentas de cada peso. El tesorero es quien lo enseña, con paciencia y sin presión.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Tip title="Visitas">
            Visitá a las familias, en especial a quien es nuevo en la comunidad: para presentarte, contar cómo se
            aporta y escuchar. Nunca para pedir. Si alguien quiere que se le recuerde, ofrecele el compromiso mensual,
            que se prende desde su perfil y le llega el día 10.
          </Tip>
          <Tip title="Enseñanza">
            Al menos una vez por ejercicio, una profundización sobre el Fondo en la Fiesta o en una reunión: qué es,
            para qué sirve, qué dicen los Escritos. Las citas sobre sacrificio, desprendimiento y generosidad están en
            la Biblioteca de la app (Lectura de hoy, por tema) y en el Buscador de pasajes.
          </Tip>
          <Tip title="Rendir cuentas">
            La confianza se construye mostrando: el estado del Fondo compartido cada mes, el informe en la Fiesta, el
            balance anual a disposición desde el 17 de abril, y la carta semestral. Quien ve adónde va su aporte, vuelve
            a aportar.
          </Tip>
          <Tip title="Agradecer">
            Cada aporte merece un gracias, y el recibo es la ocasión: al registrarlo le llega el aviso a la persona con
            su recibo. Compromisos te dice cada mes a quién agradecer; el chat de Tesorería es el lugar para hacerlo
            en privado.
          </Tip>
        </div>
      </Section>

      {/* 8 · Agenda anual */}
      <Section id="agenda" n={8} title="La agenda del año">
        <p className="mb-3 text-[14px] leading-relaxed text-dark/85">
          Lo que se repite, con su fecha. Lo mensual lo tilda la Guía; lo demás conviene anotarlo en el calendario
          de la Asamblea.
        </p>
        <ol className="flex flex-col gap-2">
          {AGENDA.map((a) => (
            <li key={a.when} className="cb-block rounded-xl border border-black/[0.06] p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[2px] text-gold-dark">{a.when}</div>
              <h3 className="mt-0.5 text-[15px] font-semibold text-dark">{a.what}</h3>
              <p className="mt-1 text-[12.5px] text-dark/80">{a.how}</p>
              {a.href && (
                <p className="mt-1 text-[11.5px] text-muted">
                  En la app: <Link href={a.href} className="font-semibold text-terra">{a.href.replace("/admin/", "")}</Link>
                </p>
              )}
            </li>
          ))}
        </ol>
      </Section>

      {/* 9 · Las pantallas */}
      <Section id="pantallas" n={9} title="Las pantallas, una por una">
        <p className="mb-3 text-[13px] text-muted">En el orden del menú. Debajo de cada una, los campos que tienen ayuda.</p>
        {sections.map((sec) => (
          <div key={sec} className="mb-5">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[2px] text-gold-dark">{sec}</div>
            <div className="flex flex-col gap-3">
              {SCREEN_INDEX.filter((s) => s.section === sec).map((sc) => {
                const fields = fieldsByScreen.get(sc.key) ?? [];
                return (
                  <Card key={sc.key} className="cb-block">
                    <h3 className="font-display text-[17px] font-semibold text-dark">{sc.label}</h3>
                    <p className="mt-1 text-[13px] text-dark/85">{TREASURY_HELP.screens[sc.key]}</p>
                    {fields.length > 0 && (
                      <dl className="mt-3 grid gap-x-6 gap-y-2 border-t border-black/[0.06] pt-3 text-[12.5px] sm:grid-cols-[160px_1fr]">
                        {fields.map((f) => (
                          <FieldRow key={f.key} label={FIELD_LABEL[f.key] ?? f.key} text={f.text} />
                        ))}
                      </dl>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </Section>

      {/* 10 · Traspaso */}
      <Section id="traspaso" n={10} title="Cuando cambie el tesorero">
        <ol className="flex flex-col gap-2">
          {HANDOVER_STEPS.map((step, i) => (
            <li key={step.title} className="cb-block flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gold/15 font-display text-[15px] font-bold text-gold-dark">
                {i + 1}
              </span>
              <div>
                <h3 className="text-[15px] font-semibold text-dark">{step.title}</h3>
                <p className="mt-0.5 text-[12.5px] text-dark/80">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[12.5px] text-muted">
          El acta de traspaso (Tesorería → Traspaso) imprime la foto del libro del día del cambio para que la firmen quien
          entrega y quien recibe, con un testigo.
        </p>
      </Section>
    </div>
  );
}

// ─── Piezas ──────────────────────────────────────────────────────

const TOC = [
  { id: "bienvenida", label: "Antes de empezar" },
  { id: "glosario", label: "Cinco palabras" },
  { id: "plata", label: "Cómo se mueve la plata" },
  { id: "ciclo", label: "El ciclo del mes" },
  { id: "cajas", label: "Las cajas chicas" },
  { id: "quien", label: "Quién ve qué" },
  { id: "ensenanza", label: "Visitas y enseñanza sobre el Fondo" },
  { id: "agenda", label: "La agenda del año" },
  { id: "pantallas", label: "Las pantallas, una por una" },
  { id: "traspaso", label: "Cuando cambie el tesorero" },
];

const AGENDA: Array<{ when: string; what: string; how: string; href?: string }> = [
  {
    when: "Cada mes",
    what: "El ciclo: cargar, conciliar, rendir y arquear, auditar y cerrar, compartir, compromisos.",
    how: "La Guía del mes lo tilda. El día 5 llega el aviso si el mes anterior sigue abierto; el 10 sale solo el recordatorio a quien declaró un compromiso.",
    href: "/admin/tesoreria/guia",
  },
  {
    when: "Cada Fiesta de 19 Días",
    what: "El estado del Fondo en la diapositiva de Tesorería, y el informe del mes si lo hay.",
    how: "Calcular y compartir desde Publicar antes de la Fiesta; la Fiesta se queda con la foto vigente al iniciarla.",
    href: "/admin/tesoreria/publicar",
  },
  {
    when: "Marzo y octubre",
    what: "La carta semestral a la comunidad: el estado del Fondo, las necesidades del ejercicio, y el agradecimiento por las contribuciones y los sacrificios.",
    how: "Se escribe como comunicado (Comunicación → Comunicados), con las cifras de la última publicación y, si sirve, una cita de los Escritos sobre la generosidad. El tablero lo recuerda esos dos meses.",
    href: "/admin/comunicados/nuevo",
  },
  {
    when: "17 de abril",
    what: "Cierre del ejercicio estatutario: la Memoria y Balance anual, a disposición de la comunidad desde ese día (art. XI de los estatutos).",
    how: "En Informes, nuevo informe «Memoria y Balance» con el preset 18 abr → 17 abr; cotización de cierre, memoria y firmas; emitir. La Asamblea lo aprueba en reunión.",
    href: "/admin/tesoreria/informes",
  },
  {
    when: "Riḍván (21 de abril)",
    what: "Empieza el ejercicio contable y se elige la Asamblea.",
    how: "Cargar la composición nueva en Datos de la Asamblea (el Tesorero/a declarado firma los recibos), crear el presupuesto del ejercicio y revisar las metas.",
    href: "/admin/tesoreria/presupuesto",
  },
  {
    when: "Al cerrar el ejercicio, y cuando lo pida la AEN",
    what: "El legajo para el auditor y, si cambia el tesorero, el acta de traspaso.",
    how: "Tesorería → Legajo para el auditor arma el ZIP; Traspaso imprime el acta para firmar.",
    href: "/admin/tesoreria/legajo",
  },
];

const GLOSSARY = [
  { term: "Libro", text: "La lista de todos los movimientos. Es la fuente de verdad: el saldo, el recibo y los informes salen de ahí." },
  { term: "Cuenta", text: "Dónde está la plata: Prex, BROU, una caja chica. Cada cuenta puede tener pesos y dólares; nunca se suman entre sí." },
  { term: "Fondo", text: "De quién es la plata: Local, Enseñanza, Ayuda Social… Es un «color» que acompaña al movimiento, no un lugar." },
  { term: "Rubro", text: "En qué se usa o de dónde viene: la subcategoría del movimiento. Agrupa los informes y sugiere el fondo." },
  { term: "Recibo", text: "El comprobante de cada aporte, con número correlativo que pone la app. Un recibo emitido no se edita: se anula." },
];

const WHO_SEES = [
  {
    who: "La comunidad",
    items: [
      "El estado del Fondo que compartiste desde Publicar",
      "Los informes emitidos y el balance anual",
      "Cada persona, sus propios aportes con su recibo",
      "El responsable de una caja chica, su caja",
    ],
  },
  {
    who: "La Asamblea",
    items: [
      "La hoja interna del informe, para aprobar en reunión",
      "El registro de informes emitidos",
      "Datos de la Asamblea y la composición",
    ],
  },
  {
    who: "El tesorero",
    items: [
      "El libro completo, con nombres",
      "Contribuyentes, cierres, conciliación, auditoría",
      "Las cajas chicas y sus rendiciones",
      "El legajo para el auditor",
    ],
  },
];

function Section({ id, n, title, children }: { id: string; n: number; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="cb-section mb-8 scroll-mt-4">
      <div className="mb-3 flex items-baseline gap-3">
        <span className="font-display text-[26px] font-bold text-gold-dark/70">{n}</span>
        <h2 className="font-display text-[22px] font-semibold text-dark">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Tip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gold/25 bg-gold/[0.06] px-4 py-3">
      <div className="text-[13px] font-semibold text-dark">{title}</div>
      <div className="mt-0.5 text-[12.5px] text-dark/80">{children}</div>
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
  .cb-manual .cb-block, .cb-manual figure { break-inside: avoid; }
  .cb-manual .cb-section { break-before: auto; }
  .cb-manual a { color: inherit; text-decoration: none; }
  .cb-manual svg { max-height: 70mm; }
}
`;
