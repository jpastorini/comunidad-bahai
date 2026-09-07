"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

/**
 * Hace "en vivo" el informe de lectura de un comunicado: cada fila que
 * entra o cambia en `message_reads` para ese comunicado —y cada voto en
 * `poll_votes` de su encuesta (051), si tiene— re-renderiza la página
 * en el servidor (router.refresh). Mismo molde que ChatListRefresher;
 * la RLS ya decide que solo la Asamblea de la localidad reciba estos
 * eventos.
 */
export function ReadReportRefresher({
  messageId,
  pollId = null,
}: {
  messageId: string;
  pollId?: string | null;
}) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) supabase.realtime.setAuth(token);
      if (cancelled) return;

      let ch = supabase.channel(`message-reads-${messageId}`).on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reads",
          filter: `message_id=eq.${messageId}`,
        },
        () => router.refresh()
      );
      if (pollId) {
        ch = ch.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "poll_votes",
            filter: `poll_id=eq.${pollId}`,
          },
          () => router.refresh()
        );
      }
      channel = ch.subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [router, messageId, pollId]);

  return null;
}
