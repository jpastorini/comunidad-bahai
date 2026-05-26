import { notFound } from "next/navigation";
import { FormShell, PageHeader } from "@/components/admin/ui";
import { requireNationalAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { StudyMaterial } from "@/lib/types";
import { MaterialForm } from "../../../materiales/material-form";

export const revalidate = 60;

export default async function EditNacionalMaterialPage({
  params,
}: {
  params: { id: string };
}) {
  await requireNationalAdmin();
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("study_materials")
    .select("*")
    .eq("id", params.id)
    .is("locality_id", null)
    .maybeSingle();

  if (!data) notFound();

  return (
    <FormShell>
      <PageHeader
        eyebrow="Admin Nacional"
        title="Editar material nacional"
      />
      <MaterialForm material={data as StudyMaterial} national />
    </FormShell>
  );
}
