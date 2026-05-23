"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

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
