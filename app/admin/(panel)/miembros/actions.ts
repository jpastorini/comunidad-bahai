"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";

export async function updateMemberAction(formData: FormData) {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();

  const id = formData.get("id") as string;
  if (!id) redirect("/admin/miembros");

  const payload: {
    can_respond_chat: boolean;
    can_manage_treasury: boolean;
    can_manage_bulletin: boolean;
    full_name: string | null;
    role?: "member" | "admin";
  } = {
    can_respond_chat: formData.get("can_respond_chat") === "on",
    can_manage_treasury: formData.get("can_manage_treasury") === "on",
    can_manage_bulletin: formData.get("can_manage_bulletin") === "on",
    full_name: (formData.get("full_name") as string) || null,
  };

  // ⚠️ El propio rol NO se toca acá. El <Select> viene `disabled` cuando
  // editás tu ficha, y un control disabled NO se envía con el form: leerlo
  // devolvía null y el ternario lo colapsaba a "member", así que guardar
  // tus propios tags te degradaba de Asamblea a creyente sin decir nada.
  // La regla "no cambiás tu propio rol" vive en el server, no en el markup.
  if (id !== session.user.id) {
    payload.role = formData.get("role") === "admin" ? "admin" : "member";
  }
  const { error } = await supabase.from("profiles").update(payload).eq("id", id);

  setFlashToast(
    error
      ? { tone: "error", message: `Error: ${error.message}` }
      : { tone: "success", message: "Creyente actualizado." }
  );

  revalidatePath("/admin/miembros");
  redirect("/admin/miembros");
}

/**
 * Regenera el link de invitación de la localidad: token nuevo, el
 * anterior (y su QR impreso) dejan de funcionar al instante.
 */
export async function regenerateInviteAction(_formData: FormData) {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();

  // Mismo formato que el default de la DB: 64 hex chars.
  const token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
  const { error } = await supabase
    .from("locality_invites")
    .update({
      token,
      regenerated_at: new Date().toISOString(),
      regenerated_by: session.user.id,
    })
    .eq("locality_id", session.locality.id);

  setFlashToast(
    error
      ? { tone: "error", message: `Error: ${error.message}` }
      : {
          tone: "success",
          message: "Link regenerado. Compartí el nuevo — el anterior ya no sirve.",
        }
  );
  revalidatePath("/admin/miembros");
  redirect("/admin/miembros");
}

/**
 * Deshabilitar o reactivar un miembro de la comunidad (soft-disable).
 *
 * Marca/limpia `profiles.disabled_at`. Un miembro deshabilitado queda
 * bloqueado por el middleware (lo redirige a /cuenta-deshabilitada). No se
 * borra nada: es reversible.
 *
 * Reglas:
 *   - No podés deshabilitarte a vos mismo.
 *   - Solo miembros de TU localidad (la RLS de profiles no está scopeada por
 *     localidad — un admin puede tocar cualquier perfil — así que validamos
 *     acá).
 */
export async function setMemberDisabledAction(formData: FormData) {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();

  const id = formData.get("id") as string;
  const disable = formData.get("disable") === "1";
  if (!id) redirect("/admin/miembros");

  if (id === session.user.id) {
    setFlashToast({
      tone: "error",
      message: "No podés deshabilitar tu propia cuenta.",
    });
    revalidatePath("/admin/miembros");
    redirect("/admin/miembros");
  }

  // Validar pertenencia a la localidad del admin.
  const { data: target } = await supabase
    .from("profiles")
    .select("id, locality_id")
    .eq("id", id)
    .maybeSingle();

  if (!target || target.locality_id !== session.locality.id) {
    setFlashToast({
      tone: "error",
      message: "Ese creyente no pertenece a tu localidad.",
    });
    revalidatePath("/admin/miembros");
    redirect("/admin/miembros");
  }

  const { error } = await supabase
    .from("profiles")
    .update(
      disable
        ? { disabled_at: new Date().toISOString(), disabled_by: session.user.id }
        : { disabled_at: null, disabled_by: null }
    )
    .eq("id", id);

  setFlashToast(
    error
      ? { tone: "error", message: `Error: ${error.message}` }
      : {
          tone: "success",
          message: disable ? "Creyente deshabilitado." : "Creyente reactivado.",
        }
  );

  revalidatePath("/admin/miembros");
  redirect("/admin/miembros");
}

/**
 * Aprobar o rechazar una solicitud de cambio de localidad.
 * Solo la Asamblea DESTINO (cuyo current_locality_id == to_locality_id)
 * puede decidir — la RLS lo garantiza, pero validamos igual.
 *
 * Al aprobar: se actualiza profiles.locality_id del usuario al destino.
 */
export async function decideLocalityChangeAction(formData: FormData) {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();

  const requestId = formData.get("request_id") as string;
  const decision = formData.get("decision") as string; // 'approve' | 'reject'
  if (!requestId || (decision !== "approve" && decision !== "reject")) {
    redirect("/admin/miembros");
  }

  // Traer la solicitud y validar que sea hacia ESTA localidad.
  const { data: req } = await supabase
    .from("locality_change_requests")
    .select("id, user_id, to_locality_id, status")
    .eq("id", requestId)
    .maybeSingle();

  if (!req || req.status !== "pending") {
    setFlashToast({ tone: "error", message: "La solicitud ya no está pendiente." });
    revalidatePath("/admin/miembros");
    redirect("/admin/miembros");
  }

  if (req.to_locality_id !== session.locality.id) {
    setFlashToast({
      tone: "error",
      message: "Esa solicitud no es para tu localidad.",
    });
    revalidatePath("/admin/miembros");
    redirect("/admin/miembros");
  }

  const newStatus = decision === "approve" ? "approved" : "rejected";

  const { error: updateError } = await supabase
    .from("locality_change_requests")
    .update({
      status: newStatus,
      decided_by: session.user.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (updateError) {
    setFlashToast({ tone: "error", message: `Error: ${updateError.message}` });
    revalidatePath("/admin/miembros");
    redirect("/admin/miembros");
  }

  // Si se aprobó, mover al usuario a la localidad destino.
  if (decision === "approve") {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ locality_id: req.to_locality_id })
      .eq("id", req.user_id);
    if (profileError) {
      setFlashToast({
        tone: "error",
        message: `Solicitud aprobada pero no se pudo mover al creyente: ${profileError.message}`,
      });
      revalidatePath("/admin/miembros");
      redirect("/admin/miembros");
    }
  }

  setFlashToast({
    tone: "success",
    message:
      decision === "approve"
        ? "Solicitud aprobada — el creyente ahora pertenece a tu localidad."
        : "Solicitud rechazada.",
  });
  revalidatePath("/admin/miembros");
  redirect("/admin/miembros");
}
