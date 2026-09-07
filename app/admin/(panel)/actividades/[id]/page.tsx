import { notFound } from "next/navigation";
import { FormShell, PageHeader } from "@/components/admin/ui";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Activity } from "@/lib/types";
import { ActivityForm } from "../activity-form";

export default async function EditActivityPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("activities")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();

  return (
    <FormShell>
      <PageHeader back={{ href: "/admin/actividades", label: "Actividades" }} eyebrow="Vida comunitaria" title="Editar actividad" />
      <ActivityForm activity={data as Activity} />
    </FormShell>
  );
}
