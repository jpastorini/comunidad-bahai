"use server";

import { headers } from "next/headers";
import { requireBahai } from "@/lib/auth";
import { parseMoney } from "@/lib/treasury-format";
import { MAX_AMOUNT, MIN_AMOUNT, startOnlineContribution } from "@/lib/treasury-online";

type Result = { url: string | null; error: string | null };

/**
 * "Pagar con Mercado Pago" (079). Crea el intento y el cobro y devuelve el
 * link; el navegador navega solo. Devolver la URL en vez de `redirect()`
 * es a propósito: un redirect a otro dominio desde un server action no
 * siempre sale de la PWA instalada.
 *
 * Solo creyentes: el aporte al Fondo es un privilegio de los bahá'ís, y
 * `requireBahai()` lo sostiene igual que en el resto de la Tesorería.
 */
export async function startAporteAction(formData: FormData): Promise<Result> {
  const session = await requireBahai("/tesoreria/aportar");

  // En es-UY el punto separa miles: "1.500" son mil quinientos, no 1,50.
  const raw = ((formData.get("amount") as string) || "").trim();
  const amount = parseMoney(raw.includes(",") ? raw : raw.replace(/\./g, ""));
  const fundId = ((formData.get("fund_id") as string) || "").trim();
  const receiptName = ((formData.get("receipt_name") as string) || "").trim().slice(0, 120) || null;

  if (!Number.isFinite(amount) || amount < MIN_AMOUNT) {
    return { url: null, error: `El aporte mínimo por Mercado Pago es de $ ${MIN_AMOUNT}.` };
  }
  if (amount > MAX_AMOUNT) {
    return { url: null, error: "Para un aporte de ese monto, hablá con el tesorero." };
  }
  if (!fundId) return { url: null, error: "Elegí el fondo." };

  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  try {
    const url = await startOnlineContribution({
      localityId: session.locality.id,
      localityName: session.locality.name,
      profileId: session.user.id,
      payerEmail: session.user.email || null,
      payerName: session.profile.full_name ?? null,
      fundId,
      amount: Math.round(amount * 100) / 100,
      receiptName,
      origin: `${proto}://${host}`,
    });
    return { url, error: null };
  } catch (err) {
    console.error("[startAporteAction]", err);
    return {
      url: null,
      error: err instanceof Error ? err.message : "No se pudo iniciar el pago.",
    };
  }
}
