import { ChatListRefresher } from "@/components/admin/chat/ChatListRefresher";
import {
  ConversationList,
  type ConversationSummary,
} from "@/components/admin/chat/ConversationList";
import { PageHeader } from "@/components/admin/ui";
import { PushToggle } from "@/components/PushToggle";
import { ensureChatTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function AdminChatListPage() {
  const session = await requireAdmin();
  ensureChatTag(session.profile);
  const supabase = createSupabaseServer();

  // Una sola RPC agrega por creyente (último mensaje + sin leer), filtrando
  // por localidad, canal y tag en SQL. Ver migraciones 022 y 045.
  const { data } = await supabase.rpc("get_chat_conversation_summaries", {
    p_topic: "secretaria",
  });
  const conversations = (data ?? []) as ConversationSummary[];

  return (
    <>
      <ChatListRefresher channel="admin-chat-list-secretaria" />
      <PageHeader
        eyebrow="Secretaría"
        title="Conversaciones"
        description="Responde a los creyentes que han escrito a la Secretaría. Los mensajes dirigidos a Tesorería los atiende el tesorero, en su propia bandeja."
      />

      <div className="mb-4">
        <PushToggle />
      </div>

      <ConversationList
        conversations={conversations}
        basePath="/admin/chat"
        emptyText="No hay conversaciones todavía."
      />
    </>
  );
}
