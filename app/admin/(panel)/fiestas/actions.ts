"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";
import { getBahaiMonth } from "@/lib/bahai-calendar";
import {
  TEMPLATE_INTERNATIONAL_REPORTS_PLACEHOLDER,
  TEMPLATE_LOCAL_REPORTS_PLACEHOLDER,
  TEMPLATE_NATIONAL_REPORTS_PLACEHOLDER,
  generateTemplateDeepening,
  generateTemplatePrayers,
} from "@/lib/feast-template";

const BUCKET = "comunicados"; // reused for treasury PDF

async function uploadPdf(file: File | null): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const supabase = createSupabaseServer();
  const ext = file.name.split(".").pop() || "pdf";
  const path = `fiestas/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return null;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ─── Crear / editar Fiesta ─────────────────────────────────────
export async function upsertFeastAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseServer();

  const id = formData.get("id") as string | null;
  const monthIndex = parseInt((formData.get("bahai_month_index") as string) || "0", 10);
  const month = getBahaiMonth(monthIndex);

  if (!month) {
    setFlashToast({ tone: "error", message: "Selecciona un mes bahá'í válido." });
    redirect("/admin/fiestas");
  }

  const payload: Record<string, unknown> = {
    bahai_month_index: monthIndex,
    bahai_month_name: month.name,
    bahai_year: parseInt((formData.get("bahai_year") as string) || "0", 10),
    deepening_theme: (formData.get("deepening_theme") as string) || null,
    deepening_content: (formData.get("deepening_content") as string) || null,
    international_reports: (formData.get("international_reports") as string) || null,
    national_reports: (formData.get("national_reports") as string) || null,
    local_reports: (formData.get("local_reports") as string) || null,
    assembly_communique: (formData.get("assembly_communique") as string) || null,
    treasury_income: parseOptionalNumber(formData.get("treasury_income")),
    treasury_expenses: parseOptionalNumber(formData.get("treasury_expenses")),
    treasury_final: parseOptionalNumber(formData.get("treasury_final")),
  };

  // Treasury PDF
  const pdfFile = formData.get("treasury_pdf_file") as File | null;
  const removePdf = formData.get("treasury_pdf_remove") === "on";
  if (pdfFile && pdfFile.size > 0) {
    const url = await uploadPdf(pdfFile);
    if (url) payload.treasury_pdf_url = url;
  } else if (removePdf) {
    payload.treasury_pdf_url = null;
  }

  let feastId = id;
  if (id) {
    const { error } = await supabase.from("feasts").update(payload).eq("id", id);
    if (error) {
      setFlashToast({ tone: "error", message: `Error: ${error.message}` });
      redirect("/admin/fiestas");
    }
  } else {
    const { data, error } = await supabase
      .from("feasts")
      .insert(payload)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      setFlashToast({ tone: "error", message: `Error: ${error?.message ?? "no data"}` });
      redirect("/admin/fiestas");
    }
    feastId = data.id;
  }

  // ─── Locations (CRUD inline desde rows repetidas) ──────────────
  await persistLocations(formData, feastId!);

  // ─── Prayers (CRUD inline desde rows repetidas) ────────────────
  await persistPrayers(formData, feastId!);

  setFlashToast({
    tone: "success",
    message: id ? "Fiesta actualizada." : "Fiesta creada.",
  });

  revalidatePath("/admin/fiestas");
  revalidatePath("/fiestas");
  revalidatePath(`/admin/fiestas/${feastId}`);
  revalidatePath(`/fiestas/${feastId}`);
  redirect(`/admin/fiestas/${feastId}`);
}

async function persistLocations(formData: FormData, feastId: string) {
  const supabase = createSupabaseServer();
  const ids = formData.getAll("location_id[]") as string[];
  const names = formData.getAll("location_name[]") as string[];
  const addresses = formData.getAll("location_address[]") as string[];
  const dates = formData.getAll("location_date[]") as string[];
  const times = formData.getAll("location_time[]") as string[];
  const notes = formData.getAll("location_notes[]") as string[];
  const removes = formData.getAll("location_remove[]") as string[];
  const participants = formData.getAll("location_participants[]") as string[];

  for (let i = 0; i < names.length; i++) {
    const existingId = ids[i] || null;
    const name = (names[i] || "").trim();
    const remove = removes[i] === "1";

    if (existingId && remove) {
      await supabase.from("feast_locations").delete().eq("id", existingId);
      continue;
    }
    if (!name) continue; // empty row → skip

    const date = dates[i] || "";
    const time = times[i] || "19:00";
    const startsAt = `${date}T${time}:00`;

    // Participantes: vacío = NULL (sin registrar), número >= 0 = registrado.
    const pRaw = (participants[i] || "").trim();
    const participant_count =
      pRaw === "" ? null : Math.max(0, parseInt(pRaw, 10) || 0);

    const row = {
      feast_id: feastId,
      name,
      address: (addresses[i] || "").trim() || null,
      starts_at: startsAt,
      notes: (notes[i] || "").trim() || null,
      participant_count,
    };

    if (existingId) {
      await supabase.from("feast_locations").update(row).eq("id", existingId);
    } else if (date) {
      await supabase.from("feast_locations").insert(row);
    }
  }
}

async function persistPrayers(formData: FormData, feastId: string) {
  const supabase = createSupabaseServer();
  const ids = formData.getAll("prayer_id[]") as string[];
  const titles = formData.getAll("prayer_title[]") as string[];
  const references = formData.getAll("prayer_reference[]") as string[];
  const bodies = formData.getAll("prayer_body[]") as string[];
  const removes = formData.getAll("prayer_remove[]") as string[];

  for (let i = 0; i < bodies.length; i++) {
    const existingId = ids[i] || null;
    const body = (bodies[i] || "").trim();
    const remove = removes[i] === "1";

    if (existingId && remove) {
      await supabase.from("feast_prayers").delete().eq("id", existingId);
      continue;
    }
    if (!body) continue;

    const row = {
      feast_id: feastId,
      position: i,
      title: (titles[i] || "").trim() || null,
      reference: (references[i] || "").trim() || null,
      body,
    };

    if (existingId) {
      await supabase.from("feast_prayers").update(row).eq("id", existingId);
    } else {
      await supabase.from("feast_prayers").insert(row);
    }
  }
}

function parseOptionalNumber(v: FormDataEntryValue | null): number | null {
  if (v == null || v === "") return null;
  const n = parseFloat(v as string);
  return isNaN(n) ? null : n;
}

// ─── Cambiar estado de Fiesta (draft / published / in_progress) ──
//
// new_status admite: 'draft' | 'published' | 'in_progress'
//
// Transiciones esperadas:
//   draft       → published   (publicar a la comunidad)
//   published   → draft       (despublicar)
//   published   → in_progress (iniciar Fiesta)
//   in_progress → published   (volver a publicada)
export async function setFeastStatusAction(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  const requested = formData.get("new_status") as string;
  const valid = ["draft", "published", "in_progress"] as const;
  const newStatus = (valid as readonly string[]).includes(requested)
    ? (requested as (typeof valid)[number])
    : "draft";

  const update: Record<string, unknown> = { status: newStatus };
  if (newStatus === "published") {
    update.published_at = new Date().toISOString();
    update.started_at = null;
  } else if (newStatus === "in_progress") {
    update.started_at = new Date().toISOString();
  } else {
    // draft
    update.started_at = null;
    update.published_at = null;
  }

  const supabase = createSupabaseServer();
  await supabase.from("feasts").update(update).eq("id", id);

  const messages: Record<typeof newStatus, string> = {
    draft:
      "Fiesta vuelta a 'No publicada' — solo la Asamblea la ve.",
    published:
      "Fiesta publicada — aparece en el calendario de la comunidad.",
    in_progress:
      "Fiesta iniciada — el programa ya es visible para los miembros.",
  };
  setFlashToast({ tone: "success", message: messages[newStatus] });

  revalidatePath("/admin/fiestas");
  revalidatePath(`/admin/fiestas/${id}`);
  revalidatePath("/fiestas");
  revalidatePath(`/fiestas/${id}`);
  revalidatePath("/calendario");
  redirect(`/admin/fiestas/${id}`);
}

/** @deprecated usar setFeastStatusAction. Mantenido por compatibilidad con
 *  formularios antiguos que envíen `new_status=in_progress|upcoming`. */
export async function toggleFeastStatusAction(formData: FormData) {
  const raw = formData.get("new_status") as string;
  const normalized = raw === "in_progress" ? "in_progress" : "draft";
  const proxied = new FormData();
  proxied.set("id", formData.get("id") as string);
  proxied.set("new_status", normalized);
  await setFeastStatusAction(proxied);
}

// ─── Cargar plantilla en una Fiesta existente ──────────────────
export async function loadTemplateAction(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  const supabase = createSupabaseServer();

  // Update default text fields (only if they are empty)
  const { data: feast } = await supabase
    .from("feasts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (feast) {
    const updates: Record<string, unknown> = {};
    // Profundización: si está vacía, elige un tema al azar del pool de 20.
    if (!feast.deepening_theme || !feast.deepening_content) {
      const deepening = generateTemplateDeepening();
      if (!feast.deepening_theme) updates.deepening_theme = deepening.theme;
      if (!feast.deepening_content) updates.deepening_content = deepening.content;
    }
    if (!feast.international_reports)
      updates.international_reports = TEMPLATE_INTERNATIONAL_REPORTS_PLACEHOLDER;
    if (!feast.national_reports)
      updates.national_reports = TEMPLATE_NATIONAL_REPORTS_PLACEHOLDER;
    if (!feast.local_reports)
      updates.local_reports = TEMPLATE_LOCAL_REPORTS_PLACEHOLDER;
    if (Object.keys(updates).length > 0) {
      await supabase.from("feasts").update(updates).eq("id", id);
    }
  }

  // Add template prayers only if there are none yet.
  const { data: existing } = await supabase
    .from("feast_prayers")
    .select("id")
    .eq("feast_id", id);

  if (!existing || existing.length === 0) {
    // Cada carga elige 4 oraciones al azar del pool de 40, para variar.
    const rows = generateTemplatePrayers(4).map((p, i) => ({
      feast_id: id,
      position: i,
      title: p.title,
      reference: p.reference,
      body: p.body,
    }));
    await supabase.from("feast_prayers").insert(rows);
  }

  setFlashToast({
    tone: "success",
    message: "Plantilla cargada. Revisa y edita lo que corresponda.",
  });

  revalidatePath(`/admin/fiestas/${id}`);
  redirect(`/admin/fiestas/${id}`);
}

// ─── Borrar Fiesta ─────────────────────────────────────────────
export async function deleteFeastAction(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  const supabase = createSupabaseServer();
  const { error } = await supabase.from("feasts").delete().eq("id", id);
  setFlashToast(
    error
      ? { tone: "error", message: `No se pudo borrar: ${error.message}` }
      : { tone: "success", message: "Fiesta borrada." }
  );
  revalidatePath("/admin/fiestas");
  revalidatePath("/fiestas");
}

// ─── Marcar sugerencia como revisada ───────────────────────────
export async function toggleSuggestionReviewedAction(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  const feastId = formData.get("feast_id") as string;
  const reviewed = formData.get("reviewed") === "on";
  const supabase = createSupabaseServer();
  await supabase
    .from("feast_suggestions")
    .update({ reviewed })
    .eq("id", id);
  revalidatePath(`/admin/fiestas/${feastId}`);
}
