"use server";

import { revalidatePath } from "next/cache";
import { deleteEventPhotoAction } from "@/components/gallery/photo-actions";
import { requireAdmin } from "@/lib/auth";
import { MAX_FEATURED_PER_EVENT } from "@/lib/event-photos";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";

type ToggleResult = { ok: boolean; error: string | null };

/** Destacar / quitar destacado. Tope de MAX_FEATURED_PER_EVENT por evento. */
export async function setPhotoFeaturedAction(
  photoId: string,
  featured: boolean
): Promise<ToggleResult> {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();

  const { data: photo } = await supabase
    .from("event_photos")
    .select("event_type, event_id, locality_id")
    .eq("id", photoId)
    .maybeSingle();

  if (!photo) return { ok: false, error: "Foto no encontrada." };
  if (photo.locality_id !== session.locality.id) {
    return { ok: false, error: "No tenés permiso sobre esta foto." };
  }

  if (featured) {
    const { count } = await supabase
      .from("event_photos")
      .select("id", { count: "exact", head: true })
      .eq("event_type", photo.event_type)
      .eq("event_id", photo.event_id)
      .eq("featured", true);
    if ((count ?? 0) >= MAX_FEATURED_PER_EVENT) {
      return {
        ok: false,
        error: `Máximo ${MAX_FEATURED_PER_EVENT} destacadas por evento. Quitá una antes de destacar otra.`,
      };
    }
  }

  const { error } = await supabase
    .from("event_photos")
    .update({ featured })
    .eq("id", photoId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/fotos");
  revalidatePath("/");
  return { ok: true, error: null };
}

/** Enviar / quitar del boletín nacional (visibility national ↔ locality). */
export async function setPhotoNationalAction(
  photoId: string,
  national: boolean
): Promise<ToggleResult> {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();

  const { data: photo } = await supabase
    .from("event_photos")
    .select("locality_id")
    .eq("id", photoId)
    .maybeSingle();

  if (!photo) return { ok: false, error: "Foto no encontrada." };
  if (photo.locality_id !== session.locality.id) {
    return { ok: false, error: "No tenés permiso sobre esta foto." };
  }

  const { error } = await supabase
    .from("event_photos")
    .update({ visibility: national ? "national" : "locality" })
    .eq("id", photoId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/fotos");
  revalidatePath("/boletin");
  return { ok: true, error: null };
}

/** Borrar una foto (reusa la action de la galería: limpia DB + storage). */
export async function deletePhotoAction(formData: FormData) {
  const photoId = formData.get("id") as string;
  if (!photoId) return;
  const res = await deleteEventPhotoAction(photoId);
  setFlashToast(
    res.ok
      ? { tone: "success", message: "Foto borrada." }
      : { tone: "error", message: res.error ?? "No se pudo borrar la foto." }
  );
  revalidatePath("/admin/fotos");
}
