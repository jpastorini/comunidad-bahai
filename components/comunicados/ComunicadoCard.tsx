"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  confirmMessageReadAction,
  markMessageSeenAction,
} from "@/app/(app)/comunicados/actions";
import { formatDate, formatMessageDate } from "@/lib/format";
import type { Message, MessageRead } from "@/lib/types";

type Props = {
  message: Message;
  read: MessageRead | null;
  /** "Nuevo" ya resuelto en el servidor (por persona, ver isNewForReader). */
  isNew: boolean;
  featured: boolean;
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
export function ComunicadoCard({ message: m, read, isNew, featured }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const seenRef = useRef<boolean>(Boolean(read));
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

  return (
    <article
      ref={ref}
      className={
        featured
          ? "overflow-hidden rounded-2xl shadow-card-elevated ring-1 ring-gold/45"
          : "overflow-hidden rounded-2xl bg-card shadow-card"
      }
      style={
        featured
          ? { background: "linear-gradient(160deg, #FBF6E4, #FFFDF7)" }
          : undefined
      }
    >
      {m.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.image_url} alt={m.title} className="h-44 w-full object-cover" />
      )}
      <div className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[10px] font-semibold tracking-[0.3px] text-terra">
            {formatMessageDate(m.date)}
          </span>
          {isNew && (
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

        {m.ask_confirmation && (
          <div className="mt-4 border-t border-black/[0.06] pt-3">
            {confirmedAt ? (
              <p className="flex items-center gap-2 text-[12px] font-medium text-green">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Confirmaste que leíste este comunicado el {formatDate(confirmedAt)}.
              </p>
            ) : (
              <>
                <p className="mb-2 text-[11.5px] text-muted">
                  La Asamblea pide confirmar la lectura de este comunicado.
                </p>
                <button
                  type="button"
                  onClick={confirm}
                  disabled={pending}
                  className="tap inline-flex w-full items-center justify-center gap-2 rounded-xl bg-terra px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-terra/90 disabled:opacity-60"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Enterado/a
                </button>
                {failed && (
                  <p className="mt-1.5 text-[11px] text-rose-600">
                    No se pudo guardar la confirmación. Probá de nuevo.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
