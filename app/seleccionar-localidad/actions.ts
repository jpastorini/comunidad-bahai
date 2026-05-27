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

  // Verifica que la localidad destino exista y esté activa.
  const { data: locality } = await supabase
    .from("localities")
    .select("id, is_active, name")
    .eq("id", locality_id)
    .maybeSingle();

  if (!locality || !locality.is_active) {
    redirect("/seleccionar-localidad?error=missing");
  }

  // Perfil actual para saber si es primer ingreso o un cambio.
  const { data: profile } = await supabase
    .from("profiles")
    .select("locality_id, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const currentLocalityId = profile?.locality_id ?? null;

  // ─── Caso 1: ya está en esa misma localidad → no-op ───
  if (currentLocalityId === locality_id) {
    const safe = next.startsWith("/") ? next : "/";
    redirect(safe);
  }

  // ─── Caso 2: PRIMER ingreso (sin localidad) → directo ───
  if (!currentLocalityId) {
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
    revalidatePath("/", "layout");
    const safe = next.startsWith("/") ? next : "/";
    redirect(safe);
  }

  // ─── Caso 3: CAMBIO de localidad → requiere aprobación de la destino ───

  // Si ya hay una solicitud pendiente, no creamos otra.
  const { data: existingPending } = await supabase
    .from("locality_change_requests")
    .select("id, to_locality_id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (existingPending) {
    setFlashToast({
      tone: "error",
      message:
        "Ya tenés una solicitud de cambio pendiente. Cancelala antes de pedir otra.",
    });
    redirect("/perfil");
  }

  const { error: insertError } = await supabase
    .from("locality_change_requests")
    .insert({
      user_id: user.id,
      user_name: profile?.full_name || user.email || "Miembro",
      user_email: user.email,
      from_locality_id: currentLocalityId,
      to_locality_id: locality_id,
      status: "pending",
    });

  if (insertError) {
    setFlashToast({
      tone: "error",
      message: `No se pudo crear la solicitud: ${insertError.message}`,
    });
    redirect("/perfil");
  }

  setFlashToast({
    tone: "success",
    message: `Solicitud enviada a ${locality.name}. La Asamblea de esa comunidad debe aprobarla.`,
  });
  revalidatePath("/perfil");
  redirect("/perfil");
}

/** El usuario cancela su solicitud de cambio pendiente. */
export async function cancelLocalityChangeAction(formData: FormData) {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const requestId = formData.get("request_id") as string;
  if (requestId) {
    await supabase
      .from("locality_change_requests")
      .update({ status: "cancelled" })
      .eq("id", requestId)
      .eq("user_id", user.id)
      .eq("status", "pending");
    setFlashToast({ tone: "success", message: "Solicitud cancelada." });
  }
  revalidatePath("/perfil");
  redirect("/perfil");
}
