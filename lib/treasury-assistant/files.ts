import "server-only";
import { toFile } from "@anthropic-ai/sdk";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { PLATFORM_LABELS, parseStatement } from "@/lib/bank-statements";
import { readStatementRows } from "@/lib/bank-statements-read";
import { formatReceiptDate } from "@/lib/treasury-format";
import { FILES_BETA, anthropic } from "./client";
import {
  ASSISTANT_BUCKET,
  MAX_FILES_PER_MESSAGE,
  MAX_FILE_BYTES,
  fileKindFor,
  type AttachedFile,
  type FileKind,
} from "./types";

/**
 * Los archivos que el tesorero le pasa al asistente (092).
 *
 * El navegador ya los subió al bucket privado; acá llegan los paths. Cada
 * uno se verifica (que esté en la carpeta de esta persona en esta
 * comunidad), se registra en `treasury_assistant_files` atado a la
 * conversación, y se convierte en lo que el modelo ve:
 *
 *  · una IMAGEN o un PDF se suben a la Files API y van como bloque
 *    `image` / `document` por id: el historial los nombra sin repetir los
 *    bytes en cada pedido;
 *  · una PLANILLA no se le manda cruda. El servidor la lee con los mismos
 *    lectores de Conciliación y del importador, y el modelo recibe un
 *    resumen; para el detalle usa las herramientas (`leer_planilla`,
 *    `revisar_extracto`), que vuelven a leer el archivo. Así los números
 *    no dependen de que el modelo interprete un Excel.
 *
 * Antes de cada archivo va una línea de texto con su id (`fileNote`), que
 * es como el modelo lo nombra al llamar una herramienta y como la pantalla
 * lo reconoce al redibujar la conversación.
 */

export type UploadedFileInput = { path: string; name: string; type: string; size: number };

export type FileRow = {
  id: string;
  thread_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  kind: FileKind;
  anthropic_file_id: string | null;
};

const FILE_FIELDS = "id, thread_id, storage_path, file_name, mime_type, size_bytes, kind, anthropic_file_id";

type Block = Anthropic.Beta.BetaContentBlockParam;

// ─── La línea que nombra al archivo ────────────────────────────────────

const NOTE_RE = /^⟦archivo id=([0-9a-f-]{36}) tipo=(imagen|pdf|planilla) nombre="([^"]*)"⟧/;

function fileNote(row: FileRow, summary: string): string {
  const name = row.file_name.replace(/"/g, "'");
  return `⟦archivo id=${row.id} tipo=${row.kind} nombre="${name}"⟧ ${summary}`.trim();
}

/** Si un bloque de texto del historial es la línea de un archivo, cuál. */
export function parseFileNote(text: string): AttachedFile | null {
  const m = NOTE_RE.exec(text);
  return m ? { id: m[1], kind: m[2] as FileKind, name: m[3] } : null;
}

// ─── Lectura ───────────────────────────────────────────────────────────

export async function getFile(supabase: SupabaseClient, id: string | null): Promise<FileRow | null> {
  if (!id) return null;
  const { data } = await supabase.from("treasury_assistant_files").select(FILE_FIELDS).eq("id", id).maybeSingle();
  return (data as FileRow | null) ?? null;
}

export async function readFileBuffer(supabase: SupabaseClient, row: FileRow): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(ASSISTANT_BUCKET).download(row.storage_path);
  if (error || !data) throw new Error(`No pude leer el archivo "${row.file_name}": ${error?.message ?? "vacío"}`);
  return Buffer.from(await data.arrayBuffer());
}

/** El archivo como `File`, para pasárselo a un action que espera un form. */
export async function readAsFile(supabase: SupabaseClient, row: FileRow): Promise<File> {
  const buffer = await readFileBuffer(supabase, row);
  return new File([new Uint8Array(buffer)], row.file_name, { type: row.mime_type });
}

/** Las hojas de una planilla como matrices de celdas (texto). */
export function readSheets(buffer: Buffer): Array<{ name: string; rows: unknown[][] }> {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  return wb.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name]!, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    }),
  }));
}

/** Lo que dice la línea de una planilla: si es un extracto, de qué; si no, sus hojas. */
function sheetSummary(buffer: Buffer): string {
  try {
    const parsed = parseStatement(readStatementRows(buffer));
    if (!("error" in parsed)) {
      const currency = parsed.lines[0]?.currency ?? "UYU";
      const balance = parsed.closingBalance
        ? `, saldo declarado ${parsed.closingBalance.amount} ${parsed.closingBalance.currency} al ${formatReceiptDate(parsed.closingBalance.asOf)}`
        : "";
      return `Es un extracto de ${PLATFORM_LABELS[parsed.platform]}: ${parsed.lines.length} líneas del ${formatReceiptDate(parsed.from)} al ${formatReceiptDate(parsed.to)}, en ${currency}${balance}. Para cruzarlo con el libro: revisar_extracto.`;
    }
  } catch {
    // No es un extracto: se describe como planilla.
  }
  try {
    const sheets = readSheets(buffer);
    const list = sheets.map((sh) => `"${sh.name}" (${sh.rows.length} filas)`).join(", ");
    return `Planilla con ${sheets.length} hoja(s): ${list}. Para leerla: leer_planilla.`;
  } catch {
    return "No pude leer la planilla: puede estar dañada o no ser un Excel/CSV.";
  }
}

// ─── Adjuntar a una pregunta ───────────────────────────────────────────

/**
 * Registra los archivos de una pregunta y devuelve los bloques que van
 * delante del texto. Un archivo que no pasa la verificación no corta la
 * pregunta: va como una línea que dice qué pasó, para que el asistente se
 * lo cuente al tesorero.
 */
export async function attachFiles(
  supabase: SupabaseClient,
  ctx: { localityId: string; userId: string; threadId: string },
  uploads: UploadedFileInput[]
): Promise<{ blocks: Block[]; files: AttachedFile[] }> {
  const blocks: Block[] = [];
  const files: AttachedFile[] = [];
  const prefix = `${ctx.localityId}/${ctx.userId}/`;

  for (const u of uploads.slice(0, MAX_FILES_PER_MESSAGE)) {
    const name = (u.name || "archivo").slice(0, 200);
    const kind = fileKindFor(u.type, name);
    if (typeof u.path !== "string" || !u.path.startsWith(prefix) || u.path.includes("..")) {
      blocks.push({ type: "text", text: `(El archivo "${name}" no se pudo adjuntar: la ruta no es válida.)` });
      continue;
    }
    if (!kind) {
      blocks.push({
        type: "text",
        text: `(El archivo "${name}" no se adjuntó: acepto imágenes, PDF y planillas Excel o CSV.)`,
      });
      continue;
    }
    if (u.size > MAX_FILE_BYTES) {
      blocks.push({ type: "text", text: `(El archivo "${name}" pesa más de 10 MB y no se adjuntó.)` });
      continue;
    }

    const { data, error } = await supabase
      .from("treasury_assistant_files")
      .insert({
        thread_id: ctx.threadId,
        locality_id: ctx.localityId,
        profile_id: ctx.userId,
        storage_path: u.path,
        file_name: name,
        mime_type: u.type || "application/octet-stream",
        size_bytes: Math.max(0, Math.round(u.size || 0)),
        kind,
      })
      .select(FILE_FIELDS)
      .single();
    if (error || !data) {
      const missing = /treasury_assistant_files|PGRST205|does not exist/.test(error?.message ?? "");
      blocks.push({
        type: "text",
        text: missing
          ? `(El archivo "${name}" no se adjuntó: falta aplicar la migración 092.)`
          : `(El archivo "${name}" no se pudo registrar: ${error?.message ?? "error"}.)`,
      });
      continue;
    }
    const row = data as FileRow;

    try {
      const buffer = await readFileBuffer(supabase, row);
      if (kind === "planilla") {
        blocks.push({ type: "text", text: fileNote(row, sheetSummary(buffer)) });
      } else {
        const uploaded = await anthropic().beta.files.upload({
          file: await toFile(buffer, name, { type: row.mime_type }),
          betas: [FILES_BETA],
        });
        await supabase.from("treasury_assistant_files").update({ anthropic_file_id: uploaded.id }).eq("id", row.id);
        blocks.push({
          type: "text",
          text: fileNote(row, kind === "imagen" ? "Imagen adjunta:" : "PDF adjunto:"),
        });
        blocks.push(
          kind === "imagen"
            ? { type: "image", source: { type: "file", file_id: uploaded.id } }
            : { type: "document", source: { type: "file", file_id: uploaded.id }, title: name }
        );
      }
      files.push({ id: row.id, name, kind });
    } catch (e) {
      console.error("[treasury-assistant] attach", e);
      blocks.push({
        type: "text",
        text: `(El archivo "${name}" se guardó pero no lo pude leer: ${e instanceof Error ? e.message : String(e)}.)`,
      });
    }
  }
  return { blocks, files };
}
