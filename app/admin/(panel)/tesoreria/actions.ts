"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";

type Contribution = { label: string; amount: number };
type Method = { type: string; description: string; letter: string };

export async function saveTreasuryAction(formData: FormData) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);

  const id = formData.get("id") as string | null;
  const period = formData.get("period") as string;
  const goalAmount = parseFloat((formData.get("goal_amount") as string) || "0");
  const currentAmount = parseFloat(
    (formData.get("current_amount") as string) || "0"
  );

  // Repeating fields: contributions[label][i], contributions[amount][i]
  const contributions: Contribution[] = [];
  const labels = formData.getAll("contribution_label[]") as string[];
  const amounts = formData.getAll("contribution_amount[]") as string[];
  for (let i = 0; i < labels.length; i++) {
    if (labels[i]?.trim()) {
      contributions.push({
        label: labels[i].trim(),
        amount: parseFloat(amounts[i] || "0"),
      });
    }
  }

  const methods: Method[] = [];
  const mTypes = formData.getAll("method_type[]") as string[];
  const mDescs = formData.getAll("method_description[]") as string[];
  const mLetters = formData.getAll("method_letter[]") as string[];
  for (let i = 0; i < mTypes.length; i++) {
    if (mTypes[i]?.trim()) {
      methods.push({
        type: mTypes[i].trim(),
        description: (mDescs[i] || "").trim(),
        letter: (mLetters[i] || mTypes[i][0] || "?").trim().slice(0, 1).toUpperCase(),
      });
    }
  }

  const payload = {
    period,
    goal_amount: goalAmount,
    current_amount: currentAmount,
    contributions,
    methods,
    updated_at: new Date().toISOString(),
  };

  const supabase = createSupabaseServer();
  const { error } = id
    ? await supabase.from("treasury").update(payload).eq("id", id)
    : await supabase.from("treasury").insert(payload);

  setFlashToast(
    error
      ? { tone: "error", message: `Error: ${error.message}` }
      : { tone: "success", message: "Tesorería guardada." }
  );

  revalidatePath("/admin/tesoreria");
  revalidatePath("/tesoreria");
  redirect("/admin/tesoreria");
}
