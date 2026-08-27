"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

/**
 * Drop this in a conversations-list page so it refreshes whenever a new
 * chat message hits the database. Lightweight: it doesn't render anything
 * and only triggers a server re-render via router.refresh().
 *
 * No filtra por tema: la RLS ya decide qué filas ve quien mira, y un
 * refresh de más no muestra nada que no corresponda.
 */
export function ChatListRefresher({ channel: name }: { channel: string }) {
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
        .channel(name)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages" },
          () => {
            router.refresh();
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [router, name]);

  return null;
}
