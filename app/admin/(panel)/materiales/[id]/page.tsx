import { notFound } from "next/navigation";
import { FormShell, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { StudyMaterial } from "@/lib/types";
import { MaterialForm } from "../material-form";

export const revalidate = 60;

export default async function EditMaterialPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("study_materials")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();

  return (
    <FormShell>
      <PageHeader eyebrow="Estudio" title="Editar material" />
      <MaterialForm material={data as StudyMaterial} />
    </FormShell>
  );
}
