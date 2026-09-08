import { notFound } from "next/navigation";
import { FormShell, PageHeader } from "@/components/admin/ui";
import { getPollCountsForMessages, getPollForMessage } from "@/lib/polls";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Message } from "@/lib/types";
import { EncuestaForm } from "../../encuesta-form";

export default async function EditarEncuestaPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("id", params.id)
    .eq("source", "asamblea_local")
    .maybeSingle();
  if (!data) notFound();
  const message = data as Message;

  const [poll, counts] = await Promise.all([
    getPollForMessage(message.id),
    getPollCountsForMessages([message.id]),
  ]);
  if (!poll) notFound();

  return (
    <FormShell>
      <PageHeader
        back={{ href: `/admin/encuestas/${message.id}`, label: "Resultados" }}
        eyebrow="Comunicación"
        title="Editar encuesta"
        description={poll.question}
      />
      <EncuestaForm
        message={message}
        poll={poll}
        pollParticipants={counts?.get(message.id)?.participants ?? 0}
      />
    </FormShell>
  );
}
