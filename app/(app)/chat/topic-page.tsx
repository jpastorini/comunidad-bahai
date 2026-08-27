import { getOptionalMember } from "@/lib/auth";
import { seedChat } from "@/lib/seed-data";
import { createSupabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ChatMessage, ChatTopic } from "@/lib/types";
import { markChatSeenAction } from "./actions";
import { ChatGate } from "./chat-gate";
import { ChatScreen } from "./chat-screen";

/**
 * Pantalla de chat de un canal. Las dos rutas (`/chat` y
 * `/chat/tesoreria`) son la misma pantalla con otro tema; la conversación
 * es la dupla (creyente, tema).
 *
 * El `key` por tema es necesario: las dos rutas renderizan el mismo
 * componente en la misma posición del árbol, así que sin él React
 * reusaría la instancia y quedarían los mensajes del otro canal.
 */
export async function ChatTopicPage({ topic }: { topic: ChatTopic }) {
  // Demo mode: no Supabase → show seed conversation read-only.
  if (!isSupabaseConfigured()) {
    return (
      <ChatScreen
        key={topic}
        mode="demo"
        topic={topic}
        memberId="me"
        initialMessages={topic === "secretaria" ? seedChat : []}
      />
    );
  }

  const session = await getOptionalMember();
  if (!session) {
    return <ChatGate topic={topic} />;
  }

  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("member_id", session.user.id)
    .eq("topic", topic)
    .order("created_at", { ascending: true });

  // Apaga el indicador "!" del home — el creyente acaba de abrir el canal.
  await markChatSeenAction(topic);

  return (
    <ChatScreen
      key={topic}
      mode="live"
      topic={topic}
      memberId={session.user.id}
      initialMessages={((data ?? []) as ChatMessage[]).map((m) => ({
        ...m,
        // On the member side, "mine" means the member wrote it.
        // is_admin_reply trumps from_user_id so this works even when
        // admin and member are the same person (self-testing).
        mine: !m.is_admin_reply,
      }))}
    />
  );
}
