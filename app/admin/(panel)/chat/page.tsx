import { ChatListRefresher } from "@/components/admin/chat/ChatListRefresher";
import {
  ConversationList,
  type ConversationSummary,
} from "@/components/admin/chat/ConversationList";
import { Banner, PageHeader } from "@/components/admin/ui";
import { PushToggle } from "@/components/PushToggle";
import { ensureChatTag, requireAdmin } from "@/lib/auth";
import { chatFailure } from "@/lib/chat-errors";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function AdminChatListPage() {
  const session = await requireAdmin();
  ensureChatTag(session.profile);
  const supabase = createSupabaseServer();

  // Una sola RPC agrega por creyente (último mensaje + sin leer), filtrando
  // por localidad, canal y tag en SQL. Ver migraciones 022 y 045.
  const { data, error } = await supabase.rpc(
    "get_chat_conversation_summaries",
    { p_topic: "secretaria" }
  );
  const conversations = (data ?? []) as ConversationSummary[];
  // Una bandeja vacía por error se ve igual que una bandeja sin mensajes,
  // y en esta pantalla esa confusión cuesta caro: la Secretaría creería
  // que nadie escribió.
  const loadError = chatFailure(
    "inbox(secretaria)",
    error,
    "No pudimos cargar las conversaciones. Recargá la página en un momento."
  );

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

      {loadError && (
        <div className="mb-4">
          <Banner tone="danger">{loadError}</Banner>
        </div>
      )}

      <ConversationList
        conversations={conversations}
        basePath="/admin/chat"
        emptyText={
          loadError
            ? "No pudimos leer la bandeja."
            : "No hay conversaciones todavía."
        }
      />
    </>
  );
}
