import { NextResponse } from "next/server";
import {
  isCronAuthorized,
  sendDailyQuotePush,
  sendFeastDayReminders,
  sendTomorrowEventReminders,
} from "@/lib/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron de la mañana (Vercel Cron, 08:00 hora de la comunidad = 11:00 UTC).
 * Junta los avisos matutinos en una sola corrida:
 *   1. "Lectura de hoy" — la cita de los Escritos Sagrados del día.
 *   2. Recordatorio de los eventos de mañana.
 *   3. "Hoy es la Fiesta de …" el día de la celebración (065).
 *
 * Van juntos porque el plan Hobby de Vercel permite pocos crons diarios;
 * si en algún momento hay que separarlos, cada función es independiente.
 * Protegido por CRON_SECRET.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [quote, events, feasts] = await Promise.all([
    sendDailyQuotePush(),
    sendTomorrowEventReminders(),
    sendFeastDayReminders(),
  ]);

  // El de la Fiesta no tumba la corrida: hasta que corra la 065 falla
  // (reminder_sent_at no existe) y los otros dos avisos tienen que salir igual.
  if (feasts.error) console.error(`[cron/manana] fiestas: ${feasts.error}`);

  if (events.error) {
    return NextResponse.json({ ok: false, quote, events, feasts }, { status: 500 });
  }

  return NextResponse.json({ ok: true, quote, events, feasts });
}
