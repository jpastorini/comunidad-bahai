import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Comprobantes de Tesorería — capa de datos.
 *
 * Las facturas de un gasto, colgadas del movimiento. Ver la migración
 * 043 para el porqué del modelo; lo esencial es que el desglose
 * (monto + concepto por factura) es RESPALDO, no contabilidad: el libro
 * sigue viendo una sola línea.
 *
 * El bucket es privado. Nada de acá devuelve una URL pública: se firman
 * en el servidor, con vida corta, y solo para quien tiene el tag.
 */

export const RECEIPTS_BUCKET = "treasury-receipts";

/** Después de comprimir, una foto de factura queda muy por debajo. El
 *  tope es para los PDF, que no se comprimen. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Media factura llega por mail en PDF; la otra media se saca con la
 *  cámara. */
export const ACCEPTED_ATTACHMENT_TYPES = "image/*,application/pdf";

/** Vida de la URL firmada: alcanza para mirar el comprobante sin dejar
 *  un link que sirva mañana. */
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

export function isAcceptedAttachment(mime: string): boolean {
  return mime.startsWith("image/") || mime === "application/pdf";
}

export type TreasuryAttachment = {
  id: string;
  entry_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  /** Monto de esta factura, sin signo. NULL = cubre todo el movimiento. */
  amount: number | null;
  label: string | null;
  sort_order: number;
  created_at: string;
};

/** Un comprobante con su URL firmada, listo para mostrar. */
export type SignedAttachment = TreasuryAttachment & { url: string | null };

const COLUMNS =
  "id, entry_id, storage_path, file_name, mime_type, size_bytes, amount, label, sort_order, created_at";

function normalize(rows: unknown[]): TreasuryAttachment[] {
  return (rows as TreasuryAttachment[]).map((a) => ({
    ...a,
    amount: a.amount === null ? null : Number(a.amount),
    size_bytes: Number(a.size_bytes),
  }));
}

export async function getAttachmentsForEntry(
  supabase: SupabaseClient,
  entryId: string
): Promise<TreasuryAttachment[]> {
  const { data } = await supabase
    .from("treasury_attachments")
    .select(COLUMNS)
    .eq("entry_id", entryId)
    .order("sort_order")
    .order("created_at");
  return normalize(data ?? []);
}

/**
 * Cuántos comprobantes tiene cada movimiento, para el clip de la lista.
 *
 * Trae los `entry_id` de toda la localidad en vez de filtrar por los
 * movimientos del año: la RLS ya acota a la localidad, la tabla es
 * chica, y un `.in()` con cientos de UUID arma una URL enorme.
 */
export async function getAttachmentCounts(
  supabase: SupabaseClient
): Promise<Record<string, number>> {
  const { data } = await supabase
    .from("treasury_attachments")
    .select("entry_id");
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ entry_id: string }>) {
    counts[row.entry_id] = (counts[row.entry_id] ?? 0) + 1;
  }
  return counts;
}

/** Firma las URLs de una tanda. Las que fallen quedan en null y la UI
 *  muestra el comprobante sin vista previa, no rompe. */
export async function signAttachments(
  supabase: SupabaseClient,
  attachments: TreasuryAttachment[]
): Promise<SignedAttachment[]> {
  if (attachments.length === 0) return [];

  const { data } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrls(
      attachments.map((a) => a.storage_path),
      SIGNED_URL_TTL_SECONDS
    );

  const byPath = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) byPath.set(row.path, row.signedUrl);
  }

  return attachments.map((a) => ({
    ...a,
    url: byPath.get(a.storage_path) ?? null,
  }));
}

/**
 * Suma de los montos declarados. Devuelve null si ningún comprobante
 * declara monto: ahí no hay desglose que cuadrar y no hay nada que
 * avisar.
 */
export function attachmentsSum(
  attachments: Array<{ amount: number | null }>
): number | null {
  const withAmount = attachments.filter((a) => a.amount !== null);
  if (withAmount.length === 0) return null;
  return (
    Math.round(withAmount.reduce((acc, a) => acc + (a.amount ?? 0), 0) * 100) /
    100
  );
}
