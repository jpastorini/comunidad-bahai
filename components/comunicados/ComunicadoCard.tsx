"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  confirmMessageReadAction,
  hideMessageAction,
  markMessageSeenAction,
  unhideMessageAction,
} from "@/app/(app)/comunicados/actions";
import { formatDate, formatMessageDate } from "@/lib/format";
import type { Message, MessagePoll, MessageRead, MyPollVote, PollResults } from "@/lib/types";
import { PollBlock } from "./PollBlock";

type Props = {
  message: Message;
  read: MessageRead | null;
  /** "Nuevo" ya resuelto en el servidor (por persona, ver isNewForReader). */
  isNew: boolean;
  featured: boolean;
  /** Encuesta del comunicado (051), si tiene, con lo que esta persona ya votó y los totales. */
  poll?: MessagePoll | null;
  myVote?: MyPollVote | null;
  pollResults?: PollResults | null;
};

/** Cuánto tiene que quedarse la tarjeta a la vista para contar como vista. */
const DWELL_MS = 1500;

/**
 * Tarjeta de un comunicado, con la lectura por persona (048):
 *
 * · "Visto" automático. Un IntersectionObserver espera que al menos la
 *   mitad de la tarjeta —o la mitad de la pantalla, si la tarjeta es más
 *   alta que el viewport— esté a la vista durante DWELL_MS seguidos. Un
 *   scroll rápido por encima no cuenta; detenerse a leer sí. Se dispara
 *   una sola vez y no re-renderiza la lista.
 * · "Enterado/a" explícito, solo si el comunicado lo pide. Optimista: el
 *   botón cambia al toque y vuelve atrás si el servidor falla.
 */
export function ComunicadoCard({
  message: m,
  read,
  isNew,
  featured,
  poll = null,
  myVote = null,
  pollResults = null,
}: Props) {
  // 057 · El comunicado de la Asamblea Nacional es la ÚNICA tarjeta
  // oscura de una lista blanca: se distingue desde el otro lado de la
  // pantalla, sin leer una palabra, y en el mismo registro noche y
  // dorado del deck de la Fiesta. Se descartó el rojo (es el color de
  // lo urgente) y el verde (ya significa "en orden" en toda la app,
  // incluida la línea "Enterado/a" de esta misma tarjeta).
  const national = m.source === "asamblea_nacional";

  // Si ya está oculto, esta tarjeta se está viendo desde "ver ocultos"
  // y lo que corresponde ofrecer es devolverla a la lista.
  const isHidden = Boolean(read?.hidden_at);

  const ref = useRef<HTMLElement | null>(null);
  const seenRef = useRef<boolean>(Boolean(read));
  const [hiding, setHiding] = useState(false);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(
    read?.confirmed_at ?? null
  );
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (seenRef.current) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const clear = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    const observer = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e) return;
        const needed = Math.min(
          e.boundingClientRect.height * 0.5,
          window.innerHeight * 0.5
        );
        const visibleEnough = e.isIntersecting && e.intersectionRect.height >= needed;
        if (!visibleEnough) {
          clear();
          return;
        }
        if (timer) return;
        timer = setTimeout(() => {
          if (seenRef.current) return;
          seenRef.current = true;
          observer.disconnect();
          void markMessageSeenAction(m.id);
        }, DWELL_MS);
      },
      // Varios umbrales para que el callback corra mientras entra y sale.
      { threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    observer.observe(el);
    return () => {
      clear();
      observer.disconnect();
    };
  }, [m.id]);

  function confirm() {
    setFailed(false);
    const optimistic = new Date().toISOString();
    setConfirmedAt(optimistic);
    startTransition(async () => {
      const res = await confirmMessageReadAction(m.id);
      if (res.ok) {
        seenRef.current = true;
        setConfirmedAt(res.confirmedAt);
      } else {
        setConfirmedAt(null);
        setFailed(true);
      }
    });
  }

  function toggleHidden() {
    // Se esconde al toque y la lista se reordena cuando el servidor
    // revalida; si falla, vuelve a aparecer.
    setHiding(true);
    startTransition(async () => {
      const ok = isHidden
        ? await unhideMessageAction(m.id)
        : await hideMessageAction(m.id);
      if (!ok) setHiding(false);
    });
  }

  return (
    <article
      ref={ref}
      id={`c-${m.id}`}
      className={
        national
          ? "overflow-hidden rounded-2xl bg-dark shadow-card-elevated"
          : featured
            ? "overflow-hidden rounded-2xl shadow-card-elevated ring-1 ring-gold/45"
            : "overflow-hidden rounded-2xl bg-card shadow-card"
      }
      style={
        !national && featured
          ? { background: "linear-gradient(160deg, #FBF6E4, #FFFDF7)" }
          : undefined
      }
      hidden={hiding}
    >
      {m.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.image_url} alt={m.title} className="h-44 w-full object-cover" />
      )}
      <div className="p-4">
        <div className="mb-2 flex items-center gap-2">
          {national && (
            <span className="rounded bg-gold px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-dark">
              Nacional
            </span>
          )}
          <span
            className={`text-[10px] font-semibold tracking-[0.3px] ${
              national ? "text-gold-light" : "text-terra"
            }`}
          >
            {formatMessageDate(m.date)}
          </span>
          {isNew && (
            <span
              className={`rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide ${
                national ? "bg-white/15 text-gold-light" : "bg-terra text-white"
              }`}
            >
              Nuevo
            </span>
          )}
        </div>
        <h2
          className={`font-display text-[19px] font-semibold leading-[1.25] ${
            national ? "text-white" : "text-dark"
          }`}
        >
          {m.title}
        </h2>
        {m.subject && (
          <p
            className={`mt-0.5 text-[12px] font-medium uppercase tracking-wide ${
              national ? "text-gold-light/90" : "text-amber"
            }`}
          >
            {m.subject}
          </p>
        )}
        <p
          className={`mt-2 whitespace-pre-line font-body text-[12.5px] leading-[1.55] ${
            national ? "text-white/[0.72]" : "text-dark"
          }`}
        >
          {m.full_text ?? m.excerpt}
        </p>
        {m.pdf_url && (
          <a
            href={m.pdf_url}
            target="_blank"
            rel="noopener"
            className={`tap mt-3 inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[12px] font-semibold ${
              national
                ? "border-gold/35 bg-gold/10 text-gold-light hover:bg-gold/20"
                : "border-terra/20 bg-terra/[0.05] text-terra hover:bg-terra/10"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Descargar PDF adjunto
          </a>
        )}

        {poll && (
          <PollBlock
            poll={poll}
            myVote={myVote}
            results={pollResults}
            hideQuestion={poll.question.trim() === m.title.trim()}
          />
        )}

        {m.ask_confirmation && (
          <div
            className={`mt-4 border-t pt-3 ${
              national ? "border-white/10" : "border-black/[0.06]"
            }`}
          >
            {confirmedAt ? (
              <p
                className={`flex items-center gap-2 text-[12px] font-medium ${
                  national ? "text-gold-light" : "text-green"
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Confirmaste que leíste este comunicado el {formatDate(confirmedAt)}.
              </p>
            ) : (
              <>
                <p
                  className={`mb-2 text-[11.5px] ${
                    national ? "text-white/60" : "text-muted"
                  }`}
                >
                  {national
                    ? "La Asamblea Nacional pide confirmar la lectura de este comunicado."
                    : "La Asamblea pide confirmar la lectura de este comunicado."}
                </p>
                <button
                  type="button"
                  onClick={confirm}
                  disabled={pending}
                  className={`tap inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold shadow-sm disabled:opacity-60 ${
                    national
                      ? "bg-gold text-dark hover:bg-gold-light"
                      : "bg-terra text-white hover:bg-terra/90"
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Enterado/a
                </button>
                {failed && (
                  <p
                    className={`mt-1.5 text-[11px] ${
                      national ? "text-rose-300" : "text-rose-600"
                    }`}
                  >
                    No se pudo guardar la confirmación. Probá de nuevo.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Ocultar: solo en los nacionales. El comunicado de tu propia
            Asamblea no se esconde; el del país no siempre te toca.
            Ocultarlo cuenta como haberlo visto (crea la fila de lectura
            con su seen_at), así que el informe de la AEN no lo anota
            como "no vio": descartar es un acto de lectura. */}
        {national && (
          <div className="mt-4 flex justify-end border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={toggleHidden}
              disabled={pending}
              className="tap text-[11.5px] font-medium text-white/50 hover:text-white/80 disabled:opacity-50"
            >
              {isHidden ? "Devolver a mi lista" : "Ocultar de mi lista"}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
