import "server-only";
import { unstable_cache } from "next/cache";

/**
 * Cotizaciones del Banco Central del Uruguay.
 *
 * Es el servicio web público del BCU (SOAP, sin clave), el mismo que
 * alimenta el cuadro "Cotizaciones" de su página de cierre del mercado de
 * cambios: https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/awsbcucotizaciones
 *
 * El BCU publica solo los días hábiles, y el cierre de un día es definitivo
 * una vez publicado. Por eso "la cotización al 17 de abril" es la del
 * último cierre en o antes de esa fecha: si el 17 cae sábado, la del
 * viernes. Se pide una ventana de dos semanas hacia atrás y se toma la
 * última.
 */

const ENDPOINT =
  "https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/awsbcucotizaciones";

/** Código BCU del dólar billete ("US$ Bill" en la página del BCU). */
const USD_BILLETE = 2225;

export type BcuRate = {
  /** Fecha del cierre que se usó (puede ser anterior a la pedida). */
  date: string;
  /** Pesos por dólar. */
  rate: number;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function fetchUsdRate(dateIso: string): Promise<BcuRate | null> {
  const body = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cot="Cotiza"><soapenv:Body><cot:wsbcucotizaciones.Execute><cot:Entrada><cot:Moneda><cot:item>${USD_BILLETE}</cot:item></cot:Moneda><cot:FechaDesde>${shiftDays(dateIso, -14)}</cot:FechaDesde><cot:FechaHasta>${dateIso}</cot:FechaHasta><cot:Grupo>0</cot:Grupo></cot:Entrada></cot:wsbcucotizaciones.Execute></soapenv:Body></soapenv:Envelope>`;

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "Cotizaaction/AWSBCUCOTIZACIONES.Execute",
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`BCU respondió ${res.status}`);
  const xml = await res.text();

  // status 1 = ok; con 0 el BCU explica en <mensaje> (p. ej. sin datos).
  const status = xml.match(/<status>(\d+)<\/status>/)?.[1];
  if (status !== "1") {
    const msg = xml.match(/<mensaje>([^<]*)<\/mensaje>/)?.[1]?.trim();
    if (msg && !/no existen/i.test(msg)) throw new Error(`BCU: ${msg}`);
    return null;
  }

  let last: BcuRate | null = null;
  for (const m of xml.matchAll(/<datoscotizaciones\.dato[^>]*>([\s\S]*?)<\/datoscotizaciones\.dato>/g)) {
    const date = m[1].match(/<Fecha>(\d{4}-\d{2}-\d{2})<\/Fecha>/)?.[1];
    const tcc = Number(m[1].match(/<TCC>([\d.]+)<\/TCC>/)?.[1]);
    if (!date || !Number.isFinite(tcc) || tcc <= 0 || date > dateIso) continue;
    if (!last || date > last.date) last = { date, rate: tcc };
  }
  return last;
}

/**
 * Dólar billete del BCU al cierre de `dateIso` (o del último día hábil
 * anterior). null si el BCU no tiene datos para esa ventana; lanza si el
 * servicio no responde, para que la pantalla lo diga en vez de dejar el
 * campo vacío como si no hubiera cotización.
 *
 * Una fecha pasada no cambia nunca: se cachea un día. Hoy o adelante,
 * una hora, porque el cierre de hoy aparece a la tarde.
 */
export async function getBcuUsdRate(dateIso: string): Promise<BcuRate | null> {
  if (!ISO_DATE.test(dateIso)) return null;
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Montevideo" });
  const asOf = dateIso > today ? today : dateIso;
  return unstable_cache(() => fetchUsdRate(asOf), ["bcu-usd", asOf], {
    revalidate: asOf < today ? 86_400 : 3_600,
  })();
}
