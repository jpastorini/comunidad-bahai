"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AssistantMarkdown } from "@/components/treasury/AssistantMarkdown";
import type { DisplayItem, Proposal, StreamEvent } from "@/lib/treasury-assistant/types";

type ThreadSummary = { id: string; title: string | null; updated_at: string };

const ENDPOINT = "/admin/tesoreria/asistente/api";

const SUGGESTIONS = [
  "¿Qué tengo que hacer este mes?",
  "¿Cuánto hay en cada cuenta hoy?",
  "¿Cómo venimos con el presupuesto del ejercicio?",
  "¿Qué quedó sin conciliar en Prex?",
];

const STATUS: Record<Proposal["status"], { label: string; cls: string }> = {
  pendiente: { label: "Por confirmar", cls: "bg-amber-50 text-amber-800" },
  hecho: { label: "Registrado", cls: "bg-[#6A8B5F1A] text-green" },
  descartado: { label: "Descartado", cls: "bg-black/[0.04] text-muted" },
  fallo: { label: "No se pudo", cls: "bg-rose-50 text-rose-700" },
};

/**
 * La conversación con el asistente. Cada pedido al servidor devuelve un
 * stream de líneas JSON (`StreamEvent`): texto que se va escribiendo, la
 * herramienta que está corriendo, y las tarjetas de lo que propone
 * registrar, que se confirman de a una.
 */
export function AssistantChat({
  threadId,
  initialItems,
  threads: initialThreads,
}: {
  threadId: string | null;
  initialItems: DisplayItem[];
  threads: ThreadSummary[];
}) {
  const [items, setItems] = useState<DisplayItem[]>(initialItems);
  const [threads, setThreads] = useState(initialThreads);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [toolLabel, setToolLabel] = useState<string | null>(null);
  const threadRef = useRef<string | null>(threadId);
  const breakRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [items, toolLabel]);

  const handle = (e: StreamEvent) => {
    switch (e.type) {
      case "thread":
        if (threadRef.current !== e.id) {
          threadRef.current = e.id;
          window.history.replaceState(null, "", `?c=${e.id}`);
          setThreads((ts) => [{ id: e.id, title: e.title, updated_at: new Date().toISOString() }, ...ts]);
        }
        break;
      case "text": {
        const sep = breakRef.current ? "\n\n" : "";
        breakRef.current = false;
        setToolLabel(null);
        setItems((xs) => {
          const last = xs[xs.length - 1];
          if (last?.kind === "assistant") {
            return [...xs.slice(0, -1), { kind: "assistant", text: last.text + sep + e.delta }];
          }
          return [...xs, { kind: "assistant", text: e.delta }];
        });
        break;
      }
      case "tool":
        breakRef.current = true;
        setToolLabel(e.label);
        break;
      case "proposals":
        setToolLabel(null);
        setItems((xs) => [...xs, { kind: "proposals", proposals: e.proposals }]);
        break;
      case "proposal":
        setItems((xs) =>
          xs.map((it) =>
            it.kind === "proposals"
              ? {
                  ...it,
                  proposals: it.proposals.map((p) =>
                    p.toolUseId === e.proposal.toolUseId ? e.proposal : p
                  ),
                }
              : it
          )
        );
        break;
      case "error":
        setItems((xs) => [...xs, { kind: "error", text: e.message }]);
        break;
      case "done":
        break;
    }
  };

  async function call(body: Record<string, unknown>) {
    setBusy(true);
    breakRef.current = false;
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, threadId: threadRef.current }),
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        handle({ type: "error", message: j?.error ?? "El asistente no respondió." });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (line) handle(JSON.parse(line) as StreamEvent);
        }
      }
    } catch {
      handle({ type: "error", message: "Se cortó la conexión con el asistente." });
    } finally {
      setBusy(false);
      setToolLabel(null);
    }
  }

  function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setDraft("");
    // Una pregunta nueva deja descartadas las tarjetas que quedaban sin decidir.
    setItems((xs) => [
      ...xs.map((it) =>
        it.kind === "proposals"
          ? {
              ...it,
              proposals: it.proposals.map((p) =>
                p.status === "pendiente"
                  ? { ...p, status: "descartado" as const, outcome: "No la confirmaste." }
                  : p
              ),
            }
          : it
      ),
      { kind: "user", text: t },
    ]);
    void call({ text: t });
  }

  async function decide(ids: string[], confirm: boolean) {
    for (const id of ids) await call({ decide: { id, confirm } });
  }

  return (
    <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="order-2 md:order-1">
        <Link
          href="/admin/tesoreria/asistente"
          className="mb-3 inline-flex rounded-xl border border-black/10 bg-card px-3 py-2 text-[13px] font-semibold text-dark hover:bg-bg"
        >
          + Conversación nueva
        </Link>
        {threads.length > 0 && (
          <ul className="space-y-0.5">
            {threads.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/admin/tesoreria/asistente?c=${t.id}`}
                  className={`block truncate rounded-lg px-2.5 py-1.5 text-[13px] hover:bg-black/[0.04] ${
                    t.id === threadRef.current ? "bg-black/[0.05] font-semibold text-dark" : "text-muted"
                  }`}
                >
                  {t.title || "Sin título"}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="order-1 flex min-h-[60vh] flex-col rounded-2xl border border-black/[0.04] bg-card shadow-card md:order-2">
        <div className="flex-1 space-y-4 p-4 md:p-6" data-no-pull>
          {items.length === 0 && (
            <div className="py-6">
              <p className="mb-3 text-[14px] text-muted">Algunas preguntas para empezar:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-black/10 px-3 py-1.5 text-[13px] text-dark hover:bg-bg"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {items.map((it, i) => {
            if (it.kind === "user") {
              return (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-terra px-4 py-2.5 text-[14px] text-white">
                    {it.text}
                  </div>
                </div>
              );
            }
            if (it.kind === "assistant") {
              return (
                <div key={i} className="max-w-[95%] text-[14px] leading-relaxed text-dark">
                  <AssistantMarkdown text={it.text} />
                </div>
              );
            }
            if (it.kind === "error") {
              return (
                <div key={i} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[13px] text-rose-700">
                  {it.text}
                </div>
              );
            }
            const open = it.proposals.filter((p) => p.status === "pendiente");
            return (
              <div key={i} className="space-y-3">
                {it.proposals.map((p) => (
                  <ProposalCard
                    key={p.toolUseId}
                    p={p}
                    busy={busy}
                    onDecide={(confirm) => decide([p.toolUseId], confirm)}
                  />
                ))}
                {open.length > 1 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => decide(open.map((p) => p.toolUseId), true)}
                    className="rounded-xl bg-terra px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
                  >
                    Confirmar las {open.length}
                  </button>
                )}
              </div>
            );
          })}

          {busy && (
            <p className="text-[13px] italic text-muted">{toolLabel ? `${toolLabel}…` : "Pensando…"}</p>
          )}
          <div ref={endRef} />
        </div>

        <form
          className="flex items-end gap-2 border-t border-black/[0.06] p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
            rows={2}
            placeholder="Preguntá o pedí que registre algo…"
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-black/10 bg-bg px-3 py-2.5 text-[14px] outline-none focus:border-terra/40"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="rounded-xl bg-terra px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            Enviar
          </button>
        </form>
      </section>
    </div>
  );
}

function ProposalCard({
  p,
  busy,
  onDecide,
}: {
  p: Proposal;
  busy: boolean;
  onDecide: (confirm: boolean) => void;
}) {
  const st = STATUS[p.status];
  return (
    <div className="rounded-xl border border-gold/40 bg-[#FBF8EE] p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-dark">{p.title}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-[13px]">
        {p.lines.map((l, i) => (
          <div key={i} className="contents">
            <dt className="text-muted">{l.label}</dt>
            <dd className="break-words text-dark">{l.value}</dd>
          </div>
        ))}
      </dl>
      {p.warnings.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[12px] text-amber-800">
          {p.warnings.map((w, i) => (
            <li key={i}>· {w}</li>
          ))}
        </ul>
      )}
      {p.status === "pendiente" ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onDecide(true)}
            className="rounded-lg bg-terra px-3.5 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            Confirmar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onDecide(false)}
            className="rounded-lg border border-black/10 bg-card px-3.5 py-1.5 text-[13px] text-dark disabled:opacity-50"
          >
            Descartar
          </button>
        </div>
      ) : (
        p.outcome && <p className="mt-2 text-[12px] text-muted">{p.outcome}</p>
      )}
    </div>
  );
}
