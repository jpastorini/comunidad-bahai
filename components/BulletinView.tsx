import { formatDate, formatMessageDate } from "@/lib/format";
import type { Bulletin } from "@/lib/types";

/**
 * Render de una edición del boletín. La comparten la vista de miembro
 * (/boletin-local/[id]) y la página pública (/b/[token]), por eso no
 * asume sesión ni usa datos fuera del snapshot congelado en `content`.
 */
export function BulletinView({
  bulletin,
  localityName,
}: {
  bulletin: Bulletin;
  localityName: string;
}) {
  const c = bulletin.content;

  return (
    <article className="flex flex-col gap-4 pb-6">
      {/* Cabecera de la edición */}
      <header className="overflow-hidden rounded-2xl shadow-card-elevated ring-1 ring-gold/45"
        style={{ background: "linear-gradient(160deg, #FBF6E4, #FFFDF7)" }}
      >
        <div className="p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.5px] text-gold-dark">
            {localityName}
          </div>
          <h1 className="mt-0.5 font-display text-[22px] font-semibold leading-[1.2] text-dark">
            {bulletin.title}
          </h1>
          {bulletin.published_at && (
            <div className="mt-1 text-[11px] text-muted">
              {formatDate(bulletin.published_at)}
            </div>
          )}
          {bulletin.editorial && (
            <p className="mt-3 whitespace-pre-line font-body text-[13px] leading-[1.6] text-dark">
              {bulletin.editorial}
            </p>
          )}
        </div>
      </header>

      {/* Próximos eventos */}
      {c.events.length > 0 && (
        <section className="rounded-2xl bg-card p-4 shadow-card">
          <SectionTitle>Próximos eventos</SectionTitle>
          <div className="mt-2 grid gap-2">
            {c.events.map((e) => (
              <div key={e.id} className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 rounded-lg bg-terra/10 px-2 py-1 text-[10.5px] font-bold uppercase tracking-wide text-terra">
                  {e.dateLabel}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-dark">
                    {e.title}
                  </div>
                  {(e.time || e.location) && (
                    <div className="text-[11.5px] text-muted">
                      {[e.time, e.location].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Comunicados */}
      {c.announcements.length > 0 && (
        <section className="rounded-2xl bg-card p-4 shadow-card">
          <SectionTitle>De la Asamblea</SectionTitle>
          <div className="mt-2 grid gap-3">
            {c.announcements.map((a) => (
              <div key={a.id}>
                <div className="text-[10px] font-semibold tracking-[0.3px] text-terra">
                  {formatMessageDate(a.date)}
                </div>
                <div className="text-[13.5px] font-semibold text-dark">
                  {a.title}
                </div>
                {a.excerpt && (
                  <p className="mt-0.5 font-body text-[12px] leading-[1.5] text-muted">
                    {a.excerpt}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Fotos */}
      {c.photos.length > 0 && (
        <section>
          <div className="px-1">
            <SectionTitle>Momentos de la comunidad</SectionTitle>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2.5">
            {c.photos.map((p) => (
              <figure
                key={p.id}
                className="overflow-hidden rounded-2xl bg-card shadow-card"
              >
                <div className="aspect-square w-full bg-bg/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={p.caption ?? p.eventTitle}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <figcaption className="px-3 py-2">
                  <div className="truncate text-[11.5px] font-semibold text-dark">
                    {p.eventTitle}
                  </div>
                  {p.caption && (
                    <div className="line-clamp-2 text-[10.5px] italic text-muted">
                      “{p.caption}”
                    </div>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-[16px] font-semibold text-dark">
      {children}
    </h2>
  );
}
