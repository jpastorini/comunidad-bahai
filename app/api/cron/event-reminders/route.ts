import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getLocalityAdminIds,
  getLocalityMemberIds,
  sendPushToUsers,
} from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Zona horaria civil de la comunidad. Los eventos guardan day/month/year
// planos (sin TZ), así que "mañana" se calcula como fecha civil en esta zona.
const TZ = process.env.APP_TIMEZONE || "America/Montevideo";

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
 * Cron diario (Vercel Cron, 10:00 ART): avisa por push de los eventos de
 * MAÑANA a todos los miembros de cada localidad. Marca reminder_sent_at para
 * no duplicar en corridas siguientes. Protegido por CRON_SECRET.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const supabase = createSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "no-admin-client" }, { status: 500 });
  }

  const { day, month, year } = tomorrowCivilDate();

  const { data, error } = await supabase
    .from("calendar_events")
    .select("id, title, time, kind, locality_id")
    .eq("day", day)
    .eq("month", month)
    .eq("year", year)
    .is("reminder_sent_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const events = (data ?? []) as EventRow[];
  if (events.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

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

  return NextResponse.json({ ok: true, sent: processedIds.length });
}
