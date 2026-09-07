import { ComunicadoCard } from "@/components/comunicados/ComunicadoCard";
import { GoldHeader } from "@/components/GoldHeader";
import { IconSearch } from "@/components/Icons";
import { AEL_SEGMENTS, SegmentedNav } from "@/components/SegmentedNav";
import { requireMember } from "@/lib/auth";
import { getLocalAnnouncements } from "@/lib/data";
import { getMyMessageReads, isNewForReader } from "@/lib/message-reads";
import { markComunicadosSeenAction } from "./actions";

export const revalidate = 60;

export default async function ComunicadosPage() {
  const [session, announcements] = await Promise.all([
    requireMember("/comunicados"),
    getLocalAnnouncements(),
  ]);

  // Apaga el punto de aviso de AEL — el miembro acaba de abrir Comunicados.
  // Y trae qué comunicados ya vio/confirmó esta persona (048): el badge
  // "Nuevo" y el botón "Enterado/a" salen de ahí.
  const [, reads] = await Promise.all([
    markComunicadosSeenAction(session.user.id),
    getMyMessageReads(
      session.user.id,
      announcements.map((m) => m.id)
    ),
  ]);

  return (
    <>
      <GoldHeader title="Asamblea Local" subtitle={session.locality.name} backHref="/" />
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
        {announcements.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-muted">
            Aún no hay comunicados publicados.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {announcements.map((m, i) => {
              const read = reads.get(m.id) ?? null;
              return (
                <ComunicadoCard
                  key={m.id}
                  message={m}
                  read={read}
                  isNew={isNewForReader(m, read ?? undefined)}
                  featured={i === 0}
                />
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
