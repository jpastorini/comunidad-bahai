import Link from "next/link";
import { ComunicadoCard } from "@/components/comunicados/ComunicadoCard";
import { ScrollToHash } from "@/components/comunicados/ScrollToHash";
import { GoldHeader } from "@/components/GoldHeader";
import { IconSearch } from "@/components/Icons";
import { AEL_SEGMENTS, SegmentedNav } from "@/components/SegmentedNav";
import { requireMember } from "@/lib/auth";
import { getLocalAnnouncements } from "@/lib/data";
import { getMyMessageReads, isNewForReader } from "@/lib/message-reads";
import { isNationalLocality } from "@/lib/types";
import { getMyPollVotes, getPollResults, getPollsForMessages } from "@/lib/polls";
import { markComunicadosSeenAction } from "./actions";

export const revalidate = 60;

export default async function ComunicadosPage({
  searchParams,
}: {
  searchParams: { ocultos?: string };
}) {
  const showHidden = searchParams.ocultos === "1";
  const [session, announcements] = await Promise.all([
    requireMember("/comunicados"),
    getLocalAnnouncements(),
  ]);
  const ids = announcements.map((m) => m.id);

  // Apaga el punto de aviso de AEL — el miembro acaba de abrir Comunicados.
  // Y trae qué comunicados ya vio/confirmó esta persona (048): el badge
  // "Nuevo" y el botón "Enterado/a" salen de ahí. Las encuestas (051)
  // vienen con la pregunta, lo que esta persona votó y los totales.
  const [, reads, polls] = await Promise.all([
    markComunicadosSeenAction(session.user.id),
    getMyMessageReads(session.user.id, ids),
    getPollsForMessages(ids),
  ]);
  const pollIds = [...polls.values()].map((p) => p.id);
  const [myVotes, results] = await Promise.all([
    getMyPollVotes(session.user.id, pollIds),
    getPollResults(pollIds),
  ]);

  // 057: los nacionales que la persona ocultó salen de la lista, salvo
  // que esté mirando justamente los ocultos. Se filtra acá y no en la
  // consulta porque la marca vive en `message_reads`, que ya se trajo.
  const hiddenIds = new Set(
    [...reads.values()].filter((r) => r.hidden_at).map((r) => r.message_id)
  );
  const visible = announcements.filter((m) =>
    showHidden ? hiddenIds.has(m.id) : !hiddenIds.has(m.id)
  );

  return (
    <>
      <ScrollToHash />
      <GoldHeader
        title={
          isNationalLocality(session.locality)
            ? "Asamblea Nacional"
            : "Asamblea Local"
        }
        subtitle={session.locality.name}
        backHref="/"
      />
      <SegmentedNav items={AEL_SEGMENTS} />
      <div className="shrink-0 px-4 pb-1.5 pt-0.5">
        <div
          className="flex items-center gap-2 rounded-xl px-3.5 py-2.5"
          style={{ background: "#C4A23508" }}
        >
          <IconSearch size={15} className="text-muted" />
          <span className="font-body text-[13px] text-muted">
            Buscar comunicado...
          </span>
        </div>
      </div>
      <main className="scroll-area flex-1 px-4 pb-4 pt-1">
        {visible.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-muted">
            {showHidden
              ? "No ocultaste ningún comunicado."
              : "Aún no hay comunicados publicados."}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {visible.map((m, i) => {
              const read = reads.get(m.id) ?? null;
              const poll = polls.get(m.id) ?? null;
              return (
                <ComunicadoCard
                  key={m.id}
                  message={m}
                  read={read}
                  isNew={isNewForReader(m, read ?? undefined)}
                  featured={i === 0}
                  poll={poll}
                  myVote={poll ? myVotes.get(poll.id) ?? null : null}
                  pollResults={poll ? results.get(poll.id) ?? null : null}
                />
              );
            })}
          </div>
        )}

        {/* La salida y la vuelta de los ocultos. Aparece solo si hay
            alguno: si nadie ocultó nada, el link no dice nada. */}
        {(hiddenIds.size > 0 || showHidden) && (
          <div className="mt-6 text-center">
            <Link
              href={showHidden ? "/comunicados" : "/comunicados?ocultos=1"}
              className="text-[12px] font-semibold text-muted hover:text-dark"
            >
              {showHidden
                ? "← Volver a mis comunicados"
                : `Ver ocultos (${hiddenIds.size})`}
            </Link>
          </div>
        )}
      </main>
    </>
  );
}
