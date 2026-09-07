import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { PollReportSection } from "@/components/admin/comunicados/PollReportSection";
import { ReadReportRefresher } from "@/components/admin/comunicados/ReadReportRefresher";
import { Banner, Button, Card, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatMessageDate } from "@/lib/format";
import {
  formatSinceDays,
  getReadReport,
  type ReadReportPerson,
} from "@/lib/message-reads";
import { getPollForMessage, getPollReport } from "@/lib/polls";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Message } from "@/lib/types";

/**
 * Informe de lectura de un comunicado (048): quién confirmó, quién solo
 * lo vio y quién no lo vio todavía. La tercera lista es la que se usa:
 * a esas personas hay que hacerles llegar la información por otro medio,
 * y su "última vez en la app" dice si alcanza con un recordatorio o hace
 * falta un llamado.
 */
export default async function ComunicadoLecturaPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("id", params.id)
    .eq("source", "asamblea_local")
    .maybeSingle();
  if (!data) notFound();
  const m = data as Message;

  const [report, poll] = await Promise.all([
    getReadReport(m, session.locality.id),
    getPollForMessage(m.id),
  ]);
  // La encuesta (051), si el comunicado tiene una: totales, participación
  // y, si no es anónima, quién votó qué.
  const pollReport = poll ? await getPollReport(m, poll, session.locality.id) : null;

  return (
    <>
      <ReadReportRefresher messageId={m.id} pollId={poll?.id ?? null} />
      <PageHeader back={{ href: "/admin/comunicados", label: "Comunicados" }}
        eyebrow={`Comunicado del ${formatMessageDate(m.date)}`}
        title={m.title}
        description={
          m.audience === "todos"
            ? "Dirigido a toda la comunidad, incluidos Amigos de la Fe."
            : "Dirigido solo a creyentes."
        }
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" href={`/admin/comunicados/${m.id}`}>
              Editar comunicado
            </Button>
          </div>
        }
      />

      {!report ? (
        <Banner tone="warning">
          No se pudo leer el registro de lecturas. Si la migración 048 todavía
          no se aplicó en la base, este informe queda vacío hasta entonces.
        </Banner>
      ) : (
        <>
          {pollReport && <PollReportSection report={pollReport} messageId={m.id} />}

          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <Stat
              label="Lo vieron"
              value={`${report.counts.seen} de ${report.counts.total}`}
              tone="green"
            />
            {m.ask_confirmation ? (
              <Stat
                label="Confirmaron"
                value={`${report.counts.confirmed} de ${report.counts.total}`}
                tone="gold"
              />
            ) : (
              <Stat label="Confirmación" value="No pedida" tone="muted" />
            )}
            <Stat
              label="Falta contactar"
              value={String(report.pending.length)}
              tone={report.pending.length > 0 ? "terra" : "muted"}
            />
          </div>

          <p className="mb-6 text-[12px] text-muted">
            Se actualiza solo a medida que la gente abre la app. “Visto”
            significa que la tarjeta estuvo en pantalla; “Confirmó” que tocó
            “Enterado/a”.
          </p>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="lg:order-2">
              <PeopleList
                title="No lo vieron todavía"
                hint="A quién hacerle llegar la información por otro medio. Primero quien hace más tiempo no entra a la app."
                people={report.pending}
                empty="Todas las personas de la audiencia ya lo vieron."
                render={(p) => (
                  <span
                    className={
                      p.last_seen_at
                        ? "text-[11px] text-muted"
                        : "text-[11px] font-semibold text-terra"
                    }
                  >
                    Última vez en la app: {formatSinceDays(p.last_seen_at).toLowerCase()}
                  </span>
                )}
                highlight
              />
            </div>
            <div className="flex flex-col gap-5 lg:order-1">
              {m.ask_confirmation && (
                <PeopleList
                  title="Confirmaron"
                  people={report.confirmed}
                  empty="Nadie confirmó todavía."
                  render={(p) => (
                    <span className="text-[11px] text-muted">
                      Confirmó el {formatDateTime(p.confirmed_at!)}
                    </span>
                  )}
                />
              )}
              <PeopleList
                title={m.ask_confirmation ? "Lo vieron sin confirmar" : "Lo vieron"}
                people={report.seen}
                empty={
                  m.ask_confirmation
                    ? "Nadie lo vio sin confirmar."
                    : "Nadie lo vio todavía."
                }
                render={(p) => (
                  <span className="text-[11px] text-muted">
                    Visto el {formatDateTime(p.seen_at!)}
                  </span>
                )}
              />
            </div>
          </div>

          <p className="mt-6 text-[11px] text-muted">
            La audiencia son las personas activas de {session.locality.name}
            {m.audience === "todos" ? "" : " que son creyentes"}. Los datos de
            contacto están en{" "}
            <Link href="/admin/miembros" className="text-terra hover:underline">
              Creyentes
            </Link>
            .
          </p>
        </>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "gold" | "terra" | "muted";
}) {
  const color = {
    green: "text-green",
    gold: "text-gold-dark",
    terra: "text-terra",
    muted: "text-muted",
  }[tone];
  return (
    <Card className="!p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[1.5px] text-muted">
        {label}
      </div>
      <div className={`mt-1 font-display text-[26px] font-bold leading-none ${color}`}>
        {value}
      </div>
    </Card>
  );
}

function PeopleList({
  title,
  hint,
  people,
  empty,
  render,
  highlight = false,
}: {
  title: string;
  hint?: string;
  people: ReadReportPerson[];
  empty: string;
  render: (p: ReadReportPerson) => React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "ring-1 ring-terra/25" : ""}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[18px] font-semibold text-dark">{title}</h2>
        <span className="text-[12px] font-semibold text-muted">{people.length}</span>
      </div>
      {hint && <p className="mb-3 text-[11.5px] text-muted">{hint}</p>}
      {people.length === 0 ? (
        <p className="py-4 text-center text-[12px] text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-black/[0.05]">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2.5">
              <Avatar url={p.avatar_url} name={p.full_name} size={32} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-dark">
                  {p.full_name}
                </div>
                {render(p)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
