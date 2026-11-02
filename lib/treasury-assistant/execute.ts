import "server-only";
import {
  revertEntryAction,
  saveEntryAction,
  saveTransferAction,
  voidEntryAction,
} from "@/app/admin/(panel)/tesoreria/libro/actions";
import type { Proposal } from "./tools";

/**
 * Ejecuta una propuesta que el tesorero CONFIRMÓ, por el mismo server
 * action que usa el formulario del Libro. No hay un segundo camino de
 * escritura: autenticación, tag, mes cerrado, recibo emitido, numeración
 * correlativa y aviso al creyente son los de siempre.
 */
export async function executeProposal(
  p: Proposal
): Promise<{ ok: boolean; message: string; entryId?: string | null }> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(p.fields)) fd.set(k, v);

  switch (p.kind) {
    case "movimiento":
    case "correccion": {
      const r = await saveEntryAction(fd);
      if (!r.ok) return { ok: false, message: r.error ?? "No se pudo guardar." };
      return {
        ok: true,
        message: p.kind === "movimiento" ? "Registrado en el libro." : "Corregido en el libro.",
        entryId: r.id,
      };
    }
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
