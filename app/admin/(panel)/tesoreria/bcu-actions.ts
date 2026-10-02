"use server";

import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { getBcuUsdRate } from "@/lib/bcu";

/**
 * La cotización del dólar billete del BCU: el último cierre en o antes de
 * la fecha. La usan el formulario de transferencias del Libro (para
 * proponer el monto de la otra moneda) y el editor del balance (cotización
 * de cierre). No guarda nada.
 */
export async function fetchBcuRateAction(
  dateIso: string,
): Promise<{ ok: true; date: string; rate: number } | { ok: false; error: string }> {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  if (!/^d{4}-d{2}-d{2}$/.test(dateIso)) {
    return { ok: false, error: "Elegí primero la fecha." };
  }
  try {
    const r = await getBcuUsdRate(dateIso);
    if (!r) return { ok: false, error: "El BCU no tiene cotización para esa fecha." };
    return { ok: true, ...r };
  } catch (e) {
    console.error("[bcu] cotización", dateIso, e);
    return { ok: false, error: "No se pudo consultar al BCU. Probá de nuevo en un rato." };
  }
}
