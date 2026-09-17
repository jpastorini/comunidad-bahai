"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";

const AVATARS_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB pre-compresión

type Result = { ok: boolean; error: string | null };

/** Actualiza el nombre completo del usuario. */
export async function updateFullNameAction(formData: FormData): Promise<Result> {
  const session = await requireMember();
  const supabase = createSupabaseServer();
  const fullName = ((formData.get("full_name") as string) || "").trim();
  if (!fullName || fullName.length < 2) {
    return { ok: false, error: "El nombre debe tener al menos 2 caracteres." };
  }
  if (fullName.length > 80) {
    return { ok: false, error: "El nombre es demasiado largo." };
  }
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", session.user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/perfil");
  revalidatePath("/");
  return { ok: true, error: null };
}

/** Preferencias de recordatorios devocionales que el usuario puede tocar. */
export type DevotionalPref =
  | "prayer_reminder_enabled"
  | "daily_quote_push_enabled";

const DEVOTIONAL_PREFS: DevotionalPref[] = [
  "prayer_reminder_enabled",
  "daily_quote_push_enabled",
];

/**
 * Prende/apaga un recordatorio devocional del usuario.
 *
 * El nombre de la preferencia viene del cliente, así que se valida contra
 * la lista blanca: sin eso, la acción sería un update arbitrario de columnas
 * sobre la propia fila de profiles (role, tags, etc.).
 */
export async function setDevotionalPrefAction(
  pref: DevotionalPref,
  enabled: boolean
): Promise<Result> {
  const session = await requireMember();
  if (!DEVOTIONAL_PREFS.includes(pref)) {
    return { ok: false, error: "Preferencia desconocida." };
  }
  const supabase = createSupabaseServer();
  const { error } = await supabase
    .from("profiles")
    .update({ [pref]: enabled })
    .eq("id", session.user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/perfil");
  return { ok: true, error: null };
}

/** Sube un avatar manual al bucket y actualiza el perfil. */
export async function uploadAvatarAction(formData: FormData): Promise<Result> {
  const session = await requireMember();
  const supabase = createSupabaseServer();
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    return { ok: false, error: "Seleccioná una foto." };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "El archivo debe ser una imagen." };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return {
      ok: false,
      error: `La imagen supera los ${Math.round(MAX_AVATAR_BYTES / (1024 * 1024))} MB.`,
    };
  }

  // Borrar avatares anteriores del usuario (limpia la carpeta).
  const { data: existing } = await supabase.storage
    .from(AVATARS_BUCKET)
    .list(session.user.id);
  if (existing && existing.length > 0) {
    await supabase.storage
      .from(AVATARS_BUCKET)
      .remove(existing.map((f) => `${session.user.id}/${f.name}`));
  }

  const ext = (file.name.split(".").pop() || "jpg")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 4) || "jpg";
  const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    return { ok: false, error: `Error al subir: ${uploadError.message}` };
  }

  const { data: pub } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: pub.publicUrl })
    .eq("id", session.user.id);
  if (updateError) {
    await supabase.storage.from(AVATARS_BUCKET).remove([path]);
    return { ok: false, error: updateError.message };
  }

  revalidatePath("/perfil");
  revalidatePath("/");
  return { ok: true, error: null };
}

/**
 * Sincroniza el avatar del perfil con la foto actual de Google
 * (lo que está en auth.users.raw_user_meta_data).
 * Si el usuario tenía un avatar manual subido, lo borra del storage.
 */
export async function useGoogleAvatarAction(): Promise<Result> {
  const session = await requireMember();
  const supabase = createSupabaseServer();

  const { data: userResp } = await supabase.auth.getUser();
  const meta = (userResp.user?.user_metadata ?? {}) as Record<string, unknown>;
  const googleUrl =
    (typeof meta.avatar_url === "string" && meta.avatar_url) ||
    (typeof meta.picture === "string" && meta.picture) ||
    null;

  if (!googleUrl) {
    return {
      ok: false,
      error:
        "No encontramos una foto de Google en tu cuenta. Probá iniciar sesión con Google primero.",
    };
  }

  // Limpiar avatar manual previo si existía.
  const { data: existing } = await supabase.storage
    .from(AVATARS_BUCKET)
    .list(session.user.id);
  if (existing && existing.length > 0) {
    await supabase.storage
      .from(AVATARS_BUCKET)
      .remove(existing.map((f) => `${session.user.id}/${f.name}`));
  }

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: googleUrl })
    .eq("id", session.user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/perfil");
  revalidatePath("/");
  return { ok: true, error: null };
}

/** Quita el avatar (vuelve a iniciales). */
export async function removeAvatarAction(): Promise<Result> {
  const session = await requireMember();
  const supabase = createSupabaseServer();

  const { data: existing } = await supabase.storage
    .from(AVATARS_BUCKET)
    .list(session.user.id);
  if (existing && existing.length > 0) {
    await supabase.storage
      .from(AVATARS_BUCKET)
      .remove(existing.map((f) => `${session.user.id}/${f.name}`));
  }

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", session.user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/perfil");
  revalidatePath("/");
  return { ok: true, error: null };
}


/**
 * Cambiar de comunidad activa (migración 055).
 *
 * Solo entre las comunidades a las que la persona YA pertenece:
 * switch_locality() lo verifica contra `profile_localities` y falla con
 * SIN_MEMBRESIA si no. Va por RPC y no por UPDATE porque
 * `profiles_update_self` (039) congela `locality_id`, `role` y los tags
 * para el propio usuario, y tiene que seguir congelándolos: sin eso, un
 * PATCH por PostgREST a la propia fila sería una escalada de privilegios.
 *
 * ⚠️ El revalidatePath de la raíz no es opcional. Las pantallas ya
 * visitadas viven en el caché del router del navegador (staleTimes en
 * next.config.mjs): sin tirarlo abajo, cambiás de comunidad y seguís
 * viendo los comunicados y el calendario de la anterior.
 */
export async function switchLocalityAction(formData: FormData) {
  await requireMember();
  const supabase = createSupabaseServer();
  const localityId = (formData.get("locality_id") as string) || "";
  // A dónde volver: el panel si el cambio se hizo desde el panel, la app
  // si fue desde el Inicio. Se valida que empiece con "/" y que no sea
  // "//": un destino de afuera acá sería un redirect abierto.
  const requested = (formData.get("redirect_to") as string) || "/";
  const back =
    requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";
  if (!localityId) redirect(back);

  const { error } = await supabase.rpc("switch_locality", {
    p_locality_id: localityId,
  });

  if (error) {
    setFlashToast({
      tone: "error",
      message: `No se pudo cambiar de comunidad: ${error.message}`,
    });
    revalidatePath("/perfil");
    redirect(back);
  }

  setFlashToast({ tone: "success", message: "Listo, cambiaste de comunidad." });
  revalidatePath("/", "layout");
  redirect(back);
}
