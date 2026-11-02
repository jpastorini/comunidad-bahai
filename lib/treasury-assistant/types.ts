/**
 * Los tipos del asistente de Tesorería que comparten el servidor y la
 * pantalla. Va aparte, sin `server-only`, para que el componente de
 * cliente los pueda importar (ver CLAUDE.md, regla 4).
 */

/** Una línea de la tarjeta de confirmación: "Cuenta · Cuenta Prex". */
export type ProposalLine = { label: string; value: string };

export type ProposalKind = "movimiento" | "correccion" | "transferencia" | "anulacion" | "contra_asiento";

export type Proposal = {
  /** El id del tool_use que la pidió: el resultado vuelve con ese id. */
  toolUseId: string;
  kind: ProposalKind;
  title: string;
  lines: ProposalLine[];
  warnings: string[];
  /** Los campos del FormData que recibe el action del Libro. */
  fields: Record<string, string>;
  status: "pendiente" | "hecho" | "descartado" | "fallo";
  outcome: string | null;
  /** El movimiento que quedó escrito, para que el modelo lo pueda releer. */
  entryId?: string | null;
};

export type StreamEvent =
  | { type: "thread"; id: string; title: string | null }
  | { type: "text"; delta: string }
  | { type: "tool"; label: string }
  | { type: "proposals"; proposals: Proposal[] }
  | { type: "proposal"; proposal: Proposal }
  | { type: "done" }
  | { type: "error"; message: string };

/** Lo que la pantalla dibuja de una conversación guardada. */
export type DisplayItem =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "proposals"; proposals: Proposal[] }
  | { kind: "error"; text: string };
