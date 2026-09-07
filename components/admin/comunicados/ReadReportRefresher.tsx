"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

/**
 * Hace "en vivo" el informe de lectura de un comunicado: cada fila que
 * entra o cambia en `message_reads` para ese comunicado re-renderiza la
 * página en el servidor (router.refresh). Mismo molde que
 * ChatListRefresher; la RLS ya decide que solo la Asamblea de la
 * localidad reciba estos eventos.
 */
export function ReadReportRefresher({ messageId }: { messageId: string }) {
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

      channel = supabase
        .channel(`message-reads-${messageId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "message_reads",
            filter: `message_id=eq.${messageId}`,
          },
          () => router.refresh()
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [router, messageId]);

  return null;
}
