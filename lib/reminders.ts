import "server-only";
import { monthLabel, monthRange } from "./treasury-cashbook";
import { getLocalityMembers } from "./memberships";
import { createSupabaseAdmin } from "./supabase/admin";
import { feastCelebration } from "./feast-schedule";
import {
  civilDateISO,
  civilDayNumber,
  excerpt,
  getCitaDelDia,
  getCitaDelMes,
} from "./citas";
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
    // Una Fiesta cargada a mano en el calendario no existe para un
    // Amigo/a de la Fe (047): tampoco se le recuerda.
    const bahaiOnly = ev.kind === "fiesta_19_dias";
    const audience = adminOnly ? "admin" : bahaiOnly ? "bahai" : "all";
    const cacheKey = `${ev.locality_id}:${audience}`;
    let recipients = recipientsByKey.get(cacheKey);
    if (!recipients) {
      recipients = adminOnly
        ? await getLocalityAdminIds(ev.locality_id)
        : await getLocalityMemberIds(ev.locality_id, { bahaiOnly });
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

/**
 * El día de la celebración de cada Fiesta de los 19 Días, avisa a TODA la
 * comunidad de creyentes de esa localidad (065). Decidido con el usuario:
 * a todos, hayan dicho "Voy" o no — el aviso es la invitación, no un
 * recordatorio de un compromiso.
 *
 * "El día" lo decide `feastCelebration()`, la MISMA regla que usa el
 * calendario: la fecha del primer lugar cargado, o la víspera si la
 * Asamblea no cargó ninguno. Si cada uno calculara por su cuenta, el aviso
 * podría decir "hoy" el día que la pantalla dice "mañana".
 *
 * Solo Fiestas publicadas o iniciadas (un borrador no existe para la
 * comunidad). `reminder_sent_at` frena los reintentos del cron.
 */
export async function sendFeastDayReminders(): Promise<{
  sent: number;
  error?: string;
}> {
  const supabase = createSupabaseAdmin();
  if (!supabase) return { sent: 0, error: "no-admin-client" };

  const today = civilDateISO();
  // La celebración cae dentro del mes bahá'í o en su víspera: alcanza con
  // mirar las Fiestas cuyo día 1 está entre 20 días atrás y 2 adelante.
  const shift = (days: number) => {
    const [y, m, d] = today.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
  };

  const { data, error } = await supabase
    .from("feasts")
    .select("id, locality_id, bahai_month_name, gregorian_date, status")
    .in("status", ["published", "in_progress"])
    .is("reminder_sent_at", null)
    .gte("gregorian_date", shift(-20))
    .lte("gregorian_date", shift(2));
  if (error) return { sent: 0, error: error.message };

  const feasts = (data ?? []) as Array<{
    id: string;
    locality_id: string | null;
    bahai_month_name: string;
    gregorian_date: string | null;
    status: string;
  }>;
  if (feasts.length === 0) return { sent: 0 };

  const { data: locRows } = await supabase
    .from("feast_locations")
    .select("feast_id, name, starts_at")
    .in("feast_id", feasts.map((f) => f.id))
    .order("starts_at", { ascending: true });
  const locsByFeast = new Map<string, Array<{ name: string; starts_at: string }>>();
  for (const l of (locRows ?? []) as Array<{ feast_id: string; name: string; starts_at: string }>) {
    const arr = locsByFeast.get(l.feast_id) ?? [];
    arr.push(l);
    locsByFeast.set(l.feast_id, arr);
  }

  const sentIds: string[] = [];
  for (const f of feasts) {
    if (!f.locality_id || !f.gregorian_date) continue;
    const locs = locsByFeast.get(f.id) ?? [];
    const when = feastCelebration(f.gregorian_date, locs[0]?.starts_at);
    if (when.date !== today) continue;

    const where =
      locs.length > 1
        ? ` en ${locs.length} lugares`
        : locs.length === 1
          ? ` en ${locs[0].name}`
          : "";
    const time = when.scheduled ? ` a las ${when.time}` : " al atardecer";
    const invite = f.status === "published" ? " Tocá para confirmar que vas." : "";

    const recipients = await getLocalityMemberIds(f.locality_id, { bahaiOnly: true });
    await sendPushToUsers(recipients, {
      title: `Hoy es la Fiesta de ${f.bahai_month_name}`,
      body: `Nos encontramos${time}${where}.${invite}`,
      url: `/fiestas/${f.id}`,
      tag: `feast-${f.id}`,
    });
    sentIds.push(f.id);
  }

  if (sentIds.length > 0) {
    await supabase
      .from("feasts")
      .update({ reminder_sent_at: new Date().toISOString() })
      .in("id", sentIds);
  }
  return { sent: sentIds.length };
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

// ─── Compromiso con el Fondo (día 10) ────────────────────────────

/** Día del mes en que sale el recordatorio del compromiso. */
const COMMITMENT_REMINDER_DAY = 10;

/** Temas de los que sale la cita del recordatorio. Hay ~30 textos únicos
 *  entre los tres, así que con doce avisos por año ninguno se repite en
 *  más de dos años. */
const COMMITMENT_TOPICS = ["sacrificio", "desprendimiento", "generosidad"];

/** La cita del mes del recordatorio, entre comillas. La usan el push del
 *  10 y el "Recordar por WhatsApp" del informe (077): las dos personas
 *  —la que tiene la app y la que no— reciben el mismo texto. */
export function commitmentQuoteOfMonth(now: Date = new Date()): string {
  const pick = getCitaDelMes(COMMITMENT_TOPICS, now);
  return pick ? `«${excerpt(pick.cita.text, 130)}»` : "";
}

type CommitmentReminderRow = {
  /** Desde la 077. */
  id?: string;
  /** NULL: registrado por el tesorero para alguien sin la app (077). A
   *  esa persona el push no le llega; la recuerda el tesorero por
   *  WhatsApp desde el informe. */
  user_id: string | null;
  contributor_id?: string | null;
  locality_id: string;
  last_reminder_sent_at: string | null;
};

type AppCommitment = CommitmentReminderRow & { user_id: string };

/**
 * Recordatorio del compromiso con el Fondo: el 10 de cada mes, a quienes
 * lo pidieron (la casilla del compromiso) y de quienes el libro TODAVÍA
 * no registra un aporte este mes.
 *
 * Tres decisiones que conviene no romper:
 *
 * - **El chequeo es positivo.** Se saltea a quien SÍ tiene un aporte
 *   cargado; si el tesorero todavía no lo cargó, a esa persona le llega
 *   el recordatorio amable igual, que es inofensivo. Al revés —decirle
 *   "no registramos tu aporte" a quien ya dio— sería el error caro.
 * - **El texto no menciona ni montos ni deudas.** Es un recordatorio
 *   con una cita de los Escritos sobre el sacrificio, no un estado de
 *   cuenta. Lo que la persona aportó lo ve en "Mis aportes".
 * - **`last_reminder_sent_at` frena el mes, no el día.** Si el cron se
 *   reintenta —o si alguna vez el aviso se mueve de hora— nadie recibe
 *   el mismo recordatorio dos veces en el mismo mes.
 *
 * Cuelga del cron de las 13:00 (el de la Oración): el plan Hobby de
 * Vercel no da para un tercer cron, y las 13:00 son "a la tarde".
 */
export async function sendCommitmentReminders(
  now: Date = new Date()
): Promise<{ recipients: number; skipped?: string; error?: string }> {
  const today = civilDateISO(now);
  const [year, month, day] = today.split("-").map(Number);
  if (day !== COMMITMENT_REMINDER_DAY) return { recipients: 0, skipped: "no-es-el-10" };

  const supabase = createSupabaseAdmin();
  if (!supabase) return { recipients: 0, error: "no-admin-client" };

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const monthStart = `${monthKey}-01`;

  const { data, error } = await supabase
    .from("treasury_commitments")
    .select("*")
    .eq("want_reminder", true)
    // Sin perfil no hay a quién mandarle el push (077).
    .not("user_id", "is", null);

  if (error) {
    // Hasta que corra la 063 no existe `locality_id`: el aviso no sale y
    // el resto del cron sigue andando.
    console.error("[sendCommitmentReminders]", error);
    return { recipients: 0, error: error.message };
  }

  // Ya avisados este mes (un reintento del cron, por ejemplo).
  const pending = ((data ?? []) as CommitmentReminderRow[]).filter(
    (c): c is AppCommitment =>
      !!c.user_id &&
      (!c.last_reminder_sent_at || c.last_reminder_sent_at < monthStart)
  );
  if (pending.length === 0) return { recipients: 0 };

  // Amigos de la Fe (047) y perfiles deshabilitados quedan afuera: el
  // Fondo no es de ellos y la pantalla no les existe.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, is_bahai")
    .in("id", pending.map((c) => c.user_id))
    .is("disabled_at", null);
  const eligible = new Set(
    ((profiles ?? []) as Array<{ id: string; is_bahai: boolean | null }>)
      .filter((p) => p.is_bahai !== false)
      .map((p) => p.id)
  );

  const candidates = pending.filter((c) => eligible.has(c.user_id));
  if (candidates.length === 0) return { recipients: 0 };

  const alreadyGave = await commitmentsWithContributionThisMonth(
    supabase,
    candidates,
    monthKey
  );

  const targets = candidates.filter((c) => !alreadyGave.has(c));
  if (targets.length === 0) return { recipients: 0 };

  const quote = commitmentQuoteOfMonth(now);

  await sendPushToUsers(
    targets.map((c) => c.user_id),
    {
      title: "Tu compromiso con el Fondo",
      body: `Con afecto te recordamos tu aporte de este mes. ${quote}`.trim(),
      url: "/tesoreria",
      // Un tag por mes: el de septiembre nunca se apila con el de agosto.
      tag: `compromiso-${monthKey}`,
    }
  );

  // Por id (077): el mismo creyente puede tener compromiso con dos Fondos
  // y haber aportado a uno solo. Antes de la 077 no hay id.
  const ids = targets.flatMap((c) => (c.id ? [c.id] : []));
  const stamp = { last_reminder_sent_at: now.toISOString() };
  if (ids.length === targets.length) {
    await supabase.from("treasury_commitments").update(stamp).in("id", ids);
  } else {
    await supabase
      .from("treasury_commitments")
      .update(stamp)
      .in("user_id", targets.map((c) => c.user_id));
  }

  return { recipients: targets.length };
}

/**
 * De los compromisos dados, cuáles ya tienen un aporte cargado en el mes.
 * Las fichas de cada uno son las vinculadas a su perfil EN SU COMUNIDAD
 * más la del propio compromiso (077). La comunidad importa porque quien
 * pertenece a su AEL y a la Comunidad Nacional (055) puede sostener un
 * compromiso con cada Fondo: haber aportado a uno no exime del otro.
 *
 * Corre con service-role, así que filtra a mano lo que la RLS del libro
 * filtraría: apertura, transferencia y anulado no son aportes.
 */
async function commitmentsWithContributionThisMonth(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  commitments: AppCommitment[],
  monthKey: string
): Promise<Set<AppCommitment>> {
  const gave = new Set<AppCommitment>();
  if (!supabase || commitments.length === 0) return gave;

  const { data: contributors } = await supabase
    .from("treasury_contributors")
    .select("id, profile_id, locality_id")
    .in("profile_id", commitments.map((c) => c.user_id));

  // ficha → compromisos que la cuentan como propia.
  const owners = new Map<string, AppCommitment[]>();
  const own = (contributorId: string, c: AppCommitment) => {
    const list = owners.get(contributorId) ?? [];
    if (!list.includes(c)) list.push(c);
    owners.set(contributorId, list);
  };
  for (const r of (contributors ?? []) as Array<{
    id: string;
    profile_id: string;
    locality_id: string;
  }>) {
    for (const c of commitments) {
      if (c.user_id === r.profile_id && c.locality_id === r.locality_id) own(r.id, c);
    }
  }
  for (const c of commitments) if (c.contributor_id) own(c.contributor_id, c);
  if (owners.size === 0) return gave;
  const [y, m] = monthKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();

  const { data: entries, error } = await supabase
    .from("treasury_entries")
    .select("contributor_id, amount, is_opening_balance, transfer_group_id, voided_at")
    .in("contributor_id", [...owners.keys()])
    .gte("entry_date", `${monthKey}-01`)
    .lte("entry_date", `${monthKey}-${String(lastDay).padStart(2, "0")}`);

  if (error) {
    // Sin saber quién aportó, el aviso sale para todos: un recordatorio
    // amable de más es mucho menos malo que ninguno.
    console.error("[commitmentsWithContributionThisMonth]", error);
    return gave;
  }

  for (const e of (entries ?? []) as Array<{
    contributor_id: string;
    amount: number | string;
    is_opening_balance: boolean;
    transfer_group_id: string | null;
    voided_at: string | null;
  }>) {
    if (Number(e.amount) <= 0) continue;
    if (e.is_opening_balance || e.transfer_group_id || e.voided_at) continue;
    for (const c of owners.get(e.contributor_id) ?? []) gave.add(c);
  }
  return gave;
}

/**
 * El día 5 de cada mes, a quien tiene el tag de Tesorería en cada
 * comunidad: el mes anterior sigue abierto. El tablero del Inicio ya lo
 * dice, pero un tesorero nuevo puede no abrir el panel en semanas; el
 * push llega igual. Solo el día 5 (el cron corre a diario), solo si el
 * libro de esa comunidad tiene movimientos hasta ese mes, y solo si el
 * mes no está cerrado.
 */
export async function sendMonthCloseReminders(): Promise<{ sent: number; error?: string }> {
  const supabase = createSupabaseAdmin();
  if (!supabase) return { sent: 0, error: "no-admin-client" };
  const today = civilDateISO();
  if (today.slice(8, 10) !== "05") return { sent: 0 };

  const [y, m] = today.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 2, 1));
  const prevKey = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
  const { to } = monthRange(prevKey);

  const { data: locs, error } = await supabase.from("localities").select("id, name");
  if (error) return { sent: 0, error: error.message };

  let sent = 0;
  for (const loc of (locs ?? []) as Array<{ id: string; name: string }>) {
    const { count } = await supabase
      .from("treasury_entries")
      .select("id", { count: "exact", head: true })
      .eq("locality_id", loc.id)
      .lte("entry_date", to);
    if (!count) continue;
    const { data: closed } = await supabase
      .from("treasury_closings")
      .select("id")
      .eq("locality_id", loc.id)
      .eq("period_month", `${prevKey}-01`)
      .eq("status", "closed")
      .limit(1);
    if ((closed ?? []).length > 0) continue;
    const members = await getLocalityMembers(supabase, loc.id);
    const ids = members.filter((mm) => mm.can_manage_treasury).map((mm) => mm.id);
    if (ids.length === 0) continue;
    await sendPushToUsers(ids, {
      title: `Falta cerrar ${monthLabel(prevKey).toLowerCase()}`,
      body: `El mes terminó y sigue abierto en ${loc.name}. Antes de cerrar: todo cargado, el extracto conciliado y la auditoría corrida. La Guía del mes te lleva paso a paso.`,
      url: "/admin/tesoreria/libro/cierres",
      tag: `cierre-${prevKey}`,
    });
    sent += ids.length;
  }
  return { sent };
}

/**
 * La carta semestral a la comunidad: el 1.º de marzo y el 1.º de octubre,
 * a quien tiene el tag de Tesorería en cada comunidad. Es una costumbre
 * de la Asamblea (estado del Fondo, necesidades, agradecimiento), no un
 * dato, así que el aviso no comprueba nada: recuerda. El tablero y la
 * Guía lo repiten durante el mes; esto llega aunque nadie abra el panel.
 */
export async function sendSemiannualLetterReminders(): Promise<{ sent: number; error?: string }> {
  const supabase = createSupabaseAdmin();
  if (!supabase) return { sent: 0, error: "no-admin-client" };
  const today = civilDateISO();
  const month = today.slice(5, 7);
  if (today.slice(8, 10) !== "01" || (month !== "03" && month !== "10")) return { sent: 0 };

  const { data: locs, error } = await supabase.from("localities").select("id, name");
  if (error) return { sent: 0, error: error.message };

  let sent = 0;
  for (const loc of (locs ?? []) as Array<{ id: string; name: string }>) {
    const members = await getLocalityMembers(supabase, loc.id);
    const ids = members.filter((m) => m.can_manage_treasury).map((m) => m.id);
    if (ids.length === 0) continue;
    await sendPushToUsers(ids, {
      title: "Este mes toca la carta a la comunidad",
      body: `${loc.name}: el estado del Fondo, las necesidades del ejercicio y el agradecimiento por las contribuciones y los sacrificios. Compartí primero el estado del Fondo y escribila como comunicado.`,
      url: "/admin/tesoreria/guia",
      tag: `carta-${today.slice(0, 7)}`,
    });
    sent += ids.length;
  }
  return { sent };
}
