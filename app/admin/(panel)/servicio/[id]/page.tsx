import { notFound } from "next/navigation";
import { FormShell, PageHeader } from "@/components/admin/ui";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { ServiceNeed } from "@/lib/types";
import { NeedForm } from "../need-form";

export default async function EditNeedPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("service_needs")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!data) notFound();
  return (
    <FormShell>
      <PageHeader eyebrow="Servicio" title="Editar necesidad" />
      <NeedForm need={data as ServiceNeed} />
    </FormShell>
  );
}
