import { notFound } from "next/navigation";
import { Conversation } from "@/components/admin/chat/Conversation";
import { Banner, PageHeader } from "@/components/admin/ui";
import { ensureChatTag, requireAdmin } from "@/lib/auth";
import { chatFailure } from "@/lib/chat-errors";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { ChatMessage } from "@/lib/types";
import { markConversationReadAction } from "../actions";

export default async function ConversationPage({
  params,
}: {
  params: { memberId: string };
}) {
  const session = await requireAdmin();
  ensureChatTag(session.profile);
  const supabase = createSupabaseServer();

  const { data: member, error: memberError } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", params.memberId)
    .maybeSingle();
  // Un 404 diría "este creyente no existe" cuando lo que pasó es que no
  // se pudo leer. Solo es notFound si la consulta anduvo y no hay fila.
  const memberFailure = chatFailure(
    "member(secretaria)",
    memberError,
    "No pudimos cargar los datos del creyente."
  );
  if (!member && !memberFailure) notFound();

  const { data: messages, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("member_id", params.memberId)
    .eq("topic", "secretaria")
    .order("created_at", { ascending: true });
  const loadError = chatFailure(
    "conversation(secretaria)",
    error,
    "No pudimos cargar la conversación. Recargá la página en un momento."
  );

  // Best-effort: mark inbound messages as read.
  await markConversationReadAction(params.memberId, "secretaria");

  return (
    <>
      <PageHeader
        eyebrow={member?.email ?? "Conversación"}
        title={member?.full_name ?? "Creyente"}
        description="Este chat solo lo ve este creyente. Tus respuestas salen firmadas con tu nombre."
      />
      {(memberFailure || loadError) && (
        <div className="mb-4">
          <Banner tone="danger">{memberFailure ?? loadError}</Banner>
        </div>
      )}
      <Conversation
        memberId={params.memberId}
        adminId={session.user.id}
        adminName={session.profile.full_name}
        topic="secretaria"
        initialMessages={(messages ?? []) as ChatMessage[]}
      />
    </>
  );
}
