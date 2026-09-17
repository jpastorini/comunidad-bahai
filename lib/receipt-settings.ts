import type { SupabaseClient } from "@supabase/supabase-js";
import { isSchemaMissing } from "./polls-shared";
import { DEFAULT_RECEIPT_THEME, type ReceiptTheme } from "./receipt-theme";
import { MAX_SIGNATURE_BYTES, RECEIPT_SIGNATURE_BUCKET } from "./types";

/**
 * La configuración del recibo de una comunidad (060): quién firma, con
 * qué imagen y en qué color.
 *
 * Hasta acá el recibo era el MISMO para todo el país —la firma era un
 * archivo del repo, `public/recibo/firma.png`, el de la planilla de
 * Montevideo— y el nombre que imprimía la pantalla del tesorero era el de
 * quien tuviera el recibo abierto. Ver la migración 060.
 *
 * ⚠️ El nombre del Tesorero/a NO se resuelve acá. Lo resuelve
 * `receipt_signer_name()` en la base, que es la MISMA función que usa
 * `my_receipt()` para la copia del creyente: si el nombre se calculara en
 * dos lados, las dos caras del mismo papel podrían volver a decir cosas
 * distintas. `treasurer_name` de esta tabla es solo el override.
 */

export { MAX_SIGNATURE_BYTES, RECEIPT_SIGNATURE_BUCKET } from "./types";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type ReceiptSettings = {
  locality_id: string;
  treasurer_name: string | null;
  treasurer_title: string | null;
  signature_path: string | null;
  signature_file_name: string | null;
  signature_uploaded_at: string | null;
  theme: ReceiptTheme;
  updated_at: string | null;
};

export type ReceiptSettingsData = {
  /** false si la 060 no corrió todavía. */
  ready: boolean;
  settings: ReceiptSettings | null;
  /** La firma lista para poner en un `src`: normalmente un `data:` URI
   *  (ver `loadSignatureImage`, de eso depende que salga en el PNG
   *  compartido), o una URL firmada si el archivo es grande. */
  signatureUrl: string | null;
  /** El nombre que va a salir impreso hoy, ya resuelto por la base. */
  signerName: string | null;
};

/** Hasta acá se inlinea la firma como `data:` URI. Un escaneo pesa
 *  decenas de kB; el tope es para que una foto enorme no infle el HTML
 *  de la página. Por encima se cae a la URL firmada. */
const MAX_INLINE_SIGNATURE_BYTES = 1024 * 1024;

/** La URL firmada de una firma del bucket privado. Cualquier autenticado
 *  puede leerla (la RLS de la 060 lo permite a propósito: el creyente
 *  tiene que poder ver la firma de la comunidad que emitió SU recibo,
 *  que no siempre es la suya). */
export async function signSignatureUrl(
  supabase: SupabaseClient,
  path: string | null | undefined
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(RECEIPT_SIGNATURE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.error("[signSignatureUrl]", error);
    return null;
  }
  return data?.signedUrl ?? null;
}

/**
 * La firma como `data:` URI, bajada en el servidor.
 *
 * ⚠️ NO es una optimización: es lo único que hace que la firma sobreviva
 * al "Compartir por WhatsApp". Ese botón captura la hoja con
 * `html-to-image`, que para cada `<img>` remoto vuelve a pedir el archivo
 * por su cuenta — y ahí pasan dos cosas malas. Le agrega a la URL un
 * `&<timestamp>` SIN nombre de parámetro para saltear el caché, que
 * ensucia la URL firmada de Supabase; y si el pedido falla por lo que
 * sea, hace `dataURL = imagePlaceholder || ''`: deja la imagen vacía, no
 * tira error y solo loguea un warning. La firma salía en blanco en el PNG
 * sin que nada avisara (visto en producción el 2026-09-17).
 *
 * Con un `data:` URI no hay nada que pedir: `embedImages` chequea
 * `isDataUrl(src)` y no toca la imagen. De paso desaparece el vencimiento
 * de la URL firmada, que en una pestaña abierta hace rato también dejaba
 * la firma en blanco.
 *
 * Si algún día se agrega otra imagen a la hoja, va por acá también.
 */
export async function loadSignatureImage(
  supabase: SupabaseClient,
  path: string | null | undefined
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(RECEIPT_SIGNATURE_BUCKET)
    .download(path);
  if (error || !data) {
    if (error) console.error("[loadSignatureImage]", error);
    return signSignatureUrl(supabase, path);
  }
  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.byteLength > MAX_INLINE_SIGNATURE_BYTES) {
    console.warn(
      `[loadSignatureImage] ${path} pesa ${bytes.byteLength} bytes: va por URL firmada y puede no salir en el PNG compartido.`
    );
    return signSignatureUrl(supabase, path);
  }
  const type = data.type || "image/png";
  return `data:${type};base64,${bytes.toString("base64")}`;
}

/** Quién firma el recibo de esta comunidad en esta fecha, según la base.
 *  `entryDate` decide el ejercicio: un recibo del 183 lo firma el
 *  tesorero del 183, no el de hoy. */
export async function getReceiptSigner(
  supabase: SupabaseClient,
  localityId: string,
  entryDate?: string | null,
  issuedBy?: string | null
): Promise<string | null> {
  const { data, error } = await supabase.rpc("receipt_signer_name", {
    p_locality: localityId,
    p_date: entryDate ?? null,
    p_issued_by: issuedBy ?? null,
  });
  // ⚠️ Acá no se descarta ningún error, ni siquiera el de "falta la
  // función". Un recibo sin nombre se ve IGUAL que un recibo cuyo nombre
  // no se pudo resolver, y el papel sale mal sin que nadie se entere:
  // es el mismo agujero que tenía el chat antes de `chatFailure()`.
  // PGRST202 acá casi siempre significa que PostgREST todavía no recargó
  // su caché de esquema después de la 060, no que la migración falte.
  if (error) {
    console.error("[getReceiptSigner]", error.code, error.message, {
      localityId,
      entryDate,
    });
    return null;
  }
  return (data as string | null) ?? null;
}

export async function getReceiptSettings(
  supabase: SupabaseClient,
  localityId: string,
  opts: { entryDate?: string | null; issuedBy?: string | null } = {}
): Promise<ReceiptSettingsData> {
  const { data, error } = await supabase
    .from("treasury_receipt_settings")
    .select(
      "locality_id, treasurer_name, treasurer_title, signature_path, signature_file_name, signature_uploaded_at, theme, updated_at"
    )
    .eq("locality_id", localityId)
    .maybeSingle();

  if (error && isSchemaMissing(error.code)) {
    return { ready: false, settings: null, signatureUrl: null, signerName: null };
  }
  if (error) console.error("[getReceiptSettings]", error);

  const row = (data ?? null) as ReceiptSettings | null;
  const settings = row
    ? { ...row, theme: (row.theme ?? DEFAULT_RECEIPT_THEME) as ReceiptTheme }
    : null;

  const [signatureUrl, signerName] = await Promise.all([
    // Inlineada, no firmada: ver loadSignatureImage.
    loadSignatureImage(supabase, settings?.signature_path),
    getReceiptSigner(supabase, localityId, opts.entryDate, opts.issuedBy),
  ]);

  return { ready: true, settings, signatureUrl, signerName };
}
