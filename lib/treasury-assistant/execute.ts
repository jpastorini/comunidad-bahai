import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  revertEntryAction,
  saveEntryAction,
  saveTransferAction,
  voidEntryAction,
} from "@/app/admin/(panel)/tesoreria/libro/actions";
import { uploadAttachmentAction } from "@/app/admin/(panel)/tesoreria/libro/attachment-actions";
import {
  dismissLineAction,
  importStatementAction,
  linkLineAction,
  markOffBankAction,
  rematchAction,
  undoLineAction,
  unmarkOffBankAction,
} from "@/app/admin/(panel)/tesoreria/conciliacion/actions";
import { PLATFORM_LABELS } from "@/lib/bank-statements";
import { getFile, readAsFile } from "./files";
import type { AttachedFile, Proposal } from "./types";

/**
 * Ejecuta una propuesta que el tesorero CONFIRMÓ, por el mismo server
 * action que usa el formulario del Libro (o de Conciliación). No hay un
 * segundo camino de escritura: autenticación, tag, mes cerrado, recibo
 * emitido, numeración correlativa y aviso al creyente son los de siempre.
 *
 * Los archivos de la conversación (092) se leen del bucket del asistente y
 * se le pasan al action como si la persona los hubiera elegido en esa
 * pantalla: el comprobante termina en `treasury-receipts` y el extracto en
 * `extractos`, cada uno con su copia.
 */
export async function executeProposal(
  supabase: SupabaseClient,
  p: Proposal
): Promise<{ ok: boolean; message: string; entryId?: string | null }> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(p.fields)) fd.set(k, v);

  switch (p.kind) {
    case "movimiento":
    case "correccion": {
      const r = await saveEntryAction(fd);
      if (!r.ok) return { ok: false, message: r.error ?? "No se pudo guardar." };
      const base = p.kind === "movimiento" ? "Registrado en el libro." : "Corregido en el libro.";
      const attached = r.id ? await attachReceipts(supabase, r.id, p.files ?? []) : "";
      return { ok: true, message: `${base}${attached}`, entryId: r.id };
    }
    case "comprobante": {
      const entryId = p.fields.entry_id;
      const attached = await attachReceipts(supabase, entryId, p.files ?? []);
      const failed = attached.includes("no se pudo");
      return { ok: !failed, message: attached.trim() || "No había comprobantes para adjuntar.", entryId };
    }
    case "importar_extracto": {
      const row = await getFile(supabase, p.files?.[0]?.id ?? null);
      if (!row) return { ok: false, message: "El archivo ya no está en la conversación." };
      fd.set("file", await readAsFile(supabase, row));
      const r = await importStatementAction(fd);
      if (!r.ok) return { ok: false, message: r.error };
      const parts = [
        `Extracto de ${PLATFORM_LABELS[r.platform]} importado: ${r.newCount} líneas nuevas`,
        r.knownCount > 0 ? `${r.knownCount} ya estaban` : null,
        `${r.matchedCount} cerraron con el libro`,
        r.dismissedCount > 0 ? `${r.dismissedCount} descartadas por devolución` : null,
      ].filter(Boolean);
      const warnings = r.warnings.length > 0 ? ` Avisos: ${r.warnings.join(" ")}` : "";
      return { ok: true, message: `${parts.join(", ")}.${warnings}` };
    }
    case "conciliacion":
      return executeReconciliation(p.fields);
    case "transferencia": {
      const r = await saveTransferAction(fd);
      return r.ok
        ? { ok: true, message: "Transferencia registrada en el libro." }
        : { ok: false, message: r.error ?? "No se pudo guardar." };
    }
    case "anulacion": {
      const r = await voidEntryAction(fd);
      return r.ok
        ? { ok: true, message: "Movimiento anulado." }
        : { ok: false, message: r.error ?? "No se pudo anular." };
    }
    case "contra_asiento": {
      const r = await revertEntryAction(fd);
      return r.ok
        ? { ok: true, message: "Contra-asiento registrado con fecha de hoy." }
        : { ok: false, message: r.error ?? "No se pudo revertir." };
    }
  }
}

const ids = (raw: string | undefined): string[] => {
  try {
    const v = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

/**
 * Las acciones a mano de Conciliación, por los mismos actions que los
 * botones de esa pantalla. Vincular arma un grupo con el mínimo de pares
 * que lo conecta (la primera línea con cada movimiento, y cada otra línea
 * con el primer movimiento): la pantalla lo agrupa igual (089).
 */
async function executeReconciliation(
  f: Record<string, string>
): Promise<{ ok: boolean; message: string }> {
  const fail = (error: string | null, fallback: string) => ({ ok: false, message: error ?? fallback });
  switch (f.op) {
    case "vincular": {
      const lines = ids(f.lines);
      const entries = ids(f.entries);
      if (lines.length === 0 || entries.length === 0) return { ok: false, message: "La propuesta no trae qué vincular." };
      const pairs: Array<[string, string]> = [
        ...entries.map((e): [string, string] => [lines[0], e]),
        ...lines.slice(1).map((l): [string, string] => [l, entries[0]]),
      ];
      let done = 0;
      for (const [line, entry] of pairs) {
        const r = await linkLineAction(line, entry);
        if (!r.ok && !r.error?.includes("ya está vinculado")) {
          const partial = done > 0 ? ` (${done} de ${pairs.length} pares quedaron hechos; revisalo en Conciliación)` : "";
          return { ok: false, message: `${r.error ?? "No se pudo vincular."}${partial}` };
        }
        done++;
      }
      return { ok: true, message: "Vinculado en Conciliación." };
    }
    case "descartar": {
      const r = await dismissLineAction(f.line_id, f.reason);
      return r.ok ? { ok: true, message: "La línea quedó como que no corresponde al libro." } : fail(r.error, "No se pudo descartar.");
    }
    case "deshacer": {
      const r = await undoLineAction(ids(f.lines));
      return r.ok ? { ok: true, message: "La línea volvió a pendientes." } : fail(r.error, "No se pudo deshacer.");
    }
    case "sin_banco": {
      const r = await markOffBankAction(f.entry_id, f.reason);
      return r.ok ? { ok: true, message: "Marcado: no pasa por el banco." } : fail(r.error, "No se pudo marcar.");
    }
    case "quitar_sin_banco": {
      const r = await unmarkOffBankAction(f.entry_id);
      return r.ok ? { ok: true, message: "Se quitó la marca: vuelve a esperar su línea." } : fail(r.error, "No se pudo quitar la marca.");
    }
    case "recruzar": {
      const r = await rematchAction(f.account_id);
      if (!r.ok) return fail(r.error, "No se pudo cruzar.");
      const n = r.matchedCount ?? 0;
      return {
        ok: true,
        message: n === 0 ? "Cruce hecho: no apareció ningún par nuevo." : `Cruce hecho: ${n === 1 ? "un par nuevo" : `${n} pares nuevos`}.`,
      };
    }
    default:
      return { ok: false, message: "Acción de conciliación desconocida." };
  }
}

/**
 * Cuelga los archivos del movimiento como comprobantes. Si uno falla, el
 * movimiento ya quedó guardado y se avisa sin deshacerlo: perder el
 * asiento es peor que perder la foto (mismo criterio que `EntryForm`).
 */
async function attachReceipts(supabase: SupabaseClient, entryId: string, files: AttachedFile[]): Promise<string> {
  if (files.length === 0) return "";
  const failed: string[] = [];
  let done = 0;
  for (const f of files) {
    try {
      const row = await getFile(supabase, f.id);
      if (!row) throw new Error("ya no está en la conversación");
      const fd = new FormData();
      fd.set("entry_id", entryId);
      fd.set("file", await readAsFile(supabase, row));
      const r = await uploadAttachmentAction(fd);
      if (!r.ok) throw new Error(r.error ?? "error");
      done++;
    } catch (e) {
      failed.push(`"${f.name}" (${e instanceof Error ? e.message : String(e)})`);
    }
  }
  const okPart = done > 0 ? ` ${done === 1 ? "Comprobante adjuntado" : `${done} comprobantes adjuntados`}.` : "";
  const failPart = failed.length > 0 ? ` El comprobante no se pudo adjuntar: ${failed.join(", ")}; subilo desde el Libro.` : "";
  return okPart + failPart;
}
