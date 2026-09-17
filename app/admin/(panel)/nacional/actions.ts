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
  const session = await requireNationalAdmin();
  const supabase = createSupabaseServer();

  const id = formData.get("id") as string;
  if (!id) redirect("/admin/nacional/miembros");

  const localityRaw = formData.get("locality_id") as string;
  const locality_id = localityRaw && localityRaw !== "" ? localityRaw : null;

  const membership: {
    can_respond_chat: boolean;
    can_manage_treasury: boolean;
    role?: "member" | "admin";
  } = {
    can_respond_chat: formData.get("can_respond_chat") === "on",
    can_manage_treasury: formData.get("can_manage_treasury") === "on",
  };

  // ⚠️ Mismo motivo que en /admin/miembros: el rol y el flag de Nacional
  // vienen `disabled` para tu propia ficha, y un control disabled no se
  // envía. Derivarlos de un campo ausente te degradaba solo al guardar.
  let isNationalAdmin: boolean | undefined;
  if (id !== session.user.id) {
    membership.role = formData.get("role") === "admin" ? "admin" : "member";
    isNationalAdmin = formData.get("is_national_admin") === "on";
  }

  // Dónde está hoy, para saber si esto es una mudanza.
  const { data: target } = await supabase
    .from("profiles")
    .select("locality_id")
    .eq("id", id)
    .maybeSingle();
  const currentLocality = (target?.locality_id as string | null) ?? null;

  let error: { message: string } | null = null;

  // ── La comunidad principal ──
  // Desde la 055 esto es una MEMBRESÍA, no una columna. move_membership()
  // suma la destino y saca la de origen (y deja intacta la Nacional, si
  // la persona también pertenece a ella).
  if (locality_id && locality_id !== currentLocality) {
    const { error: moveError } = await supabase.rpc("move_membership", {
      p_profile: id,
      p_from_locality: currentLocality,
      p_to_locality: locality_id,
    });
    error = moveError;
  } else if (!locality_id && currentLocality) {
    // "— Sin asignar —": se va de esa comunidad. Antes esto vaciaba
    // `profiles.locality_id`; el equivalente con membresías es sacarle
    // la fila, y el trigger de la 055 le pone el sombrero de otra
    // comunidad si le queda alguna (la Nacional, por ejemplo) o lo deja
    // en "todavía no eligió".
    const { error: leaveError } = await supabase
      .from("profile_localities")
      .delete()
      .eq("profile_id", id)
      .eq("locality_id", currentLocality);
    error = leaveError;
  }

  // ── El rol y los tags, en la membresía de esa comunidad ──
  if (!error && locality_id) {
    const { error: memberError } = await supabase
      .from("profile_localities")
      .upsert(
        { profile_id: id, locality_id, ...membership },
        { onConflict: "profile_id,locality_id" }
      );
    error = memberError;
  }

  // ── Miembro de la Asamblea Nacional ──
  // Es una membresía en la Comunidad Nacional (056) con rol de Asamblea,
  // que se SUMA a la comunidad local: la persona pertenece a las dos y
  // cambia de sombrero desde su perfil. Esta es la única puerta para
  // asignarlo, porque la AEN todavía no tiene a nadie que la administre.
  if (!error && id !== session.user.id) {
    const { data: national } = await supabase
      .from("localities")
      .select("id")
      .eq("kind", "nacional")
      .maybeSingle();
    const nationalId = (national?.id as string | undefined) ?? null;
    if (nationalId) {
      const wants = formData.get("national_assembly") === "on";
      if (wants) {
        const { error: e } = await supabase
          .from("profile_localities")
          .upsert(
            { profile_id: id, locality_id: nationalId, role: "admin" },
            { onConflict: "profile_id,locality_id" }
          );
        error = e;
      } else if (locality_id !== nationalId) {
        const { error: e } = await supabase
          .from("profile_localities")
          .delete()
          .eq("profile_id", id)
          .eq("locality_id", nationalId);
        error = e;
      }
    }
  }

  // ── Lo que sigue siendo de la persona ──
  if (!error && isNationalAdmin !== undefined) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ is_national_admin: isNationalAdmin })
      .eq("id", id);
    error = profileError;
  }

  setFlashToast(
    error
      ? { tone: "error", message: `Error: ${error.message}` }
      : { tone: "success", message: "Creyente actualizado." }
  );

  revalidatePath("/admin/nacional/miembros");
  revalidatePath("/admin/miembros");
  redirect("/admin/nacional/miembros");
}
