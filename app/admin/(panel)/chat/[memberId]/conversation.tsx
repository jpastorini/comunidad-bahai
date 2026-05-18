"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { formatChatTime } from "@/lib/format";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import type { ChatMessage } from "@/lib/types";
import { sendChatReplyAction } from "../actions";

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
  initialMessages: ChatMessage[];
};

export function Conversation({ memberId, adminId, initialMessages }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
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
        .channel(`chat-admin-${memberId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
            filter: `member_id=eq.${memberId}`,
          },
          (payload) => {
            console.log("[chat:admin] INSERT received", payload.new);
            const m = payload.new as ChatMessage;
            setMessages((prev) => mergeIncoming(prev, m));
          }
        )
        .subscribe((status, err) => {
          console.log(`[chat:admin] subscribe status: ${status}`);
          if (err) console.error("[chat:admin] subscribe error:", err);
        });
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [memberId]);

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
      },
    ]);
    setDraft("");

    const fd = new FormData();
    fd.set("member_id", memberId);
    fd.set("text", text);
    startTransition(async () => {
      try {
        await sendChatReplyAction(fd);
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      }
    });
  }

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
        {messages.map((m) => {
          // From the admin's perspective: "mine" = an admin reply.
          // Works even when admin and member are the same user (self-testing).
          const mine = m.is_admin_reply;
          return (
            <div
              key={m.id}
              className={`max-w-[80%] ${mine ? "self-end" : "self-start"}`}
            >
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

      <form onSubmit={handleSend} className="mt-4">
        <div className="flex items-end gap-3 rounded-2xl border border-black/[0.06] bg-card p-3 shadow-card-soft">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleSend(e);
              }
            }}
            rows={2}
            placeholder="Responder como Secretaría... (Ctrl/⌘+Enter para enviar)"
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
    </>
  );
}
