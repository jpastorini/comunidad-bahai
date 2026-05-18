"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";

export async function upsertNeedAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseServer();

  const id = formData.get("id") as string | null;
  const payload = {
    title: formData.get("title") as string,
    description: formData.get("description") as string,
    urgency: formData.get("urgency") as string,
  };

  if (!payload.title || !payload.urgency) {
    setFlashToast({ tone: "error", message: "Faltan campos obligatorios." });
    redirect("/admin/servicio");
  }

  const { error } = id
    ? await supabase.from("service_needs").update(payload).eq("id", id)
    : await supabase.from("service_needs").insert(payload);

  setFlashToast(
    error
      ? { tone: "error", message: `Error: ${error.message}` }
      : { tone: "success", message: id ? "Necesidad actualizada." : "Necesidad publicada." }
  );

  revalidatePath("/admin/servicio");
  revalidatePath("/servicio");
  redirect("/admin/servicio");
}

export async function deleteNeedAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseServer();
  const id = formData.get("id") as string;
  if (id) {
    const { error } = await supabase.from("service_needs").delete().eq("id", id);
    setFlashToast(
      error
        ? { tone: "error", message: `No se pudo borrar: ${error.message}` }
        : { tone: "success", message: "Necesidad borrada." }
    );
  }
  revalidatePath("/admin/servicio");
  revalidatePath("/servicio");
}
