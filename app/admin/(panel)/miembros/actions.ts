"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  isPermission,
  permissionAvailable,
  permissionsSentence,
  type Permission,
} from "@/lib/delegations";
import { todayMontevideo } from "@/lib/delegations-server";
import { sendPushToUsers } from "@/lib/push";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import { isNationalLocality, isStructureLocality } from "@/lib/types";
import { setFlashToast } from "@/lib/toast";

export async function updateMemberAction(formData: FormData) {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();

  const id = formData.get("id") as string;
  if (!id) redirect("/admin/miembros");

  const payload: {
    can_respond_chat: boolean;
    can_manage_treasury: boolean;
    full_name: string | null;
    role?: "member" | "admin";
    is_bahai?: boolean;
  } = {
    can_respond_chat: formData.get("can_respond_chat") === "on",
    can_manage_treasury: formData.get("can_manage_treasury") === "on",
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
        payload.can_manage_treasury)
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
  //
  // ⚠️ El ORDEN de las dos escrituras depende de hacia dónde cambia la
  // condición. Un Amigo/a de la Fe no puede tener cargos (trigger de la
  // 055), así que al habilitar a alguien como creyente Y darle un permiso
  // en el mismo guardado, primero tiene que ser creyente; al pasarlo a
  // Amigo/a, primero se le sacan los cargos. Desde la 070 todos entran
  // como Amigo/a, así que el primer caso es el de todos los días.
  const writeProfile = () =>
    supabase
      .from("profiles")
      .update({
        full_name: payload.full_name,
        ...(payload.is_bahai === undefined ? {} : { is_bahai: payload.is_bahai }),
      })
      .eq("id", id);
  const early = payload.is_bahai === true ? await writeProfile() : null;

  const { error: membershipError } = await supabase
    .from("profile_localities")
    .upsert(
      {
        profile_id: id,
        locality_id: session.locality.id,
        can_respond_chat: payload.can_respond_chat,
        can_manage_treasury: payload.can_manage_treasury,
        // El rol viaja solo cuando NO es tu propia ficha (ver arriba).
        ...(payload.role ? { role: payload.role } : {}),
      },
      { onConflict: "profile_id,locality_id" }
    );

  // Lo que es de la persona y no de la comunidad sigue en `profiles`.
  const { error: profileError } = early ?? (await writeProfile());

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
 * Nombra (o saca) a un creyente como ayudante de la Asamblea (088): qué
 * secciones del panel puede usar y hasta cuándo. Las casillas son la lista
 * entera: lo que no viene marcado se saca. Un solo "hasta" para todo.
 */
export async function setHelperAction(formData: FormData) {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();
  const id = formData.get("id") as string;
  if (!id) redirect("/admin/miembros");

  const done = (tone: "success" | "error", message: string): never => {
    setFlashToast({ tone, message });
    revalidatePath("/admin/miembros");
    redirect("/admin/miembros");
  };

  if (isStructureLocality(session.locality)) {
    done("error", "Una estructura no nombra ayudantes: elige a sus integrantes.");
  }

  // Lo que no existe en la Comunidad Nacional no se encarga ahí (aelOnly).
  const national = isNationalLocality(session.locality);
  const perms = Array.from(new Set(formData.getAll("perm").filter(isPermission))).filter(
    (p) => permissionAvailable(p, national)
  );
  const untilRaw = String(formData.get("until") ?? "").trim();
  const until = /^\d{4}-\d{2}-\d{2}$/.test(untilRaw) ? untilRaw : null;
  if (until && perms.length > 0 && until < todayMontevideo()) {
    done("error", "Esa fecha ya pasó: el nombramiento quedaría vencido.");
  }

  const { data: person } = await supabase
    .from("profiles")
    .select("full_name, is_bahai")
    .eq("id", id)
    .maybeSingle();
  if (perms.length > 0 && person && !person.is_bahai) {
    done(
      "error",
      "Un Amigo/a de la Fe no puede ser ayudante de la Asamblea. Marcalo como creyente primero."
    );
  }

  const { data: current, error: readError } = await supabase
    .from("delegations")
    .select("permission")
    .eq("profile_id", id)
    .eq("locality_id", session.locality.id);
  if (readError) {
    done(
      "error",
      readError.code === "42P01" || readError.code === "PGRST205"
        ? "Falta aplicar la migración 088 en la base."
        : `Error: ${readError.message}`
    );
  }
  const had = new Set((current ?? []).map((r) => r.permission as Permission));
  const removed = Array.from(had).filter((p) => !perms.includes(p));
  const kept = perms.filter((p) => had.has(p));
  const added = perms.filter((p) => !had.has(p));
  const mine = () => ({ profile_id: id, locality_id: session.locality.id });

  if (removed.length > 0) {
    const { error } = await supabase
      .from("delegations")
      .delete()
      .match(mine())
      .in("permission", removed);
    if (error) done("error", `Error: ${error.message}`);
  }
  if (kept.length > 0) {
    // Cambiar el "hasta" no cambia quién lo nombró ni cuándo.
    const { error } = await supabase
      .from("delegations")
      .update({ until })
      .match(mine())
      .in("permission", kept);
    if (error) done("error", `Error: ${error.message}`);
  }
  if (added.length > 0) {
    const { error } = await supabase.from("delegations").insert(
      added.map((permission) => ({
        ...mine(),
        permission,
        until,
        granted_by: session.user.id,
      }))
    );
    if (error) done("error", `Error: ${error.message}`);

    // Un push que falla no deshace el nombramiento.
    await sendPushToUsers([id], {
      title: "Te nombraron ayudante de la Asamblea",
      body: `${session.locality.name}: ${permissionsSentence(added)}. Lo abrís desde tu perfil.`,
      url: "/perfil",
      tag: "helper-granted",
    });
  }

  const name = person?.full_name?.split(" ")[0] || "La persona";
  const untilText = until ? ` hasta el ${until.split("-").reverse().join("/")}` : "";
  done(
    "success",
    perms.length > 0
      ? `${name} es ayudante: ${permissionsSentence(perms)}${untilText}.`
      : had.size > 0
        ? `${name} ya no es ayudante.`
        : "Sin cambios."
  );
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

/**
 * La Asamblea Nacional carga o corrige la agrupación de alguien de la
 * Comunidad Nacional (086). Es la misma columna que la persona elige en
 * su perfil (`profiles.agrupacion_id`); se escribe con service-role
 * porque la policy de `profiles` solo deja tocar la propia fila. Si la
 * persona además es de una Asamblea Local, manda la de esa Asamblea.
 */
export async function setMemberAgrupacionAction(formData: FormData) {
  const session = await requireAdmin();
  const back = "/admin/miembros";
  if (!isNationalLocality(session.locality)) redirect(back);

  const id = (formData.get("id") as string) || "";
  const value = (formData.get("agrupacion_id") as string) || null;

  // Solo a alguien de la Comunidad Nacional: la RLS de membresías deja ver
  // las de la comunidad puesta.
  const supabase = createSupabaseServer();
  const { data: membership } = await supabase
    .from("profile_localities")
    .select("profile_id")
    .eq("profile_id", id)
    .eq("locality_id", session.locality.id)
    .maybeSingle();
  const admin = createSupabaseAdmin();
  if (!membership || !admin) {
    setFlashToast({ tone: "error", message: "No se pudo guardar la agrupación." });
    redirect(back);
  }

  const { error } = await admin.from("profiles").update({ agrupacion_id: value }).eq("id", id);
  setFlashToast(
    error
      ? { tone: "error", message: `No se pudo guardar: ${error.message}` }
      : { tone: "success", message: "Agrupación guardada." }
  );
  revalidatePath(back);
  redirect(`${back}#m-${id}`);
}
