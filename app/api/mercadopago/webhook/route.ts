import { NextResponse } from "next/server";
import { MpError, verifyWebhookSignature } from "@/lib/mercadopago";
import { getMpSettings, handlePaymentNotice } from "@/lib/treasury-online";

/**
 * El aviso de Mercado Pago (079). La URL la manda cada cobro en su
 * `notification_url`, con la comunidad en `?loc=`: así se sabe con qué
 * token consultar el pago, porque cada Asamblea cobra en su cuenta.
 *
 * Mercado Pago avisa en dos formatos —Webhooks (`type=payment` +
 * `data.id`) e IPN (`topic=payment` + `id`)— y repite hasta recibir un
 * 2xx. Del aviso solo se usa el número de pago: el estado y el monto se
 * consultan a la API. Un error al registrar devuelve 500 para que Mercado
 * Pago reintente; todo lo demás, 200, para que deje de insistir.
 */
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(request: Request) {
  const url = new URL(request.url);
  const loc = url.searchParams.get("loc") ?? "";
  if (!UUID.test(loc)) return NextResponse.json({ ignored: "loc" });

  let body: { type?: string; topic?: string; action?: string; data?: { id?: string | number } } = {};
  try {
    body = await request.json();
  } catch {
    // IPN puede venir sin body; todo está en la query.
  }

  const type = body.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? body.topic;
  if (type !== "payment") return NextResponse.json({ ignored: type ?? "type" });

  const paymentId = String(
    url.searchParams.get("data.id") ?? body.data?.id ?? url.searchParams.get("id") ?? ""
  );
  if (!/^\d+$/.test(paymentId)) return NextResponse.json({ ignored: "id" });

  try {
    const { settings } = await getMpSettings(loc);
    if (!settings?.access_token) return NextResponse.json({ ignored: "settings" });

    // Con la clave del panel cargada, la firma tiene que cuadrar. Sin
    // clave se sigue igual: el pago se consulta con nuestro token.
    if (settings.webhook_secret && url.searchParams.has("data.id")) {
      const ok = verifyWebhookSignature({
        secret: settings.webhook_secret,
        signature: request.headers.get("x-signature"),
        requestId: request.headers.get("x-request-id"),
        dataId: paymentId,
      });
      if (!ok) {
        console.warn("[mp webhook] firma inválida", { loc, paymentId });
        return NextResponse.json({ error: "signature" }, { status: 401 });
      }
    }

    await handlePaymentNotice(loc, paymentId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Un pago que nuestro token no ve no es nuestro: no tiene sentido
    // que Mercado Pago insista.
    if (err instanceof MpError && err.status === 404) {
      return NextResponse.json({ ignored: "not-found" });
    }
    console.error("[mp webhook]", err);
    return NextResponse.json({ error: "retry" }, { status: 500 });
  }
}

// Mercado Pago a veces prueba la URL con GET.
export async function GET() {
  return NextResponse.json({ ok: true });
}
