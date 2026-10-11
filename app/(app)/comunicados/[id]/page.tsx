import { notFound } from "next/navigation";
import { ComunicadoCard } from "@/components/comunicados/ComunicadoCard";
import { GoldHeader } from "@/components/GoldHeader";
import { requireMember } from "@/lib/auth";
import { getLocalAnnouncement } from "@/lib/data";
import { getMyMessageReads } from "@/lib/message-reads";
import { getMyPollVotes, getPollForMessage, getPollResults } from "@/lib/polls";

export const revalidate = 60;

/**
 * Un comunicado en su pantalla propia. Es adonde llevan la lista, la
 * tarjeta destacada del Inicio y el push de un comunicado nuevo. Acá
 * viven el texto completo, el PDF, la encuesta y "Enterado/a"; abrirlo
 * es lo que cuenta como "visto" (048).
 *
 * Si la RLS no devuelve el comunicado (otra localidad, "solo creyentes"
 * para un Amigo de la Fe, id inventado), 404.
 */
export default async function ComunicadoPage({
  params,
}: {
  params: { id: string };
}) {
  const [session, message] = await Promise.all([
    requireMember(`/comunicados/${params.id}`),
    getLocalAnnouncement(params.id),
  ]);
  if (!message) notFound();

  const [reads, poll] = await Promise.all([
    getMyMessageReads(session.user.id, [message.id]),
    getPollForMessage(message.id),
  ]);
  const [myVotes, results] = poll
    ? await Promise.all([
        getMyPollVotes(session.user.id, [poll.id]),
        getPollResults([poll.id]),
      ])
    : [null, null];

  const national = message.source === "asamblea_nacional";

  return (
    <>
      <GoldHeader
        title="Comunicado"
        subtitle={national ? "Asamblea Nacional" : session.locality.name}
        backHref="/comunicados"
        backLabel="Comunicados"
      />
      <main className="scroll-area flex-1 px-4 pb-8 pt-4">
        <ComunicadoCard
          message={message}
          read={reads.get(message.id) ?? null}
          poll={poll}
          myVote={poll ? myVotes?.get(poll.id) ?? null : null}
          pollResults={poll ? results?.get(poll.id) ?? null : null}
        />
      </main>
    </>
  );
}
