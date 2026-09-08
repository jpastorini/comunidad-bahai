import Link from "next/link";
import { Banner, Button, DataTable, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatMessageDate } from "@/lib/format";
import { getReadCountsForMessages } from "@/lib/message-reads";
import { getPollCountsForMessages, getPollsForMessages } from "@/lib/polls";
import { isPollOpen } from "@/lib/polls-shared";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Message, MessagePoll } from "@/lib/types";
import { deleteEncuestaAction } from "./actions";

type Row = { message: Message; poll: MessagePoll };

/**
 * Las encuestas de la Asamblea (051). Por debajo son los comunicados de
 * la localidad que llevan pregunta; acá se ven como lo que son para
 * quien las arma: una pregunta, su estado y cuántos votaron.
 */
export default async function AdminEncuestasPage() {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("source", "asamblea_local")
    .order("date", { ascending: false });
  const messages = (data ?? []) as Message[];
  const ids = messages.map((m) => m.id);

  const polls = await getPollsForMessages(ids);
  const rows: Row[] = messages
    .filter((m) => polls.has(m.id))
    .map((m) => ({ message: m, poll: polls.get(m.id)! }));
  const pollIds = rows.map((r) => r.message.id);
  const [pollCounts, readCounts] = await Promise.all([
    getPollCountsForMessages(pollIds),
    getReadCountsForMessages(rows.map((r) => r.message), session.locality.id),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Comunicación"
        title="Encuestas"
        description="Una pregunta para que la comunidad vote, como las encuestas de WhatsApp. Cada persona vota una sola vez."
        actions={<Button href="/admin/encuestas/nueva">+ Nueva encuesta</Button>}
      />

      {pollCounts === null && (
        <div className="mb-4">
          <Banner tone="warning">
            No se pudo leer la tabla de encuestas. Si la migración 051 todavía no se
            aplicó en la base, esta pantalla queda vacía hasta entonces.
          </Banner>
        </div>
      )}

      <DataTable
        rows={rows}
        rowKey={(r) => r.message.id}
        empty="Todavía no hay encuestas. Creá la primera con “+ Nueva encuesta”."
        columns={[
          {
            key: "question",
            label: "Pregunta",
            render: ({ message: m, poll }) => (
              <div>
                <Link
                  href={`/admin/encuestas/${m.id}`}
                  className="font-display text-[15px] font-semibold text-dark hover:underline"
                >
                  {poll.question}
                </Link>
                <div className="mt-0.5 text-[11px] text-muted">
                  {formatMessageDate(m.date)}
                  {poll.allow_multiple ? " · varias opciones" : ""}
                  {poll.anonymous ? " · anónima" : ""}
                  {" · "}
                  {poll.options.length} opciones
                </div>
              </div>
            ),
          },
          {
            key: "audience",
            label: "Quién vota",
            width: "120px",
            render: ({ message: m }) =>
              m.audience === "todos" ? (
                <span className="rounded bg-green/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-green">
                  Todos
                </span>
              ) : (
                <span className="text-[11px] text-muted">Creyentes</span>
              ),
          },
          {
            key: "state",
            label: "Estado",
            width: "140px",
            render: ({ poll }) => {
              const open = isPollOpen(poll);
              return open ? (
                <div>
                  <span className="rounded bg-gold/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gold-dark">
                    Abierta
                  </span>
                  {poll.closes_at && (
                    <div className="mt-0.5 text-[10px] text-muted">
                      Cierra el {formatDate(poll.closes_at)}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-[11px] font-semibold text-muted">Cerrada</span>
              );
            },
          },
          {
            key: "votes",
            label: "Votaron",
            width: "150px",
            render: ({ message: m }) => {
              const p = pollCounts?.get(m.id);
              const total = readCounts?.get(m.id)?.total ?? 0;
              if (!p) return <span className="text-[11px] text-muted">Sin datos</span>;
              const pct = total === 0 ? 0 : Math.round((p.participants / total) * 100);
              return (
                <Link href={`/admin/encuestas/${m.id}`} className="block hover:underline">
                  <div className="text-[13px] font-semibold text-dark">
                    {p.participants} de {total}
                    <span className="ml-1 text-[11px] font-normal text-muted">({pct} %)</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
                  </div>
                </Link>
              );
            },
          },
          {
            key: "actions",
            label: "",
            width: "190px",
            render: ({ message: m }) => (
              <div className="flex items-center justify-end gap-3">
                <Link
                  href={`/admin/encuestas/${m.id}`}
                  className="text-[12px] font-semibold text-terra hover:underline"
                >
                  Resultados
                </Link>
                <Link
                  href={`/admin/encuestas/${m.id}/editar`}
                  className="text-[12px] font-semibold text-terra hover:underline"
                >
                  Editar
                </Link>
                <form action={deleteEncuestaAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <button
                    type="submit"
                    className="text-[12px] font-semibold text-rose-600 hover:underline"
                  >
                    Borrar
                  </button>
                </form>
              </div>
            ),
          },
        ]}
      />

      <p className="mt-4 text-[11px] text-muted">
        Cada encuesta es también un comunicado y aparece en{" "}
        <Link href="/admin/comunicados" className="text-terra hover:underline">
          Comunicados
        </Link>
        , con su informe de lectura.
      </p>
    </>
  );
}
