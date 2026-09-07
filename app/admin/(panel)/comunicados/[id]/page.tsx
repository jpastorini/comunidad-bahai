import { notFound } from "next/navigation";
import { FormShell, PageHeader } from "@/components/admin/ui";
import { getPollCountsForMessages, getPollForMessage } from "@/lib/polls";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Message } from "@/lib/types";
import { ComunicadoForm } from "../comunicado-form";

export default async function EditComunicadoPage({
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
  const comunicado = data as Message;

  // La encuesta (051), si tiene, y cuántos votaron: con votos, la
  // pregunta y las opciones se muestran congeladas.
  const [poll, counts] = await Promise.all([
    getPollForMessage(comunicado.id),
    getPollCountsForMessages([comunicado.id]),
  ]);

  return (
    <FormShell>
      <PageHeader back={{ href: "/admin/comunicados", label: "Comunicados" }}
        eyebrow="Comunicación"
        title="Editar comunicado"
        description={comunicado.title}
      />
      <ComunicadoForm
        comunicado={comunicado}
        poll={poll}
        pollParticipants={counts?.get(comunicado.id)?.participants ?? 0}
      />
    </FormShell>
  );
}
