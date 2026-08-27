"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  MAX_ATTACHMENT_BYTES,
  RECEIPTS_BUCKET,
  getAttachmentsForEntry,
  isAcceptedAttachment,
  signAttachments,
  type SignedAttachment,
} from "@/lib/treasury-attachments";
import { parseMoney } from "@/lib/treasury-format";

/**
 * Comprobantes de un movimiento: las facturas del gasto.
 *
 * Todo pasa por acá y no por el cliente porque el bucket es privado: el
 * navegador no tiene con qué leerlo, y las URL se firman de este lado
 * después de comprobar el tag.
 */

type Result = { ok: boolean; error: string | null };
type ListResult = Result & { attachments: SignedAttachment[] };

const fail = (error: string): Result => ({ ok: false, error });
const failList = (error: string): ListResult => ({
  ok: false,
  error,
  attachments: [],
});

function str(formData: FormData, key: string): string {
  return ((formData.get(key) as string) || "").trim();
}

/** Extensión saneada, para que el path no herede el nombre del archivo. */
function extensionFor(file: File): string {
  if (file.type === "application/pdf") return "pdf";
  const fromName = file.name.split(".").pop() ?? "";
  const fromMime = file.type.split("/")[1] ?? "";
  const raw = (fromName || fromMime).toLowerCase().replace(/[^a-z0-9]/g, "");
  return raw.slice(0, 4) || "jpg";
}

/** Los comprobantes del movimiento, con URL firmada de vida corta. */
export async function listAttachmentsAction(
  entryId: string
): Promise<ListResult> {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  if (!entryId) return failList("Falta el movimiento.");

  const supabase = createSupabaseServer();
  const attachments = await getAttachmentsForEntry(supabase, entryId);
  return {
    ok: true,
    error: null,
    attachments: await signAttachments(supabase, attachments),
  };
}

/**
 * Sube un comprobante y lo cuelga del movimiento.
 *
 * El monto y el concepto son opcionales: un gasto con una sola factura
 * por el total no necesita desglose. Cuando vienen, el desglose es
 * respaldo —el libro sigue viendo una línea sola—, así que acá no se
 * valida que sumen: eso lo avisa la pantalla, sin bloquear. Una factura
 * puede estar a nombre de otro o traer un ítem que no corresponde, y el
 * tesorero sabe mejor que la app cuándo eso está bien.
 */
export async function uploadAttachmentAction(
  formData: FormData
): Promise<Result> {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const entryId = str(formData, "entry_id");
  const file = formData.get("file") as File | null;

  if (!entryId) return fail("Falta el movimiento.");
  if (!file || file.size === 0) return fail("Elegí un archivo.");
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return fail(
      `El comprobante supera los ${Math.round(
        MAX_ATTACHMENT_BYTES / (1024 * 1024)
      )} MB.`
    );
  }
  if (!isAcceptedAttachment(file.type)) {
    return fail("El comprobante tiene que ser una imagen o un PDF.");
  }

  // El movimiento tiene que existir Y ser de esta localidad. La RLS ya
  // lo garantiza, pero un id ajeno daría un archivo subido colgando de
  // un insert que falla.
  const { data: entry } = await supabase
    .from("treasury_entries")
    .select("id")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) return fail("El movimiento no existe.");

  const amountRaw = str(formData, "amount");
  const amount = amountRaw ? parseMoney(amountRaw) : null;
  if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) {
    return fail("El monto del comprobante tiene que ser mayor a cero.");
  }

  const path = `${session.locality.id}/${entryId}/${randomUUID()}.${extensionFor(file)}`;

  const { error: uploadError } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    console.error("[uploadAttachmentAction] storage:", uploadError);
    return fail(`No se pudo subir: ${uploadError.message}`);
  }

  const { error } = await supabase.from("treasury_attachments").insert({
    entry_id: entryId,
    storage_path: path,
    file_name: file.name.slice(0, 200) || "comprobante",
    mime_type: file.type,
    size_bytes: file.size,
    amount,
    label: str(formData, "label") || null,
    sort_order: parseInt(str(formData, "sort_order"), 10) || 0,
    uploaded_by: session.user.id,
  });

  if (error) {
    // Si la fila no entró, el archivo no tiene quien lo nombre.
    await supabase.storage.from(RECEIPTS_BUCKET).remove([path]);
    return fail(error.message);
  }

  revalidatePath("/admin/tesoreria/libro");
  return { ok: true, error: null };
}

/** Edita el monto y el concepto de un comprobante ya subido. */
export async function updateAttachmentAction(
  formData: FormData
): Promise<Result> {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const id = str(formData, "id");
  if (!id) return fail("Falta el comprobante.");

  const amountRaw = str(formData, "amount");
  const amount = amountRaw ? parseMoney(amountRaw) : null;
  if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) {
    return fail("El monto del comprobante tiene que ser mayor a cero.");
  }

  const { error } = await supabase
    .from("treasury_attachments")
    .update({ amount, label: str(formData, "label") || null })
    .eq("id", id);

  if (error) return fail(error.message);

  revalidatePath("/admin/tesoreria/libro");
  return { ok: true, error: null };
}

export async function deleteAttachmentAction(
  formData: FormData
): Promise<Result> {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const id = str(formData, "id");
  if (!id) return fail("Falta el comprobante.");

  const { data: row } = await supabase
    .from("treasury_attachments")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!row) return fail("El comprobante no existe.");

  const { error } = await supabase
    .from("treasury_attachments")
    .delete()
    .eq("id", id);
  if (error) return fail(error.message);

  const { error: storageError } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .remove([(row as { storage_path: string }).storage_path]);
  if (storageError) {
    // La fila ya no está; el archivo huérfano no se ve desde ningún lado.
    console.error("[deleteAttachmentAction] storage:", storageError);
  }

  revalidatePath("/admin/tesoreria/libro");
  return { ok: true, error: null };
}
