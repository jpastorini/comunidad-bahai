import { GoldHeader } from "@/components/GoldHeader";
import { IconSearch } from "@/components/Icons";
import { AEL_SEGMENTS, SegmentedNav } from "@/components/SegmentedNav";
import { requireMember } from "@/lib/auth";
import { getLocalAnnouncements } from "@/lib/data";
import { formatMessageDate } from "@/lib/format";
import { markComunicadosSeenAction } from "./actions";

export const revalidate = 60;

export default async function ComunicadosPage() {
  const [session, announcements] = await Promise.all([
    requireMember("/comunicados"),
    getLocalAnnouncements(),
  ]);

  // Apaga el punto de aviso de AEL — el miembro acaba de abrir Comunicados.
  await markComunicadosSeenAction(session.user.id);

  return (
    <>
      <GoldHeader title="Asamblea Local" subtitle={session.locality.name} backHref="/" />
      <SegmentedNav items={AEL_SEGMENTS} />
      <div className="shrink-0 px-4 pb-1.5 pt-0.5">
        <div
          className="flex items-center gap-2 rounded-xl px-3.5 py-2.5"
          style={{ background: "#C4A23508" }}
        >
          <IconSearch size={15} className="text-muted" />
          <span className="font-body text-[13px] text-muted">
            Buscar comunicado...
          </span>
        </div>
      </div>
      <main className="scroll-area flex-1 px-4 pb-4 pt-1">
        {announcements.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-muted">
            Aún no hay comunicados publicados.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {announcements.map((m) => (
              <article
                key={m.id}
                className="overflow-hidden rounded-2xl bg-card shadow-card"
              >
                {m.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.image_url}
                    alt={m.title}
                    className="h-44 w-full object-cover"
                  />
                )}
                <div className="p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-[10px] font-semibold tracking-[0.3px] text-terra">
                      {formatMessageDate(m.date)}
                    </span>
                    {m.is_new && (
                      <span className="rounded bg-terra px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
                        Nuevo
                      </span>
                    )}
                  </div>
                  <h2 className="font-display text-[19px] font-semibold leading-[1.25] text-dark">
                    {m.title}
                  </h2>
                  {m.subject && (
                    <p className="mt-0.5 text-[12px] font-medium uppercase tracking-wide text-amber">
                      {m.subject}
                    </p>
                  )}
                  <p className="mt-2 whitespace-pre-line font-body text-[12.5px] leading-[1.55] text-dark">
                    {m.full_text ?? m.excerpt}
                  </p>
                  {m.pdf_url && (
                    <a
                      href={m.pdf_url}
                      target="_blank"
                      rel="noopener"
                      className="tap mt-3 inline-flex items-center gap-2 rounded-xl border border-terra/20 bg-terra/[0.05] px-3.5 py-2 text-[12px] font-semibold text-terra hover:bg-terra/10"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      Descargar PDF adjunto
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
