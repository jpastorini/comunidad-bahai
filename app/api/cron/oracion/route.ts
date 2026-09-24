import { NextResponse } from "next/server";
import {
  isCronAuthorized,
  sendCommitmentReminders,
  sendPrayerReminders,
} from "@/lib/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron de la Oración Obligatoria (Vercel Cron, 13:00 hora de la comunidad
 * = 16:00 UTC). Avisa solo a quienes prendieron el recordatorio.
 *
 * Las 13:00 caen siempre dentro de la ventana de la oración corta (entre el
 * mediodía y la puesta del sol) en cualquier época del año, así que no hace
 * falta calcular horarios solares. Protegido por CRON_SECRET.
 *
 * Cuelga de acá también el recordatorio del compromiso con el Fondo, que
 * sale el 10 de cada mes (la propia función se saltea los demás días):
 * el plan Hobby de Vercel no da para un tercer cron y "a la tarde" en la
 * comunidad empieza a esta hora.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [prayer, commitments] = await Promise.all([
    sendPrayerReminders(),
    sendCommitmentReminders(),
  ]);
  return NextResponse.json({ ok: true, prayer, commitments });
}
