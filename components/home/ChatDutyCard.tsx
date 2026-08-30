import Link from "next/link";
import { IconChat, IconTesoreria } from "@/components/Icons";
import type { ChatDuty } from "@/lib/data";
import {
  CHAT_TOPIC_ADMIN_PATHS,
  CHAT_TOPIC_LABELS,
  type ChatTopic,
} from "@/lib/types";

/**
 * Identidad visual de cada canal. Son dos bandejas distintas, con dos
 * permisos distintos, así que se ven distintas: el color repite el que ya
 * usa cada sección (el morado del acceso "Chat", el dorado de Tesorería).
 */
const TOPIC_STYLE: Record<
  ChatTopic,
  { color: string; Icon: typeof IconChat }
> = {
  secretaria: { color: "#7E44B8", Icon: IconChat },
  tesoreria: { color: "#96790E", Icon: IconTesoreria },
};

/**
 * Atajo del Inicio para quien atiende el chat. Una tarjeta por canal.
 * Solo la ve quien tiene el tag: para el resto de la comunidad el Inicio
 * no cambia.
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
      <div
        className={`grid gap-2 ${
          duties.length > 1 ? "grid-cols-2" : "grid-cols-1"
        }`}
      >
        {duties.map((d) => {
          const { color, Icon } = TOPIC_STYLE[d.topic];
          return (
            <Link
              key={d.topic}
              href={CHAT_TOPIC_ADMIN_PATHS[d.topic]}
              className="tap flex items-center gap-2.5 rounded-2xl bg-card p-3.5 shadow-card-soft"
            >
              <div
                className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[11px]"
                style={{ background: `${color}14`, color }}
              >
                <Icon size={17} />
                {d.pending !== null && d.pending > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-terra px-1 text-[9.5px] font-bold text-white">
                    {d.pending > 9 ? "9+" : d.pending}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-semibold text-dark">
                  {CHAT_TOPIC_LABELS[d.topic]}
                </div>
                <div
                  className={`mt-0.5 font-body text-[10.5px] ${
                    d.pending === null ? "text-rose-600" : "text-muted"
                  }`}
                >
                  {d.pending === null
                    ? "No se pudo consultar"
                    : d.pending === 0
                      ? "Al día"
                      : d.pending === 1
                        ? "1 sin leer"
                        : `${d.pending} sin leer`}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <p className="mt-1.5 px-1 font-body text-[10.5px] text-muted">
        Se abre en el panel de la Asamblea.
      </p>
    </div>
  );
}
