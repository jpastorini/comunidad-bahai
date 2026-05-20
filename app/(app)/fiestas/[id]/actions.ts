"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function submitSuggestionAction(formData: FormData) {
  const feastId = formData.get("feast_id") as string;
  const detail = (formData.get("detail") as string)?.trim();

  if (!feastId) redirect("/fiestas");
  if (!detail) redirect(`/fiestas/${feastId}?sent=0`);

  const session = await requireMember(`/fiestas/${feastId}`);
  const supabase = createSupabaseServer();
  await supabase.from("feast_suggestions").insert({
    feast_id: feastId,
    user_id: session.user.id,
    detail,
  });

  revalidatePath(`/fiestas/${feastId}`);
  revalidatePath(`/admin/fiestas/${feastId}`);
  redirect(`/fiestas/${feastId}?sent=1`);
}
