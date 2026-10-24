"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { localityTag, requireAdmin } from "@/lib/auth";
import { sendPushToUsers } from "@/lib/push";
import { isStructureCandidate, isStructuresSchemaMissing } from "@/lib/structures";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { setFlashToast } from "@/lib/toast";
import {
  isStructureLocality,
  STRUCTURE_TYPES,
  type Locality,
  type StructureType,
} from "@/lib/types";

const BACK = "/admin/estructuras";

/**
 * Crear estructuras y nombrar integrantes es de la Asamblea que las crea
 * (decidido con el usuario el 2026-10-24): un admin con la AEL o la
 * Comunidad Nacional puesta. Desde una estructura no se gestiona ninguna,
 * ni siquiera la propia.
 *
 * Todo escribe con service-role: `localities` solo la escribe el admin
 * nacional (012) y `profile_localities` solo la Asamblea de la localidad
 * PUESTA (055). El permiso se chequea acá, antes de cada escritura.
 */
async function requireParentAssembly() {
  const session = await requireAdmin();
  if (isStructureLocality(session.locality)) {
    setFlashToast({
      tone: "error",
      message: "Las estructuras las gestiona la Asamblea que las creó.",
    });
    redirect(BACK);
  }
  const admin = createSupabaseAdmin();
  if (!admin) {
    setFlashToast({ tone: "error", message: "El servidor no está configurado para esto." });
    redirect(BACK);
  }
  return { session, admin };
}

function fail(message: string): never {
  setFlashToast({ tone: "error", message });
  redirect(BACK);
}

function dbError(code: string | undefined, message: string): never {
  if (isStructuresSchemaMissing(code)) fail("Falta aplicar la migración 082 en la base.");
  if (code === "23505") fail("Ya hay una estructura con ese nombre en esta Asamblea.");
  fail(`No se pudo guardar: ${message}`);
}

function readType(formData: FormData): StructureType {
  const type = formData.get("structure_type") as StructureType;
  if (!STRUCTURE_TYPES.includes(type)) fail("Elegí qué tipo de estructura es.");
  return type;
}

/** La estructura, solo si es de la Asamblea puesta. */
async function loadOwnStructure(
  admin: NonNullable<ReturnType<typeof createSupabaseAdmin>>,
  parentId: string,
  id: string
): Promise<Locality> {
  const { data } = await admin
    .from("localities")
    .select("*")
    .eq("id", id)
    .eq("parent_id", parentId)
    .maybeSingle();
  if (!data) fail("Esa estructura no es de esta Asamblea.");
  return data as Locality;
}

export async function createStructureAction(formData: FormData) {
  const { session, admin } = await requireParentAssembly();
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) fail("Poné el nombre de la estructura.");
  const type = readType(formData);

  const { error } = await admin.from("localities").insert({
    name,
    kind: "estructura",
    parent_id: session.locality.id,
    structure_type: type,
    city: session.locality.city,
    country: session.locality.country,
    is_active: true,
  });
  if (error) dbError(error.code, error.message);

  setFlashToast({ tone: "success", message: `${name} quedó creada. Ahora sumale integrantes.` });
  revalidatePath(BACK);
  redirect(BACK);
}

export async function updateStructureAction(formData: FormData) {
  const { session, admin } = await requireParentAssembly();
  const id = (formData.get("id") as string) || "";
  await loadOwnStructure(admin, session.locality.id, id);
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) fail("Poné el nombre de la estructura.");
  const type = readType(formData);

  const { error } = await admin
    .from("localities")
    .update({ name, structure_type: type, is_active: formData.get("is_active") === "on" })
    .eq("id", id);
  if (error) dbError(error.code, error.message);

  // La localidad se sirve desde el Data Cache (getLocality en lib/auth.ts).
  revalidateTag(localityTag(id));
  setFlashToast({ tone: "success", message: "Estructura actualizada." });
  revalidatePath(BACK);
  redirect(BACK);
}

export async function addStructureMemberAction(formData: FormData) {
  const { session, admin } = await requireParentAssembly();
  const structureId = (formData.get("structure_id") as string) || "";
  const profileId = (formData.get("profile_id") as string) || "";
  const structure = await loadOwnStructure(admin, session.locality.id, structureId);
  if (!profileId) fail("Elegí a quién sumar.");
  if (!(await isStructureCandidate(session.locality, profileId))) {
    fail("Solo se pueden sumar creyentes de esta comunidad.");
  }

  // Todos los integrantes tienen rol de Asamblea en la estructura: es lo
  // que les abre el panel. La Tesorería, solo a quien la lleve.
  const { error } = await admin.from("profile_localities").upsert(
    {
      profile_id: profileId,
      locality_id: structureId,
      role: "admin",
      can_manage_treasury: formData.get("can_manage_treasury") === "on",
      can_respond_chat: false,
      can_manage_bulletin: false,
    },
    { onConflict: "profile_id,locality_id" }
  );
  if (error) fail(`No se pudo sumar: ${error.message}`);

  // El aviso lleva al perfil: ahí está la entrada al panel de la
  // estructura. El panel directo la echaría si tiene su comunidad puesta.
  await sendPushToUsers([profileId], {
    title: `Integrás ${structure.name}`,
    body: `${session.locality.name} te sumó. Abrí su panel desde tu perfil.`,
    url: "/perfil",
    tag: `estructura-${structureId}`,
  });

  setFlashToast({ tone: "success", message: "Integrante sumado." });
  revalidatePath(BACK);
  redirect(BACK);
}

export async function setStructureTreasuryAction(formData: FormData) {
  const { session, admin } = await requireParentAssembly();
  const structureId = (formData.get("structure_id") as string) || "";
  const profileId = (formData.get("profile_id") as string) || "";
  await loadOwnStructure(admin, session.locality.id, structureId);

  const { error } = await admin
    .from("profile_localities")
    .update({ can_manage_treasury: formData.get("value") === "on" })
    .eq("profile_id", profileId)
    .eq("locality_id", structureId);
  if (error) fail(`No se pudo guardar: ${error.message}`);

  revalidatePath(BACK);
  redirect(BACK);
}

export async function removeStructureMemberAction(formData: FormData) {
  const { session, admin } = await requireParentAssembly();
  const structureId = (formData.get("structure_id") as string) || "";
  const profileId = (formData.get("profile_id") as string) || "";
  await loadOwnStructure(admin, session.locality.id, structureId);

  // Si la tenía puesta, el trigger de la 082 le devuelve su comunidad.
  const { error } = await admin
    .from("profile_localities")
    .delete()
    .eq("profile_id", profileId)
    .eq("locality_id", structureId);
  if (error) fail(`No se pudo quitar: ${error.message}`);

  setFlashToast({ tone: "success", message: "Integrante quitado." });
  revalidatePath(BACK);
  redirect(BACK);
}
