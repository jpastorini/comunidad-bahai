import { getOptionalMember } from "@/lib/auth";
import { createSupabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { seedChat } from "@/lib/seed-data";
import { ChatScreen } from "./chat-screen";
import { ChatGate } from "./chat-gate";
import { markChatSeenByMemberAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  // Demo mode: no Supabase → show seed conversation read-only.
  if (!isSupabaseConfigured()) {
    return <ChatScreen mode="demo" memberId="me" initialMessages={seedChat} />;
  }

  const session = await getOptionalMember();
  if (!session) {
    return <ChatGate />;
  }

  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("member_id", session.user.id)
    .order("created_at", { ascending: true });

  // Apaga el indicador "!" del home — el miembro acaba de abrir el chat.
  await markChatSeenByMemberAction(session.user.id);

  return (
    <ChatScreen
      mode="live"
      memberId={session.user.id}
      initialMessages={(data ?? []).map((m) => ({
        ...m,
        // On the member side, "mine" means the member wrote it.
        // is_admin_reply trumps from_user_id so this works even when
        // admin and member are the same person (self-testing).
        mine: !m.is_admin_reply,
      }))}
    />
  );
}
