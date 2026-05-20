import { notFound } from "next/navigation";
import { GoldHeader } from "@/components/GoldHeader";
import { getOptionalMember } from "@/lib/auth";
import {
  getFeast,
  getFeastLocations,
  getFeastPrayers,
} from "@/lib/data";
import { getBahaiMonth } from "@/lib/bahai-calendar";
import { SuggestionForm } from "./suggestion-form";

export const dynamic = "force-dynamic";

const WEEKDAYS = [
  "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado",
];

export default async function FeastDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [feast, locations, prayers, session] = await Promise.all([
    getFeast(params.id),
    getFeastLocations(params.id),
    getFeastPrayers(params.id),
    getOptionalMember(),
  ]);

  if (!feast) notFound();

  const month = getBahaiMonth(feast.bahai_month_index);
  const isInProgress = feast.status === "in_progress";

  return (
    <>
      <GoldHeader
        title={`Fiesta de ${feast.bahai_month_name}`}
        subtitle={month ? month.meaning : `${feast.bahai_year} BE`}
        backHref="/fiestas"
      />
      <main className="scroll-area flex-1 px-4 pb-6 pt-4">
        {/* Status banner */}
        {!isInProgress && (
          <div className="mb-4 rounded-2xl bg-gold-grad p-4 text-white">
            <div className="text-[10px] font-semibold uppercase tracking-[1.5px] text-white/70">
              Próximamente
            </div>
            <h2 className="font-display text-[18px] font-semibold">
              Esta Fiesta aún no ha iniciado
            </h2>
            <p className="mt-1 text-[12px] text-white/85">
              Cuando la Asamblea inicie la Fiesta, aquí aparecerá el programa
              completo (oraciones, profundización, informes y comunicado).
            </p>
          </div>
        )}

        {/* Lugares — siempre visibles */}
        <Section title="Lugares y horarios">
          {locations.length === 0 ? (
            <EmptyHint>
              Pronto se publicarán los lugares y horarios.
            </EmptyHint>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {locations.map((loc) => {
                const dt = new Date(loc.starts_at);
                const weekday = WEEKDAYS[dt.getDay()];
                return (
                  <li
                    key={loc.id}
                    className="rounded-2xl bg-card p-4 shadow-card-soft"
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-terra">
                      {weekday} {dt.getDate()}{" "}
                      {dt.toLocaleString("es-MX", { month: "long" })} ·{" "}
                      {dt.toLocaleString("es-MX", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </div>
                    <div className="mt-1 font-display text-[16px] font-semibold text-dark">
                      {loc.name}
                    </div>
                    {loc.address && (
                      <div className="mt-0.5 flex items-start gap-1 font-body text-[12px] text-muted">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mt-[3px] shrink-0">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span>{loc.address}</span>
                      </div>
                    )}
                    {loc.notes && (
                      <div className="mt-1.5 text-[11.5px] italic text-muted">
                        {loc.notes}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* Programa — solo visible cuando la Fiesta ya inició */}
        {isInProgress && (
          <>
            {prayers.length > 0 && (
              <Section title="Oraciones">
                <ol className="flex flex-col gap-3">
                  {prayers.map((p, i) => (
                    <li
                      key={p.id}
                      className="rounded-2xl bg-card p-4 shadow-card-soft"
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-amber">
                        Oración #{i + 1}
                      </div>
                      {p.title && (
                        <div className="mt-1 font-display text-[16px] font-semibold text-dark">
                          {p.title}
                        </div>
                      )}
                      <p className="mt-2 whitespace-pre-line font-body text-[13px] leading-[1.6] text-dark">
                        {p.body}
                      </p>
                      {p.reference && (
                        <div className="mt-2 text-[11px] italic text-muted">
                          — {p.reference}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              </Section>
            )}

            {feast.deepening_theme && (
              <Section title="Profundización">
                <div className="rounded-2xl bg-card p-4 shadow-card-soft">
                  <div className="font-display text-[16px] font-semibold text-dark">
                    {feast.deepening_theme}
                  </div>
                  {feast.deepening_content && (
                    <p className="mt-2 whitespace-pre-line font-body text-[13px] leading-[1.6] text-dark">
                      {feast.deepening_content}
                    </p>
                  )}
                </div>
              </Section>
            )}

            {(feast.international_reports ||
              feast.national_reports ||
              feast.local_reports) && (
              <Section title="Informes">
                <div className="flex flex-col gap-3">
                  <ReportBlock label="Internacionales" text={feast.international_reports} />
                  <ReportBlock label="Nacionales" text={feast.national_reports} />
                  <ReportBlock label="Locales" text={feast.local_reports} />
                </div>
              </Section>
            )}

            {(feast.treasury_income != null ||
              feast.treasury_expenses != null ||
              feast.treasury_final != null ||
              feast.treasury_pdf_url) && (
              <Section title="Tesorería del mes (Fondo Local)">
                <div className="rounded-2xl bg-card p-4 shadow-card-soft">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <TreasuryStat label="Ingresos" amount={feast.treasury_income} />
                    <TreasuryStat label="Egresos" amount={feast.treasury_expenses} />
                    <TreasuryStat
                      label="Estado final"
                      amount={feast.treasury_final}
                      strong
                    />
                  </div>
                  {feast.treasury_pdf_url && (
                    <a
                      href={feast.treasury_pdf_url}
                      target="_blank"
                      rel="noopener"
                      className="tap mt-4 inline-flex items-center gap-2 rounded-xl border border-terra/20 bg-terra/[0.05] px-3.5 py-2 text-[12px] font-semibold text-terra hover:bg-terra/10"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      Descargar informe completo
                    </a>
                  )}
                </div>
              </Section>
            )}

            {feast.assembly_communique && (
              <Section title="Comunicado de la Asamblea">
                <div className="rounded-2xl bg-amber-50 border border-amber-100/60 p-4">
                  <p className="whitespace-pre-line font-body text-[13px] leading-[1.6] text-dark">
                    {feast.assembly_communique}
                  </p>
                </div>
              </Section>
            )}

            {/* Sugerencias */}
            <Section title="Tus sugerencias a la Asamblea">
              {session ? (
                <SuggestionForm feastId={feast.id} feastName={feast.bahai_month_name} />
              ) : (
                <div className="rounded-2xl bg-card p-4 text-center shadow-card-soft">
                  <p className="text-[12.5px] text-muted">
                    Para enviar sugerencias necesitas iniciar sesión.
                  </p>
                  <a
                    href={`/login?next=/fiestas/${feast.id}`}
                    className="tap mt-3 inline-block rounded-xl bg-terra px-4 py-2 text-[13px] font-semibold text-white"
                  >
                    Iniciar sesión
                  </a>
                </div>
              )}
            </Section>
          </>
        )}
      </main>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-2.5 text-[13px] font-semibold text-dark">{title}</h2>
      {children}
    </section>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/10 bg-card/50 p-4 text-center text-[12.5px] text-muted">
      {children}
    </div>
  );
}

function ReportBlock({ label, text }: { label: string; text: string | null }) {
  if (!text) return null;
  return (
    <div className="rounded-2xl bg-card p-4 shadow-card-soft">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-terra">
        {label}
      </div>
      <p className="mt-1.5 whitespace-pre-line font-body text-[12.5px] leading-[1.55] text-dark">
        {text}
      </p>
    </div>
  );
}

function TreasuryStat({
  label,
  amount,
  strong = false,
}: {
  label: string;
  amount: number | null | undefined;
  strong?: boolean;
}) {
  const fmt = (n: number) =>
    n.toLocaleString("es-MX", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  return (
    <div>
      <div
        className={`font-display font-bold ${
          strong ? "text-[22px] text-terra" : "text-[18px] text-dark"
        }`}
      >
        {amount != null ? fmt(amount) : "—"}
      </div>
      <div className="mt-0.5 text-[10.5px] uppercase tracking-wide text-muted">
        {label}
      </div>
    </div>
  );
}
