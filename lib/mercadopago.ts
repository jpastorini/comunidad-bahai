import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Cliente mínimo de la API de Mercado Pago (Checkout Pro), sin SDK: son
 * tres llamadas y un fetch alcanza. Cada comunidad cobra en su propia
 * cuenta, así que el access token viaja por parámetro (sale de
 * `treasury_mp_settings`, 079), nunca de una variable de entorno.
 *
 * Nada de lo que llega en un aviso (webhook) se cree por sí mismo: el
 * aviso solo trae el número de pago, y el estado, el monto y la referencia
 * se consultan acá con el token de la comunidad. Así un aviso falsificado
 * solo puede hacernos mirar un pago real de nuestra propia cuenta.
 */

const API = "https://api.mercadopago.com";

export type MpPreferenceInput = {
  title: string;
  amount: number;
  currency: "UYU" | "USD";
  externalReference: string;
  payerEmail?: string | null;
  payerName?: string | null;
  notificationUrl: string;
  backUrl: string;
};

export type MpPreference = { id: string; checkoutUrl: string };

export type MpPayment = {
  id: string;
  status: string; // approved | pending | in_process | rejected | cancelled | refunded | charged_back
  statusDetail: string | null;
  amount: number;
  currency: string;
  externalReference: string | null;
  dateApproved: string | null;
  /** Lo que Mercado Pago se quedó: comisión + retenciones. 0 si no lo informa. */
  fee: number;
  /** Detalle de la comisión, para el concepto del gasto. */
  feeDetail: string;
  paymentMethod: string | null;
};

export class MpError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

async function mpFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg =
      (body && typeof body === "object" && "message" in body && String((body as { message: unknown }).message)) ||
      `HTTP ${res.status}`;
    throw new MpError(`Mercado Pago: ${msg}`, res.status);
  }
  return body as T;
}

/** Las credenciales de prueba empiezan con TEST-. */
export function isTestToken(token: string): boolean {
  return token.trim().startsWith("TEST-");
}

export async function createPreference(
  token: string,
  input: MpPreferenceInput
): Promise<MpPreference> {
  type Raw = { id: string; init_point?: string; sandbox_init_point?: string };
  const raw = await mpFetch<Raw>(token, "/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      items: [
        {
          id: "aporte",
          title: input.title,
          quantity: 1,
          unit_price: Math.round(input.amount * 100) / 100,
          currency_id: input.currency,
        },
      ],
      payer: {
        ...(input.payerEmail ? { email: input.payerEmail } : {}),
        ...(input.payerName ? { name: input.payerName } : {}),
      },
      external_reference: input.externalReference,
      notification_url: input.notificationUrl,
      back_urls: {
        success: input.backUrl,
        pending: input.backUrl,
        failure: input.backUrl,
      },
      auto_return: "approved",
      // Se cobra una vez: no tiene sentido que la preferencia quede viva
      // para siempre si la persona cierra la pestaña.
      expires: false,
    }),
  });
  const checkoutUrl = isTestToken(token)
    ? raw.sandbox_init_point ?? raw.init_point
    : raw.init_point ?? raw.sandbox_init_point;
  if (!checkoutUrl) throw new MpError("Mercado Pago no devolvió el link de pago.", 502);
  return { id: raw.id, checkoutUrl };
}

type RawPayment = {
  id: number | string;
  status: string;
  status_detail?: string | null;
  transaction_amount: number;
  currency_id: string;
  external_reference?: string | null;
  date_approved?: string | null;
  payment_method_id?: string | null;
  fee_details?: Array<{ type?: string; amount?: number; fee_payer?: string }>;
  transaction_details?: { net_received_amount?: number | null } | null;
};

function toPayment(raw: RawPayment): MpPayment {
  const amount = Number(raw.transaction_amount) || 0;
  const net = Number(raw.transaction_details?.net_received_amount);
  // Lo que se quedó Mercado Pago es bruto − neto: incluye la comisión y
  // la retención de impuestos, que `fee_details` no siempre trae.
  const fee = Number.isFinite(net) && net > 0 && net < amount ? round2(amount - net) : 0;
  const parts = (raw.fee_details ?? [])
    .filter((f) => f.fee_payer !== "payer" && Number(f.amount) > 0)
    .map((f) => `${feeLabel(f.type)} ${Number(f.amount).toFixed(2)}`);
  return {
    id: String(raw.id),
    status: raw.status,
    statusDetail: raw.status_detail ?? null,
    amount,
    currency: raw.currency_id,
    externalReference: raw.external_reference ?? null,
    dateApproved: raw.date_approved ?? null,
    fee,
    feeDetail: parts.join(" · "),
    paymentMethod: raw.payment_method_id ?? null,
  };
}

function feeLabel(type: string | undefined): string {
  if (type === "mercadopago_fee") return "comisión";
  if (type === "financing_fee") return "financiación";
  if (type === "shipping_fee") return "envío";
  return type ?? "cargo";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function getPayment(token: string, paymentId: string): Promise<MpPayment> {
  const raw = await mpFetch<RawPayment>(token, `/v1/payments/${encodeURIComponent(paymentId)}`);
  return toPayment(raw);
}

/** Los pagos de una referencia nuestra, del más nuevo al más viejo. */
export async function searchPaymentsByReference(
  token: string,
  externalReference: string
): Promise<MpPayment[]> {
  const raw = await mpFetch<{ results?: RawPayment[] }>(
    token,
    `/v1/payments/search?external_reference=${encodeURIComponent(
      externalReference
    )}&sort=date_created&criteria=desc`
  );
  return (raw.results ?? []).map(toPayment);
}

/**
 * Comprueba que el token sirve, sin cobrar nada. Se prueba contra la
 * búsqueda de pagos, que es lo que la integración usa de verdad: `/users/me`
 * devuelve "At least one policy returned UNAUTHORIZED" con tokens válidos
 * de aplicaciones de Checkout Pro (pasó con la cuenta de prueba, 2026-10-17).
 * El apodo de la cuenta es un extra: si `/users/me` no responde, se sigue.
 */
export async function checkToken(token: string): Promise<{ ok: true; nickname: string | null } | { ok: false; error: string }> {
  try {
    await mpFetch<unknown>(token, "/v1/payments/search?limit=1");
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo verificar." };
  }
  try {
    const me = await mpFetch<{ nickname?: string }>(token, "/users/me");
    return { ok: true, nickname: me.nickname ?? null };
  } catch {
    return { ok: true, nickname: null };
  }
}

/**
 * Firma de los avisos (panel de Mercado Pago → Webhooks → clave secreta).
 * El encabezado `x-signature` trae `ts=…,v1=…`; v1 es el HMAC-SHA256 en
 * hex de `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`. Si la parte
 * de request-id no viene, se omite del manifiesto.
 */
export function verifyWebhookSignature(args: {
  secret: string;
  signature: string | null;
  requestId: string | null;
  dataId: string;
}): boolean {
  if (!args.signature) return false;
  const parts = Object.fromEntries(
    args.signature.split(",").map((p) => {
      const [k, ...v] = p.trim().split("=");
      return [k, v.join("=")];
    })
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  const id = /^[a-z0-9]+$/i.test(args.dataId) ? args.dataId.toLowerCase() : args.dataId;
  let manifest = `id:${id};`;
  if (args.requestId) manifest += `request-id:${args.requestId};`;
  manifest += `ts:${ts};`;
  const expected = createHmac("sha256", args.secret).update(manifest).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
