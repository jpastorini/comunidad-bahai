import Link from "next/link";
import { CHAT_TOPIC_ADMIN_PATHS, type ChatTopic } from "@/lib/types";

/**
 * "Escribirle" desde el panel: abre la conversación de ese canal con la
 * persona aunque todavía no haya mensajes, así la Asamblea no tiene que
 * esperar a que la persona escriba primero.
 *
 * Aparece en Creyentes, en el informe de lectura de un comunicado y en
 * Compromisos. Qué canales ofrece lo decide `contactTopics()`: cada uno
 * exige SU tag, igual que la bandeja y la RLS de `chat_messages`.
 */

type Viewer = { can_respond_chat: boolean; can_manage_treasury: boolean };

export function contactTopics(
  viewer: Viewer,
  target: { id: string; is_bahai: boolean },
  viewerId: string
): ChatTopic[] {
  if (target.id === viewerId) return [];
  const topics: ChatTopic[] = [];
  if (viewer.can_respond_chat) topics.push("secretaria");
  // La Tesorería no existe para un Amigo/a de la Fe (047).
  if (viewer.can_manage_treasury && target.is_bahai) topics.push("tesoreria");
  return topics;
}

const LABELS: Record<ChatTopic, string> = {
  secretaria: "Escribir desde Secretaría",
  tesoreria: "Escribir desde Tesorería",
};

export function ContactButtons({
  memberId,
  topics,
  labels,
  size = "md",
}: {
  memberId: string;
  topics: ChatTopic[];
  /** Para cambiar el texto de un canal (p. ej. "Darle la bienvenida"). */
  labels?: Partial<Record<ChatTopic, string>>;
  size?: "sm" | "md";
}) {
  if (topics.length === 0) return null;
  const cls =
    size === "sm"
      ? "px-2.5 py-1 text-[11.5px]"
      : "px-3 py-1.5 text-[12px]";
  return (
    <div className="flex flex-wrap gap-1.5">
      {topics.map((t) => (
        <Link
          key={t}
          href={`${CHAT_TOPIC_ADMIN_PATHS[t]}/${memberId}`}
          title={LABELS[t]}
          className={`tap inline-flex items-center gap-1.5 rounded-lg border border-terra/25 bg-terra/[0.06] font-semibold text-terra hover:bg-terra/10 ${cls}`}
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {labels?.[t] ?? LABELS[t]}
        </Link>
      ))}
    </div>
  );
}
