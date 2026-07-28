"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePanelAccess } from "@/lib/auth";
import { sanitizeBulletinContent } from "@/lib/bulletins";
import { getLocalityMemberIds, sendPushToUsers } from "@/lib/push";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";

function revalidateBulletins() {
  revalidatePath("/admin/boletin");
  revalidatePath("/boletin-local");
}

/**
 * Crea o actualiza una edición del Boletín local.
 *
 * `intent` decide el estado: 'draft' guarda borrador (o despublica),
 * 'publish' publica. El push a los miembros sale UNA sola vez: cuando la
 * edición pasa de borrador a publicada (editar una ya publicada no
 * re-notifica).
 */
export async function saveBulletinAction(formData: FormData) {
  const session = await requirePanelAccess();
  const supabase = createSupabaseServer();

  const id = (formData.get("id") as string) || null;
  const title = ((formData.get("title") as string) ?? "").trim();
  const editorial = ((formData.get("editorial") as string) ?? "").trim() || null;
  const intent = formData.get("intent") === "publish" ? "publish" : "draft";

  if (!title) {
    setFlashToast({ tone: "error", message: "El boletín necesita un título." });
    redirect(id ? `/admin/boletin/${id}` : "/admin/boletin/nuevo");
  }

  let contentRaw: unknown = null;
  try {
    contentRaw = JSON.parse((formData.get("content") as string) ?? "");
  } catch {
    contentRaw = null;
  }
  const content = sanitizeBulletinContent(contentRaw);

  const publishing = intent === "publish";
  const now = new Date().toISOString();
  let error: { message: string } | null = null;
  let notify = false;

  if (id) {
    // Validar pertenencia (la RLS también lo hace; error claro acá).
    const { data: existing } = await supabase
      .from("bulletins")
      .select("id, locality_id, status, published_at")
      .eq("id", id)
      .maybeSingle();
    if (!existing || existing.locality_id !== session.locality.id) {
      setFlashToast({ tone: "error", message: "Ese boletín no es de tu localidad." });
      redirect("/admin/boletin");
    }

    ({ error } = await supabase
      .from("bulletins")
      .update({
        title,
        editorial,
        content,
        status: publishing ? "published" : "draft",
        // Al despublicar se limpia; al re-publicar conserva la fecha original.
        published_at: publishing ? existing.published_at ?? now : null,
        updated_at: now,
      })
      .eq("id", id));

    notify = publishing && existing.status === "draft";
  } else {
    ({ error } = await supabase.from("bulletins").insert({
      locality_id: session.locality.id,
      created_by: session.user.id,
      title,
      editorial,
      content,
      status: publishing ? "published" : "draft",
      published_at: publishing ? now : null,
    }));
    notify = publishing;
  }

  if (!error && notify) {
    const recipients = await getLocalityMemberIds(session.locality.id);
    await sendPushToUsers(recipients, {
      title: "Nuevo boletín de la Asamblea",
      body: title,
      url: "/boletin-local",
      tag: "boletin",
    });
  }

  setFlashToast(
    error
      ? { tone: "error", message: `Error: ${error.message}` }
      : {
          tone: "success",
          message: publishing
            ? "Boletín publicado."
            : id
              ? "Borrador guardado."
              : "Borrador creado.",
        }
  );

  revalidateBulletins();
  redirect("/admin/boletin");
}

export async function deleteBulletinAction(formData: FormData) {
  const session = await requirePanelAccess();
  const supabase = createSupabaseServer();

  const id = formData.get("id") as string;
  if (id) {
    const { error } = await supabase
      .from("bulletins")
      .delete()
      .eq("id", id)
      .eq("locality_id", session.locality.id);
    setFlashToast(
      error
        ? { tone: "error", message: `No se pudo borrar: ${error.message}` }
        : { tone: "success", message: "Boletín borrado." }
    );
  }
  revalidateBulletins();
  redirect("/admin/boletin");
}
