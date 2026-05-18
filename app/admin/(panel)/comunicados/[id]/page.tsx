import { notFound } from "next/navigation";
import { FormShell, PageHeader } from "@/components/admin/ui";
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

  return (
    <FormShell>
      <PageHeader
        eyebrow="Asamblea Espiritual Local"
        title="Editar comunicado"
        description={comunicado.title}
      />
      <ComunicadoForm comunicado={comunicado} />
    </FormShell>
  );
}
