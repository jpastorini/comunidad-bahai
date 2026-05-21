"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";

export async function selectLocalityAction(formData: FormData) {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const locality_id = formData.get("locality_id") as string;
  const next = (formData.get("next") as string) || "/";
  if (!locality_id) {
    redirect("/seleccionar-localidad?error=missing");
  }

  // Verifica que la localidad exista y esté activa.
  const { data: locality } = await supabase
    .from("localities")
    .select("id, is_active, name")
    .eq("id", locality_id)
    .maybeSingle();

  if (!locality || !locality.is_active) {
    redirect("/seleccionar-localidad?error=missing");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ locality_id })
    .eq("id", user.id);

  if (error) {
    setFlashToast({ tone: "error", message: `Error: ${error.message}` });
    redirect("/seleccionar-localidad");
  }

  setFlashToast({
    tone: "success",
    message: `Localidad seleccionada: ${locality.name}.`,
  });

  // Revalida todo porque cambian los datos visibles según la localidad.
  revalidatePath("/", "layout");

  const safe = next.startsWith("/") ? next : "/";
  redirect(safe);
}
