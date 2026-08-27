import Link from "next/link";
import { notFound } from "next/navigation";
import { markConversationReadAction } from "@/app/admin/(panel)/chat/actions";
import { Conversation } from "@/components/admin/chat/Conversation";
import { PageHeader } from "@/components/admin/ui";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { ChatMessage } from "@/lib/types";

export default async function TreasuryConversationPage({
  params,
}: {
  params: { memberId: string };
}) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
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
    .eq("topic", "tesoreria")
    .order("created_at", { ascending: true });

  // Best-effort: mark inbound messages as read.
  await markConversationReadAction(params.memberId, "tesoreria");

  return (
    <>
      <PageHeader
        eyebrow={member.email ?? "Tesorería"}
        title={member.full_name ?? "Creyente"}
        description="Conversación privada con el tesorero. Tus respuestas salen firmadas con tu nombre."
        actions={
          <Link
            href="/admin/tesoreria/libro"
            className="rounded-xl bg-terra px-4 py-2 text-[13px] font-semibold text-white shadow-card-soft"
          >
            Registrar en el libro
          </Link>
        }
      />
      <Conversation
        memberId={params.memberId}
        adminId={session.user.id}
        adminName={session.profile.full_name}
        topic="tesoreria"
        initialMessages={(messages ?? []) as ChatMessage[]}
      />
    </>
  );
}
