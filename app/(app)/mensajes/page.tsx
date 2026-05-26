import { GoldHeader } from "@/components/GoldHeader";
import { IconSearch } from "@/components/Icons";
import { BIBLIOTECA_SEGMENTS, SegmentedNav } from "@/components/SegmentedNav";
import { requireMember } from "@/lib/auth";
import { getMessages } from "@/lib/data";
import { formatMessageDate } from "@/lib/format";

export const revalidate = 60;

export default async function MensajesPage() {
  const [session, messages] = await Promise.all([
    requireMember("/mensajes"),
    getMessages(),
  ]);

  return (
    <>
      <GoldHeader title="Biblioteca" subtitle={session.locality.name} backHref="/" />
      <SegmentedNav items={BIBLIOTECA_SEGMENTS} />
      <div className="shrink-0 px-4 pb-1.5 pt-0.5">
        <div
          className="flex items-center gap-2 rounded-xl px-3.5 py-2.5"
          style={{ background: "#C4A23508" }}
        >
          <IconSearch size={15} className="text-muted" />
          <span className="font-body text-[13px] text-muted">
            Buscar mensaje...
          </span>
        </div>
      </div>
      <main className="scroll-area flex-1 px-4 pb-4 pt-1">
        {messages.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-muted">
            Aún no hay mensajes publicados.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((m) => (
              <article
                key={m.id}
                className="rounded-2xl bg-card p-4 shadow-card-soft"
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-[10px] font-semibold tracking-[0.3px] text-terra">
                    {formatMessageDate(m.date)}
                  </span>
                  {m.is_new && (
                    <span className="rounded bg-terra px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
                      Nuevo
                    </span>
                  )}
                </div>
                <h2 className="mb-3 font-display text-[17px] font-semibold leading-[1.3] text-dark">
                  {m.title}
                </h2>
                {m.pdf_url ? (
                  <a
                    href={m.pdf_url}
                    target="_blank"
                    rel="noopener"
                    className="tap inline-flex items-center gap-2 rounded-xl border border-terra/20 bg-terra/[0.05] px-3.5 py-2 text-[12px] font-semibold text-terra hover:bg-terra/10"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    Descargar PDF
                  </a>
                ) : (
                  <span className="text-[11px] italic text-muted">
                    PDF aún no disponible
                  </span>
                )}
              </article>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
