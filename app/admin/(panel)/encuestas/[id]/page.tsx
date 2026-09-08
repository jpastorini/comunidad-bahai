import { notFound } from "next/navigation";
import { PollReportSection } from "@/components/admin/comunicados/PollReportSection";
import { ReadReportRefresher } from "@/components/admin/comunicados/ReadReportRefresher";
import { Banner, Button, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { formatMessageDate } from "@/lib/format";
import { getPollForMessage, getPollReport } from "@/lib/polls";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Message } from "@/lib/types";

/**
 * Resultados de una encuesta (051): barras, participación, quién votó
 * qué si no es anónima, y el botón para cerrar. Es el mismo bloque que
 * aparece dentro del informe de lectura del comunicado; acá tiene su
 * propia página para quien piensa en "la encuesta" y no en "el
 * comunicado". Se refresca solo con cada voto.
 */
export default async function EncuestaResultadosPage({
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
  const poll = await getPollForMessage(m.id);
  if (!poll) notFound();

  const report = await getPollReport(m, poll, session.locality.id);

  return (
    <>
      <ReadReportRefresher messageId={m.id} pollId={poll.id} />
      <PageHeader
        back={{ href: "/admin/encuestas", label: "Encuestas" }}
        eyebrow="Comunicación"
        title="Resultados"
        description={`Encuesta del ${formatMessageDate(m.date)}, ${
          m.audience === "todos" ? "para toda la comunidad" : "solo para creyentes"
        }.`}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" href={`/admin/comunicados/${m.id}/lectura`}>
              Informe de lectura
            </Button>
            <Button variant="secondary" href={`/admin/encuestas/${m.id}/editar`}>
              Editar
            </Button>
          </div>
        }
      />

      {!report ? (
        <Banner tone="warning">
          No se pudieron leer los votos. Si la migración 051 todavía no se aplicó en
          la base, esta pantalla queda vacía hasta entonces.
        </Banner>
      ) : (
        <PollReportSection report={report} messageId={m.id} />
      )}
    </>
  );
}
