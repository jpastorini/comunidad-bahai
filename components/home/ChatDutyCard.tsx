import Link from "next/link";
import { IconChat, IconChevronRight } from "@/components/Icons";
import type { ChatDuty } from "@/lib/data";
import { CHAT_TOPIC_ADMIN_PATHS, CHAT_TOPIC_LABELS } from "@/lib/types";

/**
 * Atajo del Inicio para quien atiende el chat. Solo lo ve quien tiene el
 * tag del canal: para el resto de la comunidad el Inicio no cambia.
 *
 * Existe porque el lugar para contestar estaba escondido — había que
 * salir de la app, entrar al panel y buscar en el sidebar. Lleva al panel
 * (que es donde vive la bandeja), y lo dice, para que el cambio de shell
 * no tome por sorpresa.
 */
export function ChatDutyCard({ duties }: { duties: ChatDuty[] }) {
  if (duties.length === 0) return null;

  return (
    <div className="mb-4">
      <h2 className="mb-2 px-1 text-[13px] font-semibold text-dark">
        Mensajes para responder
      </h2>
      <div className="overflow-hidden rounded-2xl bg-card shadow-card-soft">
        {duties.map((d, i) => (
          <Link
            key={d.topic}
            href={CHAT_TOPIC_ADMIN_PATHS[d.topic]}
            className={`tap flex items-center gap-3 px-3.5 py-3 ${
              i > 0 ? "border-t border-black/[0.05]" : ""
            }`}
          >
            <div className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[11px] bg-terra/10 text-terra">
              <IconChat size={17} />
              {d.pending > 0 && (
                <span className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-terra px-1 text-[9.5px] font-bold text-white">
                  {d.pending > 9 ? "9+" : d.pending}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold text-dark">
                {CHAT_TOPIC_LABELS[d.topic]}
              </div>
              <div className="mt-0.5 font-body text-[10.5px] text-muted">
                {d.pending === 0
                  ? "Al día — no hay mensajes sin leer"
                  : d.pending === 1
                    ? "1 mensaje sin leer"
                    : `${d.pending} mensajes sin leer`}
              </div>
            </div>
            <IconChevronRight size={14} className="shrink-0 text-muted" />
          </Link>
        ))}
      </div>
      <p className="mt-1.5 px-1 font-body text-[10.5px] text-muted">
        Se abre en el panel de la Asamblea.
      </p>
    </div>
  );
}
