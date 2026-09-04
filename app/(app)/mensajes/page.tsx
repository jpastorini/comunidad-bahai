import Link from "next/link";
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
              <Link
                key={m.id}
                href={`/mensajes/${m.id}`}
                className="tap flex items-center gap-3 rounded-2xl bg-card p-4 shadow-card-soft"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-[10px] font-semibold tracking-[0.3px] text-terra">
                      {formatMessageDate(m.date)}
                    </span>
                    {m.is_new && (
                      <span className="rounded bg-terra px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
                        Nuevo
                      </span>
                    )}
                    {m.pdf_url && (
                      <span className="rounded bg-gold/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-gold-dark">
                        PDF
                      </span>
                    )}
                  </div>
                  <h2 className="font-display text-[17px] font-semibold leading-[1.3] text-dark">
                    {m.title}
                  </h2>
                </div>
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0 text-muted"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
