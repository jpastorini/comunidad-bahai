"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";
import {
  DESTINATION_TONES,
  NOTE_SECTIONS,
  sanitizeReportEditorial,
  type DestinationTone,
  type NoteKey,
  type ReportAudience,
  type ReportEditorial,
} from "@/lib/treasury-report-content";
import {
  computeReportSnapshot,
  suggestEditorial,
} from "@/lib/treasury-reports";
import { treasuryYearForDate } from "@/lib/treasury-year";

/**
 * Informes de Tesorería — server actions.
 *
 * El snapshot de cifras se recalcula en cada guardado, nunca al
 * renderizar: así el informe que se proyectó en la Fiesta queda tal cual
 * aunque después se carguen movimientos nuevos, y al mismo tiempo el
 * tesorero puede refrescarlo mientras lo está armando.
 */

function revalidateReports(id?: string) {
  revalidatePath("/admin/tesoreria/informes");
  if (id) {
    revalidatePath(`/admin/tesoreria/informes/${id}`);
    revalidatePath(`/admin/informe/${id}`);
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** El destinatario define el formato y quién puede leer el informe. */
function readAudience(formData: FormData): ReportAudience {
  return formData.get("audience") === "internos" ? "internos" : "comunidad";
}

function readDate(formData: FormData, key: string): string | null {
  const raw = ((formData.get(key) as string) ?? "").trim();
  return ISO_DATE.test(raw) ? raw : null;
}

const TONE_KEYS = DESTINATION_TONES.map((t) => t.key) as readonly DestinationTone[];

/** Rearma el editorial desde los campos del form. */
function readEditorial(formData: FormData): ReportEditorial {
  const notes: Record<string, string> = {};
  for (const section of NOTE_SECTIONS) {
    const value = ((formData.get(`note_${section.key}`) as string) ?? "").trim();
    if (value) notes[section.key as NoteKey] = value;
  }

  // Filas repetidas de "Destino de los Fondos": los cuatro campos viajan
  // como arrays paralelos, así que se recorren por índice.
  const labels = formData.getAll("dest_label").map(String);
  const badges = formData.getAll("dest_badge").map(String);
  const amounts = formData.getAll("dest_amount").map(String);
  const tones = formData.getAll("dest_tone").map(String);
  const destination = labels.map((label, i) => ({
    label,
    badge: badges[i] ?? "",
    amount: amounts[i] ?? "",
    tone: (TONE_KEYS.includes(tones[i] as DestinationTone)
      ? tones[i]
      : "gold") as DestinationTone,
  }));

  const str = (key: string) => ((formData.get(key) as string) ?? "").trim();

  return sanitizeReportEditorial({
    notes,
    destination,
    goal: {
      title: str("goal_title"),
      subtitle: str("goal_subtitle"),
      monthly: str("goal_monthly"),
      annual: str("goal_annual"),
      covered: str("goal_covered"),
      note: str("goal_note"),
    },
    quote: { text: str("quote_text"), source: str("quote_source") },
    signature: { name: str("signature_name"), role: str("signature_role") },
    observations: str("observations"),
    approval: {
      meetingDate: str("approval_meeting_date"),
      actaNumber: str("approval_acta_number"),
    },
    showContributionsChart: formData.get("show_contributions") === "on",
    showLocalFundChart: formData.get("show_local_fund") === "on",
    showBudget: formData.get("show_budget") === "on",
  });
}

// ─── Crear ───────────────────────────────────────────────────────

export async function createReportAction(formData: FormData) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const title =
    ((formData.get("title") as string) ?? "").trim() ||
    "Fiesta de los Diecinueve Días";
  const subtitle = ((formData.get("subtitle") as string) ?? "").trim() || null;
  const from = readDate(formData, "period_from");
  const to = readDate(formData, "period_to");

  if (!from || !to) {
    setFlashToast({
      tone: "error",
      message: "El informe necesita una fecha de inicio y una de cierre.",
    });
    redirect("/admin/tesoreria/informes/nuevo");
  }
  if (to < from) {
    setFlashToast({
      tone: "error",
      message: "La fecha de cierre no puede ser anterior a la de inicio.",
    });
    redirect("/admin/tesoreria/informes/nuevo");
  }

  const bahaiYear = treasuryYearForDate(to);
  const snapshot = await computeReportSnapshot(supabase, {
    localityId: session.locality.id,
    from,
    to,
    bahaiYear,
  });

  const { data, error } = await supabase
    .from("treasury_reports")
    .insert({
      locality_id: session.locality.id,
      created_by: session.user.id,
      title,
      subtitle,
      audience: readAudience(formData),
      period_from: from,
      period_to: to,
      bahai_year: bahaiYear,
      editorial: suggestEditorial(session.profile.full_name ?? ""),
      snapshot,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    setFlashToast({
      tone: "error",
      message: `No se pudo crear el informe: ${error?.message ?? "sin id"}`,
    });
    redirect("/admin/tesoreria/informes");
  }

  revalidateReports();
  setFlashToast({
    tone: "success",
    message: "Informe creado con las cifras del período.",
  });
  redirect(`/admin/tesoreria/informes/${(data as { id: string }).id}`);
}

// ─── Guardar / publicar ──────────────────────────────────────────

export async function saveReportAction(formData: FormData) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const id = (formData.get("id") as string) ?? "";
  const intentRaw = formData.get("intent");
  const intent =
    intentRaw === "publish"
      ? "publish"
      : intentRaw === "unpublish"
        ? "unpublish"
        : "draft";

  const { data: existing } = await supabase
    .from("treasury_reports")
    .select("id, locality_id, status, published_at, period_from, period_to")
    .eq("id", id)
    .maybeSingle();

  if (!existing || (existing as { locality_id: string }).locality_id !== session.locality.id) {
    setFlashToast({ tone: "error", message: "Ese informe no es de tu localidad." });
    redirect("/admin/tesoreria/informes");
  }
  const prev = existing as {
    status: string;
    published_at: string | null;
    period_from: string;
    period_to: string;
  };

  const title = ((formData.get("title") as string) ?? "").trim();
  if (!title) {
    setFlashToast({ tone: "error", message: "El informe necesita un título." });
    redirect(`/admin/tesoreria/informes/${id}`);
  }
  const subtitle = ((formData.get("subtitle") as string) ?? "").trim() || null;
  const from = readDate(formData, "period_from") ?? prev.period_from;
  const to = readDate(formData, "period_to") ?? prev.period_to;

  if (to < from) {
    setFlashToast({
      tone: "error",
      message: "La fecha de cierre no puede ser anterior a la de inicio.",
    });
    redirect(`/admin/tesoreria/informes/${id}`);
  }

  const bahaiYear = treasuryYearForDate(to);
  // Las cifras se recalculan siempre al guardar: es el único momento en
  // que el informe mira el libro.
  const snapshot = await computeReportSnapshot(supabase, {
    localityId: session.locality.id,
    from,
    to,
    bahaiYear,
  });

  const publishing = intent === "publish";
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("treasury_reports")
    .update({
      title,
      subtitle,
      audience: readAudience(formData),
      period_from: from,
      period_to: to,
      bahai_year: bahaiYear,
      editorial: readEditorial(formData),
      snapshot,
      status: publishing ? "published" : "draft",
      // Al despublicar se limpia; al re-publicar conserva la fecha original.
      published_at: publishing ? (prev.published_at ?? now) : null,
      updated_at: now,
    })
    .eq("id", id);

  setFlashToast(
    error
      ? { tone: "error", message: `Error: ${error.message}` }
      : {
          tone: "success",
          message: publishing
            ? "Informe publicado. El link ya se puede compartir."
            : intent === "unpublish"
              ? "Informe despublicado: el link dejó de funcionar."
              : "Informe guardado con las cifras al día.",
        }
  );

  revalidateReports(id);
  redirect(
    intent === "draft"
      ? `/admin/tesoreria/informes/${id}`
      : "/admin/tesoreria/informes"
  );
}

// ─── Borrar ──────────────────────────────────────────────────────

export async function deleteReportAction(formData: FormData) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const id = (formData.get("id") as string) ?? "";
  if (id) {
    const { error } = await supabase
      .from("treasury_reports")
      .delete()
      .eq("id", id)
      .eq("locality_id", session.locality.id);
    setFlashToast(
      error
        ? { tone: "error", message: `No se pudo borrar: ${error.message}` }
        : { tone: "success", message: "Informe borrado." }
    );
  }
  revalidateReports();
  redirect("/admin/tesoreria/informes");
}
