"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { playChime } from "@/lib/notification-sound";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import type { ChatMessage } from "@/lib/types";

type Props = {
  /** Usuario actual. */
  userId: string;
  /** "member" recibe respuestas de la Secretaría; "admin" recibe mensajes
   *  entrantes de los miembros (solo se monta para admins con tag de chat). */
  side: "member" | "admin";
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
export function ChatNotifier({ userId, side }: Props) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowser();
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

          // Relevancia según el lado.
          if (side === "member") {
            // Solo respuestas de la Secretaría (no mis propios mensajes).
            if (!m.is_admin_reply) return;
          } else {
            // Solo mensajes entrantes de miembros (no respuestas de admin
            // ni los que envié yo).
            if (m.is_admin_reply) return;
            if (m.from_user_id === userId) return;
          }

          handleIncoming(m);
        })
        .subscribe();
    })();

    function handleIncoming(m: ChatMessage) {
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
            side === "member" ? "Secretaría Local" : "Nuevo mensaje de chat";
          const body = (m.text ?? "").slice(0, 120) || "Tenés un mensaje nuevo";
          const url = side === "member" ? "/chat" : `/admin/chat/${m.member_id}`;
          const n = new Notification(title, {
            body,
            tag: `chat-${m.member_id}`,
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
  }, [router, userId, side]);

  return null;
}
