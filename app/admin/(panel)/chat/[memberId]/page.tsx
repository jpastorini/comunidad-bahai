import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { ensureChatTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { ChatMessage } from "@/lib/types";
import { markConversationReadAction } from "../actions";
import { Conversation } from "./conversation";

export default async function ConversationPage({
  params,
}: {
  params: { memberId: string };
}) {
  const session = await requireAdmin();
  ensureChatTag(session.profile);
  const supabase = createSupabaseServer();

  const { data: member } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", params.memberId)
    .maybeSingle();
  if (!member) notFound();

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("member_id", params.memberId)
    .order("created_at", { ascending: true });

  // Best-effort: mark inbound messages as read.
  await markConversationReadAction(params.memberId);

  return (
    <>
      <PageHeader
        eyebrow={member.email ?? "Conversación"}
        title={member.full_name ?? "Miembro"}
        description="Este chat solo lo ve este miembro. Las respuestas aparecen como 'Secretaría'."
      />
      <Conversation
        memberId={params.memberId}
        adminId={session.user.id}
        initialMessages={(messages ?? []) as ChatMessage[]}
      />
    </>
  );
}
