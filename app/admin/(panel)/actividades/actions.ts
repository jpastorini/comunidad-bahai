"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";

export async function upsertActivityAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseServer();

  const id = formData.get("id") as string | null;
  const date = formData.get("date") as string;
  const time = formData.get("time") as string;

  const payload = {
    type: formData.get("type") as string,
    title: formData.get("title") as string,
    detail: formData.get("detail") as string,
    starts_at: `${date}T${time || "00:00"}:00`,
    place: formData.get("place") as string,
  };

  if (!payload.type || !payload.title || !date) {
    setFlashToast({ tone: "error", message: "Faltan campos obligatorios." });
    redirect("/admin/actividades");
  }

  const { error } = id
    ? await supabase.from("activities").update(payload).eq("id", id)
    : await supabase.from("activities").insert(payload);

  setFlashToast(
    error
      ? { tone: "error", message: `Error: ${error.message}` }
      : { tone: "success", message: id ? "Actividad actualizada." : "Actividad creada." }
  );

  revalidatePath("/admin/actividades");
  revalidatePath("/actividades");
  revalidatePath("/");
  redirect("/admin/actividades");
}

export async function deleteActivityAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseServer();
  const id = formData.get("id") as string;
  if (id) {
    const { error } = await supabase.from("activities").delete().eq("id", id);
    setFlashToast(
      error
        ? { tone: "error", message: `No se pudo borrar: ${error.message}` }
        : { tone: "success", message: "Actividad borrada." }
    );
  }
  revalidatePath("/admin/actividades");
  revalidatePath("/actividades");
}
