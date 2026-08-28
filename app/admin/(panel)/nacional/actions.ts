"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { localityTag, requireNationalAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";

// ── Localidades ──────────────────────────────────────────────────
export async function upsertLocalityAction(formData: FormData) {
  await requireNationalAdmin();
  const supabase = createSupabaseServer();

  const id = formData.get("id") as string | null;
  const payload = {
    name: ((formData.get("name") as string) || "").trim(),
    city: ((formData.get("city") as string) || "").trim() || null,
    country:
      ((formData.get("country") as string) || "").trim() || "Uruguay",
    description:
      ((formData.get("description") as string) || "").trim() || null,
    is_active: formData.get("is_active") === "on",
  };

  if (!payload.name) {
    setFlashToast({ tone: "error", message: "El nombre es obligatorio." });
    redirect("/admin/nacional/localidades");
  }

  const { error } = id
    ? await supabase.from("localities").update(payload).eq("id", id)
    : await supabase.from("localities").insert(payload);

  setFlashToast(
    error
      ? { tone: "error", message: `Error: ${error.message}` }
      : { tone: "success", message: id ? "Localidad actualizada." : "Localidad creada." }
  );

  // La localidad se sirve desde el Data Cache en cada página (ver
  // getLocality en lib/auth.ts); sin esto, el cambio de nombre tardaría
  // hasta una hora en verse.
  if (id) revalidateTag(localityTag(id));
  revalidatePath("/admin/nacional/localidades");
  revalidatePath("/seleccionar-localidad");
  redirect("/admin/nacional/localidades");
}

export async function deleteLocalityAction(formData: FormData) {
  await requireNationalAdmin();
  const supabase = createSupabaseServer();
  const id = formData.get("id") as string;
  if (!id) redirect("/admin/nacional/localidades");

  // Verificación previa: bloquear si tiene datos.
  const { count: profileCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("locality_id", id);

  if ((profileCount ?? 0) > 0) {
    setFlashToast({
      tone: "error",
      message: `No se puede borrar: ${profileCount} creyentes aún la usan. Reasígnalos primero.`,
    });
    redirect("/admin/nacional/localidades");
  }

  const { error } = await supabase.from("localities").delete().eq("id", id);
  setFlashToast(
    error
      ? { tone: "error", message: `Error: ${error.message}` }
      : { tone: "success", message: "Localidad eliminada." }
  );
  revalidateTag(localityTag(id));
  revalidatePath("/admin/nacional/localidades");
  redirect("/admin/nacional/localidades");
}

// ── Miembros (asignar localidad / roles) ─────────────────────────
export async function updateMemberLocalityAction(formData: FormData) {
  await requireNationalAdmin();
  const supabase = createSupabaseServer();

  const id = formData.get("id") as string;
  if (!id) redirect("/admin/nacional/miembros");

  const localityRaw = formData.get("locality_id") as string;
  const locality_id = localityRaw && localityRaw !== "" ? localityRaw : null;
  const role = formData.get("role") === "admin" ? "admin" : "member";
  const is_national_admin = formData.get("is_national_admin") === "on";
  const can_respond_chat = formData.get("can_respond_chat") === "on";
  const can_manage_treasury = formData.get("can_manage_treasury") === "on";

  const { error } = await supabase
    .from("profiles")
    .update({
      locality_id,
      role,
      is_national_admin,
      can_respond_chat,
      can_manage_treasury,
    })
    .eq("id", id);

  setFlashToast(
    error
      ? { tone: "error", message: `Error: ${error.message}` }
      : { tone: "success", message: "Creyente actualizado." }
  );

  revalidatePath("/admin/nacional/miembros");
  revalidatePath("/admin/miembros");
  redirect("/admin/nacional/miembros");
}
