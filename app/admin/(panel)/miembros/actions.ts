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
    is_bahai?: boolean;
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
  //
  // Lo mismo con la condición (047): el <Select> de "Condición" también
  // viene disabled en la propia ficha (un miembro de la Asamblea es
  // creyente por definición), así que se omite del payload.
  if (id !== session.user.id) {
    payload.role = formData.get("role") === "admin" ? "admin" : "member";
    payload.is_bahai = formData.get("condition") !== "amigo";

    // Un Amigo/a de la Fe no puede tener cargos. La base lo rechaza
    // igual (constraint profiles_amigo_sin_cargos), pero el mensaje de
    // un check constraint no le dice nada a quien está en el panel.
    if (
      !payload.is_bahai &&
      (payload.role === "admin" ||
        payload.can_respond_chat ||
        payload.can_manage_treasury ||
        payload.can_manage_bulletin)
    ) {
      setFlashToast({
        tone: "error",
        message:
          "Un Amigo/a de la Fe no puede ser miembro de la Asamblea ni tener permisos especiales. Quitá el rol y los permisos, o marcalo como creyente.",
      });
      revalidatePath("/admin/miembros");
      redirect("/admin/miembros");
    }
  }
  // ⚠️ Desde la 055 el rol y los tags son POR COMUNIDAD y viven en
  // `profile_localities`; `profiles` guarda solo el sombrero puesto. La
  // Asamblea edita la membresía de SU localidad y el trigger de
  // sincronización la copia a `profiles` cuando esa es la comunidad que
  // la persona tiene puesta. Escribir `profiles` directo, como antes,
  // le cambiaría los permisos de la comunidad equivocada a quien anda
  // con dos sombreros.
  const { error: membershipError } = await supabase
    .from("profile_localities")
    .upsert(
      {
        profile_id: id,
        locality_id: session.locality.id,
        can_respond_chat: payload.can_respond_chat,
        can_manage_treasury: payload.can_manage_treasury,
        can_manage_bulletin: payload.can_manage_bulletin,
        // El rol viaja solo cuando NO es tu propia ficha (ver arriba).
        ...(payload.role ? { role: payload.role } : {}),
      },
      { onConflict: "profile_id,locality_id" }
    );

  // Lo que es de la persona y no de la comunidad sigue en `profiles`.
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: payload.full_name,
      ...(payload.is_bahai === undefined ? {} : { is_bahai: payload.is_bahai }),
    })
    .eq("id", id);

  const error = membershipError ?? profileError;

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
export async function regenerateInviteAction(formData: FormData) {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();

  // Cuál de los dos links (047): el de creyentes o el de Amigos de la Fe.
  // Cada uno se regenera por separado; el otro sigue valiendo.
  const column =
    formData.get("which") === "amigos" ? "friends_token" : "token";

  // Mismo formato que el default de la DB: 64 hex chars.
  const token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
  const { error } = await supabase
    .from("locality_invites")
    .update({
      [column]: token,
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
    .select("id, user_id, from_locality_id, to_locality_id, status")
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
    // move_membership() (055) suma la comunidad destino y saca la de
    // origen. No se puede hacer con dos consultas desde acá: la RLS de
    // `profile_localities` solo deja tocar filas de la propia
    // localidad, así que la Asamblea destino nunca podría borrar la
    // membresía de la comunidad de la que se va.
    const { error: profileError } = await supabase.rpc("move_membership", {
      p_profile: req.user_id,
      p_from_locality: req.from_locality_id,
      p_to_locality: req.to_locality_id,
    });
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
