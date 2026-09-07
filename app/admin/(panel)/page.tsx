import Link from "next/link";
import { Banner, Card, PageHeader } from "@/components/admin/ui";
import {
  IconActividades,
  IconArrowRight,
  IconBell,
  IconCalendario,
  IconCheck,
  IconChat,
  IconMensajes,
  IconOraciones,
  IconServicio,
} from "@/components/Icons";
import {
  getLatestComunicadoWithReads,
  getNextFeast,
  getTasksSummary,
  getWeekAhead,
} from "@/lib/admin-attention";
import { requireAdmin } from "@/lib/auth";
import { getAvailabilityFillStats } from "@/lib/availability-data";
import { getChatDuty } from "@/lib/data";
import { formatDate, formatMessageDate } from "@/lib/format";
import { getLocalityPushReach } from "@/lib/push";
import type { ChatTopic, FeastStatus } from "@/lib/types";

/**
 * Inicio del panel como tablero de ATENCIÓN. Cada tarjeta responde a una
 * pregunta que la Asamblea se hace al abrir el panel ("¿hay tareas
 * vencidas?", "¿la Fiesta está publicada?", "¿quién no vio el último
 * comunicado?"), no cuántas filas hay en una tabla. Los totales de
 * actividades, materiales o eventos se fueron: no llevan a ninguna acción.
 *
 * El tono de cada tarjeta lo decide el dato: neutro cuando está todo en
 * orden, ámbar cuando hay algo por hacer, rojo cuando algo se venció.
 */

type Tone = "ok" | "warn" | "alert";

const TONE = {
  ok: { color: "#6A8B5F", bg: "#6A8B5F0D", border: "#6A8B5F33" },
  warn: { color: "#B7791F", bg: "#B7791F0D", border: "#B7791F33" },
  alert: { color: "#B42318", bg: "#B423180D", border: "#B4231833" },
} as const;

const FEAST_STATUS: Record<FeastStatus, { label: string; tone: Tone }> = {
  draft: { label: "Sin publicar", tone: "warn" },
  published: { label: "Publicada", tone: "ok" },
  in_progress: { label: "Iniciada", tone: "ok" },
};

const CHAT_HREF: Record<ChatTopic, string> = {
  secretaria: "/admin/chat",
  tesoreria: "/admin/tesoreria/chat",
};

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const session = await requireAdmin();
  const localityId = session.locality.id;

  const [tasks, chatDuty, comunicado, feast, week, availability, push] =
    await Promise.all([
      getTasksSummary(),
      getChatDuty(session.profile),
      getLatestComunicadoWithReads(localityId),
      getNextFeast(),
      getWeekAhead(7),
      getAvailabilityFillStats(localityId),
      getLocalityPushReach(localityId),
    ]);

  const tagError = searchParams.error;
  const firstName = (session.profile.full_name?.split(" ")[0] ?? "creyente").trim();

  // Tono de cada tarjeta, derivado del dato.
  const tasksTone: Tone =
    tasks.overdue > 0 ? "alert" : tasks.pending > 0 ? "warn" : "ok";
  const feastTone: Tone = feast ? FEAST_STATUS[feast.feast.status].tone : "warn";
  const availabilityTone: Tone =
    availability.total === 0 || availability.missing.length === 0 ? "ok" : "warn";
  const pushRatio = push.total ? push.withPush / push.total : 0;
  const pushTone: Tone = pushRatio >= 0.6 ? "ok" : "warn";

  return (
    <>
      <PageHeader
        eyebrow="Panel"
        title={`Hola, ${firstName}`}
        description={`Lo que hoy pide atención en ${session.locality.name}.`}
      />

      {tagError === "no-chat-tag" && (
        <div className="mb-4">
          <Banner tone="warning">
            No tenés el permiso de chat. Pedile a otro miembro de la Asamblea que
            lo active en tu ficha, en Creyentes.
          </Banner>
        </div>
      )}
      {tagError === "no-treasury-tag" && (
        <div className="mb-4">
          <Banner tone="warning">
            No tenés el permiso de Tesorería. Pedile a otro miembro de la Asamblea
            que lo active en tu ficha, en Creyentes.
          </Banner>
        </div>
      )}

      {/* Fila 1: lo urgente. Tareas, chats que atiende, la próxima Fiesta. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
        <AttentionTile
          href="/admin/tareas"
          tone={tasksTone}
          Icon={IconCheck}
          label="Tareas de la Asamblea"
          value={tasks.pending}
          hint={
            tasks.pending === 0
              ? "Nada pendiente."
              : tasks.overdue > 0
                ? `${tasks.overdue} ${tasks.overdue === 1 ? "vencida" : "vencidas"}${
                    tasks.dueSoon > 0 ? ` · ${tasks.dueSoon} para esta semana` : ""
                  }`
                : tasks.dueSoon > 0
                  ? `${tasks.dueSoon} ${tasks.dueSoon === 1 ? "vence" : "vencen"} esta semana`
                  : "Sin fecha próxima."
          }
          cta="Ver tareas"
        />

        {chatDuty.map((duty) => (
          <AttentionTile
            key={duty.topic}
            href={CHAT_HREF[duty.topic]}
            tone={duty.pending === null ? "warn" : duty.pending > 0 ? "warn" : "ok"}
            Icon={IconChat}
            label={
              duty.topic === "secretaria" ? "Chat de Secretaría" : "Mensajes al tesorero"
            }
            value={duty.pending ?? "—"}
            hint={
              duty.pending === null
                ? "No pudimos leer la bandeja."
                : duty.pending === 0
                  ? "Sin mensajes por responder."
                  : duty.pending === 1
                    ? "1 mensaje sin responder."
                    : `${duty.pending} mensajes sin responder.`
            }
            cta="Abrir bandeja"
          />
        ))}

        <AttentionTile
          href={feast ? `/admin/fiestas/${feast.feast.id}` : "/admin/fiestas"}
          tone={feastTone}
          Icon={IconOraciones}
          label={feast ? `Fiesta de ${feast.feast.bahai_month_name}` : "Próxima Fiesta"}
          value={
            feast
              ? feast.daysUntil <= 0
                ? "Hoy"
                : feast.daysUntil === 1
                  ? "Mañana"
                  : `${feast.daysUntil} días`
              : "—"
          }
          hint={
            feast
              ? `${formatDate(feast.celebrationDate)} · ${FEAST_STATUS[feast.feast.status].label}`
              : "No hay Fiestas cargadas para lo que viene."
          }
          cta={feast?.feast.status === "draft" ? "Preparar y publicar" : "Ver la Fiesta"}
        />
      </div>

      {/* Fila 2: listas cortas. La semana, el último comunicado, la Asamblea. */}
      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:gap-4">
        <Card>
          <CardTitle
            Icon={IconCalendario}
            title="Próximos 7 días"
            href="/admin/calendario"
            linkLabel="Calendario"
          />
          {week.length === 0 ? (
            <p className="mt-3 text-[13px] text-muted">
              Nada en la agenda hasta la semana que viene.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-black/[0.05]">
              {week.slice(0, 6).map((it) => (
                <li key={`${it.source}-${it.id}`}>
                  <Link
                    href={it.adminHref}
                    className="flex items-center gap-3 py-2 text-[13px] hover:text-terra"
                  >
                    <span
                      className="w-12 shrink-0 font-display text-[15px] font-bold"
                      style={{ color: it.color }}
                    >
                      {String(it.day).padStart(2, "0")}/{String(it.month).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-dark">
                      {it.title}
                    </span>
                    <span className="shrink-0 text-[11.5px] text-muted">{it.time}</span>
                  </Link>
                </li>
              ))}
              {week.length > 6 && (
                <li className="pt-2 text-[12px] text-muted">
                  y {week.length - 6} más en el calendario
                </li>
              )}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle
            Icon={IconMensajes}
            title="Último comunicado"
            href="/admin/comunicados"
            linkLabel="Comunicados"
          />
          {!comunicado ? (
            <p className="mt-3 text-[13px] text-muted">
              La Asamblea todavía no publicó ningún comunicado.
            </p>
          ) : (
            <div className="mt-3">
              <Link
                href={`/admin/comunicados/${comunicado.message.id}/lectura`}
                className="block hover:text-terra"
              >
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {formatMessageDate(comunicado.message.date)}
                </div>
                <div className="mt-0.5 font-display text-[17px] font-semibold leading-snug text-dark">
                  {comunicado.message.title}
                </div>
              </Link>
              {comunicado.reads ? (
                <ReadBar
                  reads={comunicado.reads}
                  askConfirmation={!!comunicado.message.ask_confirmation}
                  href={`/admin/comunicados/${comunicado.message.id}/lectura`}
                />
              ) : (
                <p className="mt-3 text-[12px] text-muted">
                  Sin datos de lectura todavía.
                </p>
              )}
            </div>
          )}
        </Card>

        <Card>
          <CardTitle
            Icon={IconActividades}
            title="Disponibilidad para reuniones"
            href="/admin/disponibilidad"
            linkLabel="Reuniones"
          />
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className="font-display text-[32px] font-bold leading-none"
              style={{ color: TONE[availabilityTone].color }}
            >
              {availability.filled}
              <span className="text-[18px] text-muted"> / {availability.total}</span>
            </span>
            <span className="text-[12.5px] text-muted">
              {availability.total === 1 ? "miembro cargó" : "miembros cargaron"} su grilla
            </span>
          </div>
          {availability.missing.length > 0 ? (
            <p className="mt-2 text-[13px] text-dark">
              <span className="font-semibold">
                {availability.missing.length === 1 ? "Falta" : "Faltan"}:
              </span>{" "}
              {availability.missing.join(", ")}
            </p>
          ) : (
            availability.total > 0 && (
              <p className="mt-2 text-[13px] text-muted">Toda la Asamblea cargó la suya.</p>
            )
          )}
        </Card>

        <Card>
          <CardTitle
            Icon={IconBell}
            title="Avisos en el celular"
            href="/admin/uso"
            linkLabel="Uso de la app"
          />
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className="font-display text-[32px] font-bold leading-none"
              style={{ color: TONE[pushTone].color }}
            >
              {push.withPush}
              <span className="text-[18px] text-muted"> / {push.total}</span>
            </span>
            <span className="text-[12.5px] text-muted">
              {push.total === 1 ? "persona recibe" : "personas reciben"} los avisos push
            </span>
          </div>
          <p className="mt-2 text-[13px] text-muted">
            {push.total === 0
              ? "Todavía no hay nadie en la localidad."
              : pushTone === "ok"
                ? "A la mayoría le llega la notificación cuando publicás algo."
                : "A menos de dos tercios les llega la notificación. En Uso de la app se ve quién no la tiene."}
          </p>
        </Card>
      </div>

      {/* Fila 3: crear. Los atajos de siempre, sin la tarjeta de permisos
          (que ya está en el pie del menú). */}
      <Card className="mt-4">
        <h2 className="font-display text-[18px] font-semibold text-dark">Crear</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <CreateLink href="/admin/comunicados/nuevo" Icon={IconMensajes} label="Comunicado" />
          <CreateLink href="/admin/calendario/nuevo" Icon={IconCalendario} label="Evento" />
          <CreateLink href="/admin/actividades/nueva" Icon={IconActividades} label="Actividad" />
          <CreateLink href="/admin/tareas/nueva" Icon={IconCheck} label="Tarea" />
          <CreateLink href="/admin/servicio/nueva" Icon={IconServicio} label="Necesidad de servicio" />
        </div>
      </Card>
    </>
  );
}

function AttentionTile({
  href,
  tone,
  Icon,
  label,
  value,
  hint,
  cta,
}: {
  href: string;
  tone: Tone;
  Icon: typeof IconMensajes;
  label: string;
  value: number | string;
  hint: string;
  cta: string;
}) {
  const t = TONE[tone];
  return (
    <Link
      href={href}
      className="tap group flex flex-col gap-4 rounded-2xl border p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-elevated md:p-6"
      style={{ background: t.bg, borderColor: t.border }}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: `${t.color}1F`, color: t.color }}
        >
          <Icon size={24} />
        </div>
        <span
          className="font-display text-[38px] font-bold leading-none"
          style={{ color: t.color }}
        >
          {value}
        </span>
      </div>
      <div>
        <div className="text-[15px] font-semibold text-dark">{label}</div>
        <div className="mt-0.5 text-[12.5px] text-muted">{hint}</div>
      </div>
      <span
        className="mt-auto inline-flex items-center gap-1 text-[12px] font-semibold transition group-hover:gap-2"
        style={{ color: t.color }}
      >
        {cta} <IconArrowRight size={12} />
      </span>
    </Link>
  );
}

function CardTitle({
  Icon,
  title,
  href,
  linkLabel,
}: {
  Icon: typeof IconMensajes;
  title: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 font-display text-[18px] font-semibold text-dark">
        <Icon size={18} className="text-muted" />
        {title}
      </h2>
      <Link
        href={href}
        className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-terra hover:underline"
      >
        {linkLabel} <IconArrowRight size={11} />
      </Link>
    </div>
  );
}

/** Vistos (y confirmados, si se pidieron) sobre la audiencia del comunicado. */
function ReadBar({
  reads,
  askConfirmation,
  href,
}: {
  reads: { total: number; seen: number; confirmed: number };
  askConfirmation: boolean;
  href: string;
}) {
  const pct = reads.total ? Math.round((reads.seen / reads.total) * 100) : 0;
  const pctConfirmed = reads.total ? Math.round((reads.confirmed / reads.total) * 100) : 0;
  const notSeen = Math.max(reads.total - reads.seen, 0);
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between text-[12.5px]">
        <span className="text-dark">
          <span className="font-semibold">{reads.seen}</span> de {reads.total} lo vieron
          {askConfirmation && (
            <>
              {" "}· <span className="font-semibold">{reads.confirmed}</span> confirmaron
            </>
          )}
        </span>
        <span className="text-muted">{pct} %</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/[0.06]">
        <div className="relative h-full rounded-full bg-terra/40" style={{ width: `${pct}%` }}>
          {askConfirmation && (
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-terra"
              style={{ width: pct ? `${(pctConfirmed / pct) * 100}%` : 0 }}
            />
          )}
        </div>
      </div>
      <Link href={href} className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-terra hover:underline">
        {notSeen === 0
          ? "Todos lo vieron"
          : `${notSeen} ${notSeen === 1 ? "persona" : "personas"} todavía no lo ${notSeen === 1 ? "vio" : "vieron"}`}{" "}
        <IconArrowRight size={11} />
      </Link>
    </div>
  );
}

function CreateLink({
  href,
  Icon,
  label,
}: {
  href: string;
  Icon: typeof IconMensajes;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="tap inline-flex items-center gap-2 rounded-xl border border-black/10 bg-card px-3.5 py-2 text-[13px] font-semibold text-dark transition hover:border-terra/40 hover:text-terra"
    >
      <Icon size={16} className="text-muted" />
      {label}
    </Link>
  );
}
