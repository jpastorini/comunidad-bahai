"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { getLocalityMemberIds, sendPushToUsers } from "@/lib/push";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";
import { formatReceiptDate } from "@/lib/treasury-format";
import { todayISO } from "@/lib/treasury-ledger";
import {
  computePublicationSnapshot,
  isPublicationsSchemaMissing,
  lastClosedMonthEnd,
} from "@/lib/treasury-publications";

// El estado del Fondo que ve la comunidad (066): "Calcular" guarda un
// borrador, "Compartir" publica ESE borrador. Nada de lo que la comunidad
// ve se calcula en otro lado.

const PAGE = "/admin/tesoreria/publicar";
const SCHEMA_MSG = "Falta aplicar la migración 066 en Supabase.";

function isISODate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));
}

export async function calculatePublicationAction(formData: FormData) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);

  const today = todayISO();
  const preset = String(formData.get("preset") ?? "today");
  let asOf = today;
  if (preset === "month") {
    asOf = lastClosedMonthEnd(today)?.date ?? today;
  } else if (preset === "custom") {
    const raw = String(formData.get("custom_date") ?? "");
    if (!isISODate(raw)) {
      setFlashToast({ tone: "error", message: "Elegí una fecha válida." });
      redirect(PAGE);
    }
    asOf = raw;
  }
  // Un corte en el futuro diría "movimientos hasta" algo que no pasó.
  if (asOf > today) asOf = today;

  const supabase = createSupabaseServer();
  const snapshot = await computePublicationSnapshot(supabase, session.locality.id, asOf);
  if (!snapshot.progress && !snapshot.month) {
    setFlashToast({
      tone: "error",
      message: "No se pudo calcular: la fecha no cae en un ejercicio conocido.",
    });
    redirect(PAGE);
  }

  // Un solo borrador por comunidad (índice único parcial): calcular de
  // nuevo reemplaza al anterior.
  const del = await supabase
    .from("treasury_publications")
    .delete()
    .eq("locality_id", session.locality.id)
    .eq("status", "draft");
  if (del.error) {
    setFlashToast({
      tone: "error",
      message: isPublicationsSchemaMissing(del.error) ? SCHEMA_MSG : `Error: ${del.error.message}`,
    });
    redirect(PAGE);
  }

  const { error } = await supabase.from("treasury_publications").insert({
    locality_id: session.locality.id,
    status: "draft",
    as_of: asOf,
    snapshot,
    calculated_by: session.user.id,
  });

  setFlashToast(
    error
      ? {
          tone: "error",
          message: isPublicationsSchemaMissing(error) ? SCHEMA_MSG : `Error: ${error.message}`,
        }
      : {
          tone: "success",
          message: `Calculado con los movimientos hasta el ${formatReceiptDate(asOf)}. Revisalo y compartilo.`,
        }
  );
  revalidatePath(PAGE);
  redirect(PAGE);
}

export async function sharePublicationAction(formData: FormData) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const id = String(formData.get("id") ?? "");
  const notify = formData.get("notify") === "on";

  const supabase = createSupabaseServer();
  // Se publica la fila que el tesorero tiene a la vista, no un cálculo
  // nuevo: si entre los dos pasos entró un movimiento, sale lo revisado.
  const { data, error } = await supabase
    .from("treasury_publications")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      published_by: session.user.id,
    })
    .eq("id", id)
    .eq("locality_id", session.locality.id)
    .eq("status", "draft")
    .select("as_of")
    .maybeSingle();

  if (error || !data) {
    setFlashToast({
      tone: "error",
      message: error
        ? isPublicationsSchemaMissing(error)
          ? SCHEMA_MSG
          : `Error: ${error.message}`
        : "Ese cálculo ya no está: volvé a calcular.",
    });
    redirect(PAGE);
  }

  const asOf = (data as { as_of: string }).as_of;
  if (notify) {
    // La Tesorería es solo para creyentes (047): a un Amigo/a de la Fe no
    // se le avisa lo que no puede abrir.
    const recipients = await getLocalityMemberIds(session.locality.id, {
      bahaiOnly: true,
    });
    await sendPushToUsers(recipients, {
      title: "Tesorería",
      body: `Se actualizó el estado del Fondo, con los movimientos hasta el ${formatReceiptDate(asOf)}.`,
      url: "/tesoreria",
      tag: "tesoreria-estado",
    });
  }

  setFlashToast({
    tone: "success",
    message: notify
      ? "Compartido. La comunidad ya lo ve y se le avisó."
      : "Compartido. La comunidad ya lo ve.",
  });
  revalidatePath(PAGE);
  revalidatePath("/tesoreria");
  revalidatePath("/fiestas", "layout");
  revalidatePath("/programa", "layout");
  redirect(PAGE);
}

export async function discardPublicationDraftAction() {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();
  await supabase
    .from("treasury_publications")
    .delete()
    .eq("locality_id", session.locality.id)
    .eq("status", "draft");
  setFlashToast({ tone: "info", message: "Cálculo descartado." });
  revalidatePath(PAGE);
  redirect(PAGE);
}
