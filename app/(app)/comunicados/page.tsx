import Link from "next/link";
import { ComunicadoListItem } from "@/components/comunicados/ComunicadoListItem";
import { ComunicadosSearch } from "@/components/comunicados/ComunicadosSearch";
import { HashRedirect } from "@/components/comunicados/HashRedirect";
import { GoldHeader } from "@/components/GoldHeader";
import { AEL_SEGMENTS, SegmentedNav } from "@/components/SegmentedNav";
import { requireMember } from "@/lib/auth";
import { getLocalAnnouncements } from "@/lib/data";
import { getMyMessageReads, isNewForReader } from "@/lib/message-reads";
import { getMyPollVotes, getPollsForMessages } from "@/lib/polls";
import { markComunicadosSeenAction } from "./actions";

export const revalidate = 60;

/**
 * La lista de Comunicados: tarjetas compactas (imagen, título, asunto)
 * que abren el comunicado en su pantalla propia, `/comunicados/[id]`.
 * El texto completo no se muestra acá, pero el buscador sigue
 * buscando en él.
 */
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
  // "Nuevo" y la línea "pide confirmar lectura" salen de ahí. De las
  // encuestas (051) la lista solo necesita si están abiertas y si esta
  // persona ya votó; los totales se ven al abrir.
  const [, reads, polls] = await Promise.all([
    markComunicadosSeenAction(session.user.id),
    getMyMessageReads(session.user.id, ids),
    getPollsForMessages(ids),
  ]);
  const pollIds = [...polls.values()].map((p) => p.id);
  const myVotes = await getMyPollVotes(session.user.id, pollIds);

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
      <HashRedirect />
      <GoldHeader
        title="Institucional"
        subtitle={session.locality.name}
        backHref="/"
      />
      <SegmentedNav items={AEL_SEGMENTS} />
      {/* Buscador y lista van juntos: el filtrado es del navegador. */}
      <ComunicadosSearch
        emptyText={
          showHidden
            ? "No ocultaste ningún comunicado."
            : "Aún no hay comunicados publicados."
        }
        items={visible.map((m, i) => {
          const read = reads.get(m.id) ?? null;
          const poll = polls.get(m.id) ?? null;
          return {
            id: m.id,
            haystack: [m.title, m.subject, m.excerpt, m.full_text, poll?.question]
              .filter(Boolean)
              .join(" "),
            card: (
              <ComunicadoListItem
                message={m}
                read={read}
                isNew={isNewForReader(m, read ?? undefined)}
                featured={i === 0}
                poll={poll}
                myVote={poll ? myVotes.get(poll.id) ?? null : null}
              />
            ),
          };
        })}
        footer={
          // La salida y la vuelta de los ocultos. Aparece solo si hay
          // alguno: si nadie ocultó nada, el link no dice nada.
          (hiddenIds.size > 0 || showHidden) && (
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
          )
        }
      />
    </>
  );
}
