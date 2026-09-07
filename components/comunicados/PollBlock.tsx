"use client";

import { useEffect, useState, useTransition } from "react";
import { castVoteAction } from "@/app/(app)/comunicados/actions";
import { formatDate } from "@/lib/format";
import { isPollOpen, pollPercent } from "@/lib/polls-shared";
import type { MessagePoll, MyPollVote, PollResults } from "@/lib/types";

type Props = {
  poll: MessagePoll;
  myVote: MyPollVote | null;
  results: PollResults | null;
};

/**
 * La encuesta dentro de la tarjeta del comunicado (051), como en
 * WhatsApp: opciones grandes para tocar, y al votar aparecen las barras.
 *
 * · Se vota una sola vez y no se cambia, así que no se vota al toque:
 *   se elige y después se confirma con "Votar". Un roce accidental no
 *   puede ser un voto irreversible.
 * · Los resultados se muestran a quien ya votó y a todos al cierre. Antes
 *   de votar solo se ve cuántas personas votaron, para no arrastrar.
 * · En una encuesta anónima el servidor no sabe qué eligió la persona,
 *   así que la elección se recuerda solo en este dispositivo
 *   (`localStorage`) para resaltarla; si falta, se ve igual el total.
 */
export function PollBlock({ poll, myVote: initialVote, results: initialResults }: Props) {
  const open = isPollOpen(poll);
  const [selected, setSelected] = useState<string[]>([]);
  const [myVote, setMyVote] = useState<MyPollVote | null>(initialVote);
  const [results, setResults] = useState<PollResults | null>(initialResults);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [localChoice, setLocalChoice] = useState<string[]>([]);

  const storageKey = `cb-poll-${poll.id}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setLocalChoice(JSON.parse(raw) as string[]);
    } catch {
      /* sin almacenamiento: se ve el total igual */
    }
  }, [storageKey]);

  const voted = Boolean(myVote);
  const showResults = voted || !open;
  const participants = results?.participants ?? 0;
  const mine = new Set(myVote?.option_ids.length ? myVote.option_ids : localChoice);

  function toggle(id: string) {
    setError(null);
    setSelected((prev) => {
      if (poll.allow_multiple) {
        return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      }
      return prev.includes(id) ? [] : [id];
    });
  }

  function vote() {
    if (selected.length === 0) return;
    setError(null);
    startTransition(async () => {
      const res = await castVoteAction(poll.id, selected);
      if (res.ok) {
        setMyVote({ voted_at: new Date().toISOString(), option_ids: poll.anonymous ? [] : selected });
        setResults(res.results);
        if (poll.anonymous) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(selected));
            setLocalChoice(selected);
          } catch {
            /* nada */
          }
        }
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <div className="mt-4 rounded-xl border border-gold/35 bg-gold/[0.07] p-3.5">
      <div className="mb-2.5 flex items-start gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-gold-dark">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[1.2px] text-gold-dark">
            {poll.anonymous ? "Encuesta anónima" : "Encuesta"}
          </div>
          <h3 className="mt-0.5 font-display text-[16px] font-semibold leading-[1.3] text-dark">
            {poll.question}
          </h3>
        </div>
      </div>

      {showResults ? (
        <ul className="flex flex-col gap-2">
          {poll.options.map((o) => {
            const n = results?.votes[o.id] ?? 0;
            const pct = pollPercent(n, participants);
            const isMine = mine.has(o.id);
            return (
              <li key={o.id} className="relative overflow-hidden rounded-lg bg-white/70 ring-1 ring-black/[0.05]">
                <div
                  className={`absolute inset-y-0 left-0 ${isMine ? "bg-terra/20" : "bg-gold/25"}`}
                  style={{ width: `${pct}%`, transition: "width .4s ease" }}
                />
                <div className="relative flex items-center gap-2 px-3 py-2">
                  <span className="min-w-0 flex-1 text-[13px] font-medium text-dark">
                    {o.label}
                    {isMine && (
                      <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-terra">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        tu voto
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-[12px] font-semibold tabular-nums text-dark">
                    {pct} %
                  </span>
                  <span className="shrink-0 text-[10.5px] tabular-nums text-muted">
                    {n === 1 ? "1 voto" : `${n} votos`}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {poll.options.map((o) => {
              const on = selected.includes(o.id);
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => toggle(o.id)}
                    disabled={pending}
                    aria-pressed={on}
                    className={`tap flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium ring-1 transition ${
                      on
                        ? "bg-terra text-white ring-terra"
                        : "bg-white/80 text-dark ring-black/[0.08] hover:bg-white"
                    }`}
                  >
                    <span
                      className={`flex shrink-0 items-center justify-center border ${
                        poll.allow_multiple ? "rounded" : "rounded-full"
                      } ${on ? "border-white bg-white" : "border-black/25"}`}
                      style={{ width: 18, height: 18 }}
                    >
                      {on && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2A3F8F" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                    {o.label}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={vote}
            disabled={pending || selected.length === 0}
            className="tap mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-terra px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-terra/90 disabled:opacity-50"
          >
            {pending ? "Enviando…" : "Votar"}
          </button>
          {error && <p className="mt-1.5 text-[11px] text-rose-600">{error}</p>}
        </>
      )}

      <p className="mt-2.5 text-[11px] text-muted">
        {statusLine({ open, voted, participants, poll })}
      </p>
    </div>
  );
}

function statusLine({
  open,
  voted,
  participants,
  poll,
}: {
  open: boolean;
  voted: boolean;
  participants: number;
  poll: MessagePoll;
}): string {
  const count =
    participants === 0
      ? "Nadie votó todavía"
      : participants === 1
        ? "Votó 1 persona"
        : `Votaron ${participants} personas`;
  if (!open) return `Votación cerrada · ${count}.`;
  const closes = poll.closes_at ? ` Cierra el ${formatDate(poll.closes_at)}.` : "";
  if (voted) return `Gracias por votar · ${count}.${closes}`;
  const rule = poll.allow_multiple
    ? "Podés elegir varias opciones."
    : "Elegí una opción.";
  return `${rule} Se vota una sola vez y no se puede cambiar. ${count}.${closes}`;
}
