/**
 * Los tipos del asistente de Tesorería que comparten el servidor y la
 * pantalla. Va aparte, sin `server-only`, para que el componente de
 * cliente los pueda importar (ver CLAUDE.md, regla 4).
 */

// ─── Archivos (092) ────────────────────────────────────────────────────

/** Bucket privado: `<localidad>/<persona>/<uuid>.<ext>`. */
export const ASSISTANT_BUCKET = "asistente-archivos";
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_MESSAGE = 5;
export const ACCEPTED_FILE_TYPES =
  "image/*,application/pdf,.xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";

export type FileKind = "imagen" | "pdf" | "planilla";

/** Un archivo adjunto, como lo nombran la conversación y las tarjetas. */
export type AttachedFile = { id: string; name: string; kind: FileKind };

export function fileKindFor(mime: string, name: string): FileKind | null {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (/^image\/(jpeg|png|gif|webp)$/.test(mime) || ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
    return "imagen";
  }
  if (["xlsx", "xls", "csv"].includes(ext)) return "planilla";
  return null;
}

// ─── Propuestas ────────────────────────────────────────────────────────

/** Una línea de la tarjeta de confirmación: "Cuenta · Cuenta Prex". */
export type ProposalLine = { label: string; value: string };

export type ProposalKind =
  | "movimiento"
  | "correccion"
  | "transferencia"
  | "anulacion"
  | "contra_asiento"
  | "comprobante"
  | "importar_extracto"
  /** Las acciones a mano de Conciliación; `fields.op` dice cuál. */
  | "conciliacion";

export type Proposal = {
  /** El id del tool_use que la pidió: el resultado vuelve con ese id. */
  toolUseId: string;
  kind: ProposalKind;
  title: string;
  lines: ProposalLine[];
  warnings: string[];
  /** Los campos del FormData que recibe el action del Libro. */
  fields: Record<string, string>;
  /** Archivos de la conversación que la propuesta usa: los comprobantes
   *  que se cuelgan del movimiento, o el extracto que se importa. */
  files?: AttachedFile[];
  status: "pendiente" | "hecho" | "descartado" | "fallo";
  outcome: string | null;
  /** El movimiento que quedó escrito, para que el modelo lo pueda releer. */
  entryId?: string | null;
};

export type StreamEvent =
  | { type: "thread"; id: string; title: string | null }
  /** Los archivos de la pregunta, ya registrados: la pantalla les pone el link. */
  | { type: "files"; files: AttachedFile[] }
  | { type: "text"; delta: string }
  | { type: "tool"; label: string }
  | { type: "proposals"; proposals: Proposal[] }
  | { type: "proposal"; proposal: Proposal }
  | { type: "done" }
  | { type: "error"; message: string };

/** Lo que la pantalla dibuja de una conversación guardada. */
export type DisplayItem =
  | { kind: "user"; text: string; files?: AttachedFile[] }
  | { kind: "assistant"; text: string }
  | { kind: "proposals"; proposals: Proposal[] }
  | { kind: "error"; text: string };
