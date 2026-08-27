"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { BahaiStar } from "@/components/BahaiStar";
import { HeaderUserMenu } from "@/components/HeaderUser";
import { IconChevronLeft, IconSend } from "@/components/Icons";
import {
  AEL_SEGMENTS,
  CHAT_SEGMENTS,
  SegmentedNav,
} from "@/components/SegmentedNav";
import { formatChatTime } from "@/lib/format";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { CHAT_TOPIC_LABELS, type ChatMessage, type ChatTopic } from "@/lib/types";
import { sendMemberMessageAction } from "./actions";

/** Replace optimistic placeholder with realtime payload (matched by sender+text+~10s). */
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
  const tagged: ChatMessage = { ...incoming, mine: !incoming.is_admin_reply };
  if (optimisticIdx >= 0) {
    const next = prev.slice();
    next[optimisticIdx] = tagged;
    return next;
  }
  return [...prev, tagged];
}

/** Copy propio de cada canal. */
const TOPIC_COPY: Record<
  ChatTopic,
  { initial: string; caption: string; empty: string; placeholder: string }
> = {
  secretaria: {
    initial: "S",
    caption: "Chat con la Asamblea",
    empty:
      "Aún no hay mensajes. Escribe el primero y la Secretaría te responderá.",
    placeholder: "Escribe un mensaje...",
  },
  tesoreria: {
    initial: "T",
    caption: "Chat con el tesorero",
    empty:
      "Aún no hay mensajes. Si hiciste un giro al Fondo, avisale acá al tesorero: fecha, monto y a qué fondo lo destinás.",
    placeholder: "Contale al tesorero...",
  },
};

type Props = {
  mode: "demo" | "live";
  topic: ChatTopic;
  memberId: string;
  initialMessages: ChatMessage[];
};

export function ChatScreen({ mode, topic, memberId, initialMessages }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const copy = TOPIC_COPY[topic];

  // Autoscroll on new message
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  // Realtime subscription: only in live mode.
  useEffect(() => {
    if (mode !== "live") return;
    const supabase = createSupabaseBrowser();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      // Ensure the realtime client uses the current user's JWT, so RLS
      // policies on chat_messages accept the subscription.
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) supabase.realtime.setAuth(token);
      if (cancelled) return;

      channel = supabase
        .channel(`chat-member-${topic}-${memberId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
            // El filtro de Realtime admite una sola condición, así que
            // suscribimos la conversación entera y descartamos el otro
            // canal acá.
            filter: `member_id=eq.${memberId}`,
          },
          (payload) => {
            const m = payload.new as ChatMessage;
            if ((m.topic ?? "secretaria") !== topic) return;
            setMessages((prev) => mergeIncoming(prev, m));
          }
        )
        .subscribe((status, err) => {
          if (err) console.error("[chat:member] subscribe error:", err);
        });
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [mode, memberId, topic]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;

    // Optimistic UI
    const optimisticId = `local-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        member_id: memberId,
        from_user_id: memberId,
        text,
        created_at: new Date().toISOString(),
        read: false,
        is_admin_reply: false,
        topic,
        from_name: null,
        mine: true,
      },
    ]);
    setDraft("");

    if (mode !== "live") return;

    const fd = new FormData();
    fd.set("text", text);
    fd.set("topic", topic);
    startTransition(async () => {
      try {
        await sendMemberMessageAction(fd);
      } catch {
        // Roll back optimistic message on failure.
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      }
    });
  }

  return (
    <>
      <header
        className="relative shrink-0 overflow-hidden bg-gold-grad px-5 pb-3.5"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 28px)" }}
      >
        <div className="pointer-events-none absolute right-[-12px] top-5 opacity-[0.05]">
          <BahaiStar size={100} color="#fff" />
        </div>
        <div className="relative mb-3 flex min-h-[38px] items-center justify-between gap-2">
          <Link
            href="/"
            className="tap inline-flex items-center gap-2 text-white/60"
          >
            <IconChevronLeft size={14} className="text-white/70" />
            <span className="font-body text-[13px]">Inicio</span>
          </Link>
          <HeaderUserMenu className="-mr-1" />
        </div>
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-base font-semibold text-white">
            {copy.initial}
          </div>
          <div>
            <div className="font-sans text-[16px] font-semibold text-white">
              {CHAT_TOPIC_LABELS[topic]}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-online" />
              <span className="text-[11px] text-white/55">
                {mode === "demo" ? "Modo demo" : copy.caption}
              </span>
            </div>
          </div>
        </div>
      </header>

      <SegmentedNav items={AEL_SEGMENTS} />
      <div className="-mt-1">
        <SegmentedNav items={CHAT_SEGMENTS} />
      </div>

      <div
        ref={scrollRef}
        className="scroll-area flex flex-1 flex-col gap-1.5 px-4 py-3.5 font-body"
      >
        {messages.length === 0 && (
          <div className="my-auto max-w-[280px] self-center text-center text-[13px] text-muted">
            {copy.empty}
          </div>
        )}
        {messages.map((m, i) => {
          // Mine = the member wrote it (i.e. NOT an admin reply).
          const mine = m.mine ?? !m.is_admin_reply;
          // El nombre de quien atiende va una vez por tanda: sobre la
          // primera burbuja de cada bloque del mismo autor.
          const prev = messages[i - 1];
          const startsBlock =
            !mine &&
            (!prev ||
              (prev.mine ?? !prev.is_admin_reply) ||
              prev.from_user_id !== m.from_user_id);
          return (
            <div
              key={m.id}
              className={`max-w-[80%] ${mine ? "self-end" : "self-start"} ${
                startsBlock && i > 0 ? "mt-2" : ""
              }`}
            >
              {startsBlock && (
                <div className="mb-0.5 px-1 text-[10.5px] font-semibold text-terra">
                  {m.from_name || CHAT_TOPIC_LABELS[topic]}
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
                className={`mt-0.5 px-1 text-[9.5px] text-muted ${
                  mine ? "text-right" : "text-left"
                }`}
              >
                {formatChatTime(m.created_at)}
              </div>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={handleSend}
        className="shrink-0 border-t border-black/[0.05] bg-card px-4 py-2.5"
      >
        <div className="flex items-center gap-2.5 rounded-3xl bg-bg px-3.5 py-2.5">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              mode === "demo"
                ? "Modo demo — los mensajes no se envían"
                : copy.placeholder
            }
            className="flex-1 bg-transparent font-body text-[13px] text-dark outline-none placeholder:text-[#aaa]"
            disabled={pending}
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            className="tap flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-terra text-white disabled:opacity-50"
            aria-label="Enviar mensaje"
          >
            <IconSend size={14} />
          </button>
        </div>
      </form>
    </>
  );
}
