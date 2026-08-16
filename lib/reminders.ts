import "server-only";
import { createSupabaseAdmin } from "./supabase/admin";
import { civilDayNumber, excerpt, getCitaDelDia } from "./citas";
import {
  getLocalityAdminIds,
  getLocalityMemberIds,
  sendPushToUsers,
} from "./push";

// Zona horaria civil de la comunidad. Los eventos guardan day/month/year
// planos (sin TZ), así que "mañana" se calcula como fecha civil en esta zona.
const TZ = process.env.APP_TIMEZONE || "America/Montevideo";

/** Ruta de lectura de la oración obligatoria corta (lib/oraciones.ts). */
const SHORT_OBLIGATORY_URL =
  "/oraciones/oracion-obligatoria-corta/oracion-obligatoria-corta-1";

/** Guardia de los crons: exige el CRON_SECRET si está configurado. */
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

type EventRow = {
  id: string;
  title: string;
  time: string;
  kind: string | null;
  locality_id: string | null;
};

/** Fecha civil de mañana en TZ, como {day, month, year}. Hace la aritmética
 *  sobre la fecha civil (no sobre el instante UTC) para evitar líos de DST. */
function tomorrowCivilDate(): { day: number; month: number; year: number } {
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = todayStr.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 1)); // +1 día, con rollover de mes/año
  return { day: t.getUTCDate(), month: t.getUTCMonth() + 1, year: t.getUTCFullYear() };
}

/**
 * Avisa por push de los eventos de MAÑANA a los miembros de cada localidad.
 * Marca reminder_sent_at para no duplicar en corridas siguientes.
 */
export async function sendTomorrowEventReminders(): Promise<{
  sent: number;
  error?: string;
}> {
  const supabase = createSupabaseAdmin();
  if (!supabase) return { sent: 0, error: "no-admin-client" };

  const { day, month, year } = tomorrowCivilDate();

  const { data, error } = await supabase
    .from("calendar_events")
    .select("id, title, time, kind, locality_id")
    .eq("day", day)
    .eq("month", month)
    .eq("year", year)
    .is("reminder_sent_at", null);

  if (error) return { sent: 0, error: error.message };

  const events = (data ?? []) as EventRow[];
  if (events.length === 0) return { sent: 0 };

  // Las reuniones de Asamblea (reunion_ael) solo se recuerdan a los miembros
  // de la AEL (role='admin'); el resto de eventos a toda la comunidad.
  // Cacheamos por (localidad, audiencia) para no re-consultar por evento.
  const recipientsByKey = new Map<string, string[]>();
  const processedIds: string[] = [];

  for (const ev of events) {
    if (!ev.locality_id) continue;
    const adminOnly = ev.kind === "reunion_ael";
    const cacheKey = `${ev.locality_id}:${adminOnly ? "admin" : "all"}`;
    let recipients = recipientsByKey.get(cacheKey);
    if (!recipients) {
      recipients = adminOnly
        ? await getLocalityAdminIds(ev.locality_id)
        : await getLocalityMemberIds(ev.locality_id);
      recipientsByKey.set(cacheKey, recipients);
    }
    await sendPushToUsers(recipients, {
      title: adminOnly ? "Recordatorio de reunión" : "Recordatorio de evento",
      body: `Mañana: ${ev.title}${ev.time ? ` — ${ev.time}` : ""}`,
      url: "/calendario",
      tag: `event-${ev.id}`,
    });
    processedIds.push(ev.id);
  }

  if (processedIds.length > 0) {
    await supabase
      .from("calendar_events")
      .update({ reminder_sent_at: new Date().toISOString() })
      .in("id", processedIds);
  }

  return { sent: processedIds.length };
}

/** IDs de los creyentes activos que tienen prendida una preferencia
 *  devocional. Usa service-role para no chocar con la RLS de profiles. */
async function getOptedInUserIds(
  column: "daily_quote_push_enabled" | "prayer_reminder_enabled"
): Promise<string[]> {
  const supabase = createSupabaseAdmin();
  if (!supabase) return [];
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq(column, true)
    .is("disabled_at", null);
  return ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
}

/**
 * "Lectura de hoy": manda la cita del día a quienes no la desactivaron.
 * La cita es la misma que muestra la app (determinística por fecha), así
 * que el aviso y la pantalla nunca se contradicen.
 */
export async function sendDailyQuotePush(): Promise<{ recipients: number }> {
  const userIds = await getOptedInUserIds("daily_quote_push_enabled");
  if (userIds.length === 0) return { recipients: 0 };

  const { cita, topic } = getCitaDelDia();
  await sendPushToUsers(userIds, {
    title: `Lectura de hoy · ${topic.name}`,
    body: excerpt(cita.text, 160),
    url: "/citas",
    // Un tag por día: si quedó sin leer la de ayer, la reemplaza.
    tag: `cita-${civilDayNumber()}`,
  });
  return { recipients: userIds.length };
}

/**
 * Recordatorio de la Oración Obligatoria corta (13:00). Solo a quienes lo
 * pidieron explícitamente. Abre directo el texto de la oración.
 */
export async function sendPrayerReminders(): Promise<{ recipients: number }> {
  const userIds = await getOptedInUserIds("prayer_reminder_enabled");
  if (userIds.length === 0) return { recipients: 0 };

  await sendPushToUsers(userIds, {
    title: "Oración Obligatoria",
    body: "Es la hora. Tocá para leerla.",
    url: SHORT_OBLIGATORY_URL,
    // Tag fijo: nunca se acumulan varios recordatorios en la pantalla.
    tag: "oracion-obligatoria",
  });
  return { recipients: userIds.length };
}
