"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { playChime } from "@/lib/notification-sound";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import {
  CHAT_TOPIC_ADMIN_PATHS,
  CHAT_TOPIC_LABELS,
  CHAT_TOPIC_PATHS,
  type ChatMessage,
  type ChatTopic,
} from "@/lib/types";

type Props = {
  /** Usuario actual. */
  userId: string;
  /** "member" recibe respuestas de quien atiende; "admin" recibe mensajes
   *  entrantes de los creyentes. */
  side: "member" | "admin";
  /** Solo del lado admin: canales que este usuario atiende, según sus tags
   *  ('secretaria' con can_respond_chat, 'tesoreria' con
   *  can_manage_treasury). La RLS ya no le manda los otros, pero el filtro
   *  también va acá para no depender de eso. */
  topics?: ChatTopic[];
};

/**
 * Listener global de chat. Vive en el layout (no en la pantalla de chat),
 * así que avisa aunque el usuario esté en otra sección:
 *   - reproduce un sonido,
 *   - refresca los badges del servidor (router.refresh),
 *   - si la app está en segundo plano y hay permiso, muestra una
 *     notificación del sistema (Capa 2).
 * No renderiza nada.
 */
export function ChatNotifier({ userId, side, topics }: Props) {
  const router = useRouter();
  // Estable entre renders para no re-suscribir el canal en cada uno.
  const topicKey = (topics ?? []).join(",");

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    const allowed = topicKey ? (topicKey.split(",") as ChatTopic[]) : [];
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) supabase.realtime.setAuth(token);
      if (cancelled) return;

      const config =
        side === "member"
          ? {
              event: "INSERT" as const,
              schema: "public",
              table: "chat_messages",
              filter: `member_id=eq.${userId}`,
            }
          : {
              event: "INSERT" as const,
              schema: "public",
              table: "chat_messages",
            };

      channel = supabase
        .channel(`chat-notify-${side}-${userId}`)
        .on("postgres_changes", config, (payload) => {
          const m = payload.new as ChatMessage;
          const topic: ChatTopic = m.topic ?? "secretaria";

          // Relevancia según el lado.
          if (side === "member") {
            // Solo respuestas de quien atiende (no mis propios mensajes).
            if (!m.is_admin_reply) return;
          } else {
            // Solo mensajes entrantes de creyentes (no respuestas de admin
            // ni los que envié yo), y solo de los canales que atiendo.
            if (m.is_admin_reply) return;
            if (m.from_user_id === userId) return;
            if (!allowed.includes(topic)) return;
          }

          handleIncoming(m, topic);
        })
        .subscribe();
    })();

    function handleIncoming(m: ChatMessage, topic: ChatTopic) {
      playChime();
      // Refresca los badges del servidor (tab AEL / chat sin leer).
      router.refresh();

      // Capa 2: notificación del sistema si la app no está visible.
      try {
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted" &&
          typeof document !== "undefined" &&
          document.visibilityState === "hidden"
        ) {
          const title =
            side === "member"
              ? CHAT_TOPIC_LABELS[topic]
              : topic === "tesoreria"
                ? "Nuevo mensaje para Tesorería"
                : "Nuevo mensaje de chat";
          const body = (m.text ?? "").slice(0, 120) || "Tenés un mensaje nuevo";
          const url =
            side === "member"
              ? CHAT_TOPIC_PATHS[topic]
              : `${CHAT_TOPIC_ADMIN_PATHS[topic]}/${m.member_id}`;
          const n = new Notification(title, {
            body,
            tag: `chat-${topic}-${m.member_id}`,
            icon: "/icon.svg",
          });
          n.onclick = () => {
            try {
              window.focus();
            } catch {
              /* noop */
            }
            window.location.href = url;
            n.close();
          };
        }
      } catch {
        /* noop */
      }
    }

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [router, userId, side, topicKey]);

  return null;
}
