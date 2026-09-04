import { formatMessageDate } from "@/lib/format";
import type { Message } from "@/lib/types";

// Cuerpo de la lectura de un mensaje de la Casa Universal, separado de
// la página (que se ocupa de auth y datos). full_text lleva párrafos
// separados por líneas en blanco (ver scripts/import-ridvan.mjs).
export function MessageReader({ message }: { message: Message }) {
  const paragraphs = (message.full_text ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <>
      <h1 className="mb-1 font-display text-[20px] font-semibold leading-[1.25] text-dark">
        {message.title}
      </h1>
      <div className="mb-4 text-[11px] font-semibold tracking-[0.3px] text-terra">
        {formatMessageDate(message.date)}
      </div>

      {message.pdf_url && (
        <a
          href={message.pdf_url}
          target="_blank"
          rel="noopener"
          className="tap mb-4 inline-flex items-center gap-2 rounded-xl border border-terra/20 bg-terra/[0.05] px-3.5 py-2 text-[12px] font-semibold text-terra hover:bg-terra/10"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          Descargar PDF
        </a>
      )}

      {paragraphs.length > 0 ? (
        <article className="rounded-2xl bg-card p-5 shadow-card-soft">
          <div className="space-y-4">
            {paragraphs.map((p, i) => (
              <p
                key={i}
                className="font-body text-[14px] leading-[1.7] text-dark"
              >
                {p}
              </p>
            ))}
          </div>
          <div className="mt-5 border-t border-black/[0.06] pt-4 text-right font-display text-[13px] italic text-muted">
            — La Casa Universal de Justicia
          </div>
        </article>
      ) : !message.pdf_url ? (
        <div className="rounded-2xl bg-card px-4 py-10 text-center text-[13px] text-muted shadow-card-soft">
          El texto de este mensaje aún no está disponible.
        </div>
      ) : null}
    </>
  );
}
