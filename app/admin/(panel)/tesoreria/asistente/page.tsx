import { Banner, PageHeader } from "@/components/admin/ui";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { TREASURY_HELP } from "@/lib/treasury-help";
import { listThreads, loadThread, toDisplay } from "@/lib/treasury-assistant/agent";
import { AssistantChat } from "./assistant-chat";

export const dynamic = "force-dynamic";

/**
 * Tesorería → Asistente (090): preguntarle al libro en palabras y pedirle
 * que registre, con una tarjeta de confirmación por cada escritura. La
 * conversación elegida va en `?c=<id>`; sin `c`, una nueva.
 */
export default async function AsistentePage({
  searchParams,
}: {
  searchParams: { c?: string };
}) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const threads = await listThreads(supabase);
  const thread = searchParams.c ? await loadThread(supabase, searchParams.c) : null;

  return (
    <>
      <PageHeader
        eyebrow="Tesorería"
        title="Asistente"
        help={TREASURY_HELP.screens.asistente}
        description="Preguntale lo que necesites saber del libro o pedile que registre algo. Nada se escribe hasta que lo confirmás."
      />
      {threads === null ? (
        <Banner tone="warning">Falta aplicar la migración 090 para usar el asistente.</Banner>
      ) : !process.env.ANTHROPIC_API_KEY ? (
        <Banner tone="warning">Falta configurar ANTHROPIC_API_KEY en el servidor.</Banner>
      ) : (
        <AssistantChat
          key={thread?.id ?? "nueva"}
          threadId={thread?.id ?? null}
          initialItems={thread ? toDisplay(thread) : []}
          threads={threads}
        />
      )}
    </>
  );
}
