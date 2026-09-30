import { NextResponse } from "next/server";
import {
  isCronAuthorized,
  sendDailyQuotePush,
  sendFeastDayReminders,
  sendMonthCloseReminders,
  sendSemiannualLetterReminders,
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
 *   4. El día 5, "falta cerrar <mes>" a quien lleva la Tesorería, si el
 *      mes anterior sigue abierto.
 *   5. El 1.º de marzo y el 1.º de octubre, la carta semestral a la
 *      comunidad, a quien lleva la Tesorería.
 *
 * Van juntos porque el plan Hobby de Vercel permite pocos crons diarios;
 * si en algún momento hay que separarlos, cada función es independiente.
 * Protegido por CRON_SECRET.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [quote, events, feasts, closing, letter] = await Promise.all([
    sendDailyQuotePush(),
    sendTomorrowEventReminders(),
    sendFeastDayReminders(),
    sendMonthCloseReminders().catch((e) => ({ sent: 0, error: String(e) })),
    sendSemiannualLetterReminders().catch((e) => ({ sent: 0, error: String(e) })),
  ]);
  if (closing.error) console.error(`[cron/manana] cierre: ${closing.error}`);
  if (letter.error) console.error(`[cron/manana] carta: ${letter.error}`);

  // El de la Fiesta no tumba la corrida: hasta que corra la 065 falla
  // (reminder_sent_at no existe) y los otros dos avisos tienen que salir igual.
  if (feasts.error) console.error(`[cron/manana] fiestas: ${feasts.error}`);

  if (events.error) {
    return NextResponse.json({ ok: false, quote, events, feasts, closing, letter }, { status: 500 });
  }

  return NextResponse.json({ ok: true, quote, events, feasts, closing, letter });
}
