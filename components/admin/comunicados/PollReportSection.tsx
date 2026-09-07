import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/format";
import { formatSinceDays } from "@/lib/message-reads";
import { isPollOpen, pollPercent, type PollReport } from "@/lib/polls";
import { setPollClosedAction } from "@/app/admin/(panel)/comunicados/actions";

/**
 * El resultado de la encuesta para la Asamblea (051), dentro del informe
 * de lectura del comunicado. Tres bloques:
 *   · las barras por opción con conteo y porcentaje sobre quienes
 *     votaron (en múltiple no suman 100);
 *   · la participación: votaron X de Y (Y = la audiencia del comunicado);
 *   · quién votó qué y quién falta, SOLO si la encuesta no es anónima.
 *     En una anónima no hay fila que lo diga, y tampoco se lista quién
 *     falta: con pocas personas, saber quién votó ya dice mucho.
 * Más el botón para cerrar (o reabrir) la votación.
 */
export function PollReportSection({
  report,
  messageId,
}: {
  report: PollReport;
  messageId: string;
}) {
  const { poll, results, total, voted, pending } = report;
  const open = isPollOpen(poll);
  const optionLabel = new Map(poll.options.map((o) => [o.id, o.label]));
  const pct = total === 0 ? 0 : Math.round((results.participants / total) * 100);

  return (
    <section className="mb-6">
      <Card className="ring-1 ring-gold/40">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[1.5px] text-gold-dark">
              {poll.anonymous ? "Encuesta anónima" : "Encuesta"} ·{" "}
              {open ? "Abierta" : "Cerrada"}
              {poll.allow_multiple ? " · Varias opciones" : ""}
            </div>
            <h2 className="mt-1 font-display text-[20px] font-semibold leading-[1.25] text-dark">
              {poll.question}
            </h2>
            <p className="mt-1 text-[12px] text-muted">
              {open
                ? poll.closes_at
                  ? `Cierra sola el ${formatDateTime(poll.closes_at)}.`
                  : "Sin fecha de cierre: se cierra a mano."
                : poll.closed_at
                  ? `Cerrada el ${formatDateTime(poll.closed_at)}.`
                  : `Cerró el ${formatDateTime(poll.closes_at!)}.`}
            </p>
          </div>
          <form action={setPollClosedAction}>
            <input type="hidden" name="poll_id" value={poll.id} />
            <input type="hidden" name="message_id" value={messageId} />
            <input type="hidden" name="close" value={open ? "1" : "0"} />
            <button
              type="submit"
              className={
                open
                  ? "rounded-xl bg-terra px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-terra/90"
                  : "rounded-xl border border-black/10 bg-white px-3.5 py-2 text-[12px] font-semibold text-dark hover:bg-bg"
              }
            >
              {open ? "Cerrar votación" : "Reabrir votación"}
            </button>
          </form>
        </div>

        <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
          <ul className="flex flex-col gap-2">
            {poll.options.map((o) => {
              const n = results.votes[o.id] ?? 0;
              const p = pollPercent(n, results.participants);
              return (
                <li key={o.id} className="relative overflow-hidden rounded-lg bg-bg ring-1 ring-black/[0.05]">
                  <div className="absolute inset-y-0 left-0 bg-gold/30" style={{ width: `${p}%` }} />
                  <div className="relative flex items-center gap-3 px-3 py-2.5">
                    <span className="min-w-0 flex-1 text-[13.5px] font-medium text-dark">{o.label}</span>
                    <span className="shrink-0 font-display text-[16px] font-bold tabular-nums text-dark">
                      {p} %
                    </span>
                    <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-muted">
                      {n === 1 ? "1 voto" : `${n} votos`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="rounded-xl bg-bg p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[1.5px] text-muted">
              Participación
            </div>
            <div className="mt-1 font-display text-[26px] font-bold leading-none text-dark">
              {results.participants} de {total}
              <span className="ml-1.5 text-[13px] font-normal text-muted">({pct} %)</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
              <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-muted">
              {poll.anonymous
                ? "Encuesta anónima: el voto se guardó sin nombre. Ni la Asamblea ni la base pueden saber quién eligió qué, ni quién votó."
                : "Los porcentajes de las barras son sobre las personas que votaron."}
            </p>
          </div>
        </div>
      </Card>

      {!poll.anonymous && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <PeopleCard
            title="No votaron todavía"
            count={pending.length}
            empty="Todas las personas de la audiencia ya votaron."
            highlight
          >
            {pending.map((p) => (
              <Row key={p.id} avatar={p.avatar_url} name={p.full_name}>
                <span
                  className={
                    p.last_seen_at ? "text-[11px] text-muted" : "text-[11px] font-semibold text-terra"
                  }
                >
                  Última vez en la app: {formatSinceDays(p.last_seen_at).toLowerCase()}
                </span>
              </Row>
            ))}
          </PeopleCard>
          <PeopleCard title="Votaron" count={voted.length} empty="Nadie votó todavía.">
            {voted.map((p) => (
              <Row key={p.id} avatar={p.avatar_url} name={p.full_name}>
                <span className="text-[11px] text-dark">
                  {p.option_ids.map((id) => optionLabel.get(id) ?? "—").join(" · ")}
                </span>
                <span className="ml-2 text-[10.5px] text-muted">
                  {p.voted_at ? formatDateTime(p.voted_at) : ""}
                </span>
              </Row>
            ))}
          </PeopleCard>
        </div>
      )}
    </section>
  );
}

function PeopleCard({
  title,
  count,
  empty,
  highlight = false,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className={highlight ? "ring-1 ring-terra/25" : ""}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-[18px] font-semibold text-dark">{title}</h3>
        <span className="text-[12px] font-semibold text-muted">{count}</span>
      </div>
      {count === 0 ? (
        <p className="py-4 text-center text-[12px] text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-black/[0.05]">{children}</ul>
      )}
    </Card>
  );
}

function Row({
  avatar,
  name,
  children,
}: {
  avatar: string | null;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Avatar url={avatar} name={name} size={32} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-dark">{name}</div>
        <div className="truncate">{children}</div>
      </div>
    </li>
  );
}
