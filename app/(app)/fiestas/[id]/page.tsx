import { notFound, redirect } from "next/navigation";
import { EventGallery } from "@/components/gallery/EventGallery";
import { GoldHeader } from "@/components/GoldHeader";
import { getOptionalMember } from "@/lib/auth";
import {
  getFeast,
  getFeastLocations,
  getFeastNews,
  getFeastPrayers,
} from "@/lib/data";
import {
  celebrationDateFor,
  getBahaiMonth,
} from "@/lib/bahai-calendar";
import { NEWS_SCOPE_LABELS, NEWS_SCOPE_ORDER } from "@/lib/feast-program";
import type { FeastNewsItem } from "@/lib/types";
import { SuggestionForm } from "./suggestion-form";

export const revalidate = 60;

const WEEKDAYS = [
  "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado",
];

export default async function FeastDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [feast, locations, prayers, news, session] = await Promise.all([
    getFeast(params.id),
    getFeastLocations(params.id),
    getFeastPrayers(params.id),
    getFeastNews(params.id),
    getOptionalMember(),
  ]);

  // Un Amigo/a de la Fe no tiene Fiesta (047): la RLS ya devolvió null,
  // pero el destino correcto es el Inicio, no un 404.
  if (session && !session.profile.is_bahai) redirect("/");
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
              Los lugares y horarios de celebración aparecen abajo. El programa
              interno (oraciones, profundización, informes) se hace visible
              cuando la Asamblea inicia la Fiesta.
            </p>
          </div>
        )}

        {/* Lugares — siempre visibles */}
        <Section title="Lugares y horarios">
          {locations.length === 0 ? (
            <FallbackCelebration
              gregorianDate={feast.gregorian_date}
              monthName={feast.bahai_month_name}
            />
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
                      {weekday} {String(dt.getDate()).padStart(2, "0")}/
                      {String(dt.getMonth() + 1).padStart(2, "0")}/
                      {dt.getFullYear()} ·{" "}
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
            <Section title="Programa de la Fiesta">
              <div className="grid grid-cols-2 gap-2.5">
                <a
                  href={`/programa/${feast.id}`}
                  className="tap flex flex-col items-center gap-1.5 rounded-2xl bg-terra-grad p-4 text-center text-white shadow-card-soft"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="13" rx="2" />
                    <path d="M8 21h8M12 17v4" />
                    <path d="M10 8.5v4l3.5-2z" fill="currentColor" stroke="none" />
                  </svg>
                  <span className="text-[13px] font-semibold">Ver programa</span>
                  <span className="text-[10.5px] text-white/75">Diapositivas</span>
                </a>
                <a
                  href={`/programa/${feast.id}/pdf`}
                  target="_blank"
                  rel="noopener"
                  className="tap flex flex-col items-center gap-1.5 rounded-2xl bg-card p-4 text-center text-dark shadow-card-soft"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-terra">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <path d="M12 18v-6M9.5 15.5 12 18l2.5-2.5" />
                  </svg>
                  <span className="text-[13px] font-semibold">Descargar folleto</span>
                  <span className="text-[10.5px] text-muted">PDF para seguir la lectura</span>
                </a>
              </div>
            </Section>

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

            {news.length > 0 && (
              <Section title="Noticias">
                <div className="flex flex-col gap-3">
                  {NEWS_SCOPE_ORDER.map((scope) => {
                    const items = news.filter((n) => n.scope === scope);
                    if (items.length === 0) return null;
                    return (
                      <NewsBlock
                        key={scope}
                        label={NEWS_SCOPE_LABELS[scope]}
                        items={items}
                      />
                    );
                  })}
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

        {/* Galería de fotos — disponible siempre (incluso antes de iniciar). */}
        <EventGallery eventType="feast" eventId={feast.id} />
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

/**
 * Fallback cuando la Asamblea aún no cargó casas anfitrionas:
 * mostramos la fecha oficial de celebración como referencia para
 * que el miembro al menos sepa el día en que sucede.
 */
function FallbackCelebration({
  gregorianDate,
  monthName,
}: {
  gregorianDate: string | null;
  monthName: string;
}) {
  if (!gregorianDate) {
    return (
      <EmptyHint>
        La Asamblea aún no cargó lugares ni horarios para esta Fiesta.
      </EmptyHint>
    );
  }
  const celebrationIso = celebrationDateFor(gregorianDate);
  const cd = new Date(`${celebrationIso}T12:00:00Z`);
  const od = new Date(`${gregorianDate}T12:00:00Z`);
  const fmt = (d: Date) =>
    `${WEEKDAYS[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;

  return (
    <div className="rounded-2xl border border-dashed border-terra/30 bg-terra/[0.04] p-4">
      <div className="text-[10.5px] uppercase tracking-wide text-muted">
        Fecha oficial del Mes de {monthName}
      </div>
      <div className="mt-0.5 text-[13px] text-dark">{fmt(od)}</div>

      <div className="mt-2.5 text-[10.5px] uppercase tracking-wide text-terra">
        Conmemoración
      </div>
      <div className="text-[13.5px] font-semibold text-terra">
        {fmt(cd)} al atardecer
      </div>

      <p className="mt-3 text-[11.5px] italic text-muted">
        La Asamblea aún no cargó las casas anfitrionas ni los horarios
        específicos. Pronto verás aquí los detalles de cada lugar.
      </p>
    </div>
  );
}

function NewsBlock({ label, items }: { label: string; items: FeastNewsItem[] }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-card-soft">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-terra">
        {label}
      </div>
      <ul className="mt-2 flex flex-col divide-y divide-black/[0.05]">
        {items.map((n) => (
          <li key={n.id} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              {n.date_label && (
                <div className="text-[10px] font-semibold uppercase tracking-wide text-gold-dark">
                  {n.date_label}
                </div>
              )}
              <div className="font-display text-[15px] font-semibold leading-snug text-dark">
                {n.title}
              </div>
              {n.body && (
                <p className="mt-1 whitespace-pre-line font-body text-[12.5px] leading-[1.55] text-dark/80">
                  {n.body}
                </p>
              )}
            </div>
            {n.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={n.image_url}
                alt=""
                className="h-16 w-16 shrink-0 rounded-lg object-cover"
              />
            )}
          </li>
        ))}
      </ul>
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
