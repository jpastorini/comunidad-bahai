"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { sendChatReplyAction } from "@/app/admin/(panel)/chat/actions";
import { formatChatTime } from "@/lib/format";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import type { ChatMessage, ChatTopic } from "@/lib/types";

/**
 * Merge an incoming realtime message into the local list, replacing the
 * matching optimistic placeholder (if any). Optimistic messages have
 * synthetic ids starting with "local-"; we match them by sender + text
 * sent within the last 10 seconds.
 */
function mergeIncoming(prev: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  if (prev.some((x) => x.id === incoming.id)) return prev;
  const optimisticIdx = prev.findIndex(
    (x) =>
      x.id.startsWith("local-") &&
      x.from_user_id === incoming.from_user_id &&
      x.text === incoming.text &&
      Math.abs(
        new Date(x.created_at).getTime() - new Date(incoming.created_at).getTime()
      ) < 10_000
  );
  if (optimisticIdx >= 0) {
    const next = prev.slice();
    next[optimisticIdx] = incoming;
    return next;
  }
  return [...prev, incoming];
}

type Props = {
  memberId: string;
  adminId: string;
  adminName: string | null;
  topic: ChatTopic;
  initialMessages: ChatMessage[];
};

export function Conversation({
  memberId,
  adminId,
  adminName,
  topic,
  initialMessages,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  // Realtime subscription on this member's conversation.
  useEffect(() => {
    const supabase = createSupabaseBrowser();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      // Pass the admin's JWT to the realtime client so RLS lets us
      // subscribe to chat_messages rows that aren't ours.
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) supabase.realtime.setAuth(token);
      if (cancelled) return;

      channel = supabase
        .channel(`chat-admin-${topic}-${memberId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
            // Realtime admite un solo filtro: suscribimos la conversación
            // del creyente y descartamos el otro canal acá.
            filter: `member_id=eq.${memberId}`,
          },
          (payload) => {
            const m = payload.new as ChatMessage;
            if ((m.topic ?? "secretaria") !== topic) return;
            setMessages((prev) => mergeIncoming(prev, m));
          }
        )
        .subscribe((status, err) => {
          if (err) console.error("[chat:admin] subscribe error:", err);
        });
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [memberId, topic]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;

    const optimisticId = `local-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        member_id: memberId,
        from_user_id: adminId,
        text,
        created_at: new Date().toISOString(),
        read: true,
        is_admin_reply: true,
        topic,
        from_name: adminName,
      },
    ]);
    setDraft("");
    setSendError(null);

    // La respuesta no se guardó: se saca la burbuja optimista y se le
    // devuelve el texto al recuadro, para no perder lo escrito.
    const fail = (message: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setDraft((current) => current || text);
      setSendError(message);
    };

    const fd = new FormData();
    fd.set("member_id", memberId);
    fd.set("text", text);
    fd.set("topic", topic);
    startTransition(async () => {
      try {
        const result = await sendChatReplyAction(fd);
        if (result && !result.ok) fail(result.message);
      } catch {
        fail(
          "No pudimos enviar la respuesta. Revisá tu conexión y probá de nuevo."
        );
      }
    });
  }

  const signature = topic === "tesoreria" ? "Tesorería" : "Secretaría";

  return (
    <>
      <div
        ref={scrollRef}
        className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto rounded-2xl border border-black/[0.04] bg-card p-5 shadow-card md:p-6"
      >
        {messages.length === 0 && (
          <div className="py-10 text-center text-[13px] text-muted">
            Sin mensajes en esta conversación.
          </div>
        )}
        {messages.map((m, i) => {
          // From the admin's perspective: "mine" = an admin reply.
          // Works even when admin and member are the same user (self-testing).
          const mine = m.is_admin_reply;
          // Quién respondió, una vez por tanda: acá también sirve para ver
          // si contestó otra persona de la Asamblea.
          const prev = messages[i - 1];
          const startsBlock =
            mine &&
            (!prev ||
              !prev.is_admin_reply ||
              prev.from_user_id !== m.from_user_id);
          return (
            <div
              key={m.id}
              className={`max-w-[80%] ${mine ? "self-end" : "self-start"} ${
                startsBlock && i > 0 ? "mt-2" : ""
              }`}
            >
              {startsBlock && (
                <div className="mb-0.5 px-1 text-right text-[10.5px] font-semibold text-terra">
                  {m.from_name || signature}
                </div>
              )}
              <div
                className={
                  mine
                    ? "rounded-[16px_16px_4px_16px] bg-terra px-3.5 py-2.5 text-[13px] leading-[1.5] text-white"
                    : "rounded-[16px_16px_16px_4px] bg-amber-50 px-3.5 py-2.5 text-[13px] leading-[1.5] text-dark border border-amber-100/60"
                }
              >
                {m.text}
              </div>
              <div
                className={`mt-0.5 px-1 text-[10px] text-muted ${
                  mine ? "text-right" : "text-left"
                }`}
              >
                {formatChatTime(m.created_at)}
              </div>
            </div>
          );
        })}
      </div>

      {sendError && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-[13px] text-rose-700"
        >
          {sendError}
        </div>
      )}

      <form onSubmit={handleSend} className="mt-4">
        <div className="flex items-end gap-3 rounded-2xl border border-black/[0.06] bg-card p-3 shadow-card-soft">
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (sendError) setSendError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleSend(e);
              }
            }}
            rows={2}
            placeholder={`Responder como ${signature}... (Ctrl/⌘+Enter para enviar)`}
            className="flex-1 resize-none bg-transparent font-body text-[13px] text-dark outline-none placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            className="tap rounded-xl bg-terra px-4 py-2.5 text-[13px] font-semibold text-white shadow-card-soft disabled:opacity-50"
          >
            Enviar
          </button>
        </div>
      </form>
      <p className="mt-2 px-1 text-[11.5px] text-muted">
        El creyente ve tu nombre sobre la respuesta, así sabe con quién está
        hablando.
      </p>
    </>
  );
}
