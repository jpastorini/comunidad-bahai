import Link from "next/link";
import { notFound } from "next/navigation";
import { markConversationReadAction } from "@/app/admin/(panel)/chat/actions";
import { Conversation } from "@/components/admin/chat/Conversation";
import { ContactReachNote } from "@/components/admin/chat/ContactReachNote";
import { Banner, PageHeader } from "@/components/admin/ui";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { contactBlockedReason, getContactReach } from "@/lib/chat-contact";
import { chatFailure } from "@/lib/chat-errors";
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

  const { data: member, error: memberError } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", params.memberId)
    .maybeSingle();
  // Solo es notFound si la consulta anduvo y no hay fila; si falló, un 404
  // diría que el creyente no existe y no es eso lo que pasó.
  const memberFailure = chatFailure(
    "member(tesoreria)",
    memberError,
    "No pudimos cargar los datos del creyente."
  );
  if (!member && !memberFailure) notFound();

  const { data: messages, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("member_id", params.memberId)
    .eq("topic", "tesoreria")
    .order("created_at", { ascending: true });
  const loadError = chatFailure(
    "conversation(tesoreria)",
    error,
    "No pudimos cargar la conversación. Recargá la página en un momento."
  );

  // Best-effort: mark inbound messages as read.
  await markConversationReadAction(params.memberId, "tesoreria");

  // La conversación puede abrirse vacía: la inicia la Asamblea desde
  // Creyentes, el informe de lectura o Compromisos (lib/chat-contact.ts).
  const isEmpty = !loadError && (messages ?? []).length === 0;
  const [reach, blockedReason] = member
    ? await Promise.all([
        getContactReach(params.memberId),
        contactBlockedReason(
          supabase,
          params.memberId,
          session.locality.id,
          "tesoreria",
          !isEmpty
        ),
      ])
    : [null, null];

  return (
    <>
      <PageHeader back={{ href: "/admin/tesoreria/chat", label: "Mensajes" }}
        eyebrow={member?.email ?? "Tesorería"}
        title={member?.full_name ?? "Creyente"}
        description="Conversación privada con el tesorero. Tus respuestas salen firmadas con tu nombre."
        actions={
          // El alta sale prellenada con este creyente: usa o crea su
          // contribuyente vinculado, así el aporte le aparece en Mis aportes
          // y le llega el aviso con el recibo.
          <Link
            href={`/admin/tesoreria/libro?creyente=${encodeURIComponent(params.memberId)}`}
            className="rounded-xl bg-terra px-4 py-2 text-[13px] font-semibold text-white shadow-card-soft"
          >
            Registrar en el libro
          </Link>
        }
      />
      {(memberFailure || loadError) && (
        <div className="mb-4">
          <Banner tone="danger">{memberFailure ?? loadError}</Banner>
        </div>
      )}
      {member && !blockedReason && (
        <ContactReachNote
          reach={reach}
          name={member.full_name ?? ""}
          isEmpty={isEmpty}
        />
      )}
      <Conversation
        memberId={params.memberId}
        adminId={session.user.id}
        adminName={session.profile.full_name}
        topic="tesoreria"
        initialMessages={(messages ?? []) as ChatMessage[]}
        blockedReason={blockedReason}
      />
    </>
  );
}
