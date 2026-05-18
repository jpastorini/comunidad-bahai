import { notFound } from "next/navigation";
import { FormShell, PageHeader } from "@/components/admin/ui";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Message } from "@/lib/types";
import { MessageForm } from "../message-form";

export default async function EditMessagePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("id", params.id)
    .eq("source", "casa_universal")
    .maybeSingle();

  if (!data) notFound();
  const message = data as Message;

  return (
    <FormShell>
      <PageHeader
        eyebrow="Casa Universal de Justicia"
        title="Editar mensaje"
        description={message.title}
      />
      <MessageForm message={message} />
    </FormShell>
  );
}
