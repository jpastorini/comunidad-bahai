import { ChatListRefresher } from "@/components/admin/chat/ChatListRefresher";
import {
  ConversationList,
  type ConversationSummary,
} from "@/components/admin/chat/ConversationList";
import { PageHeader } from "@/components/admin/ui";
import { PushToggle } from "@/components/PushToggle";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Bandeja del tesorero. Mismo mecanismo que el chat de Secretaría, otro
 * canal: acá llegan los avisos de aportes hechos por giro directo a la
 * cuenta. Detrás del tag `can_manage_treasury` — un miembro de la
 * Asamblea con tag de chat no lee estos mensajes, ni por API directa.
 */
export default async function TreasuryChatListPage() {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const { data } = await supabase.rpc("get_chat_conversation_summaries", {
    p_topic: "tesoreria",
  });
  const conversations = (data ?? []) as ConversationSummary[];

  return (
    <>
      <ChatListRefresher channel="admin-chat-list-tesoreria" />
      <PageHeader
        eyebrow="Tesorería"
        title="Mensajes al tesorero"
        description="Avisos de aportes al Fondo y consultas de tesorería. Solo los ve quien tiene el tag de Tesorería."
      />

      <div className="mb-4">
        <PushToggle />
      </div>

      <ConversationList
        conversations={conversations}
        basePath="/admin/tesoreria/chat"
        emptyText="No hay mensajes todavía. Cuando un creyente avise de un giro al Fondo, aparece acá."
      />
    </>
  );
}
