import type { ChatMessage } from "@/lib/types";

/**
 * Los checks de WhatsApp debajo de cada mensaje propio (071):
 *   reloj  → todavía se está guardando (burbuja optimista);
 *   ✓      → enviado: está en la base;
 *   ✓✓     → recibido: llegó al teléfono de quien lo recibe;
 *   ✓✓ verde → leído: abrió la conversación.
 *
 * "Leído" sale de columnas distintas según quién mira: lo que mandó el
 * creyente lo lee quien atiende el canal (`read`); lo que mandó la
 * Asamblea lo lee el creyente (`read_by_member`, 010). Ojo: una respuesta
 * se inserta con `read = true` a propósito (045), así que para las
 * respuestas `read` no dice nada.
 */

export type DeliveryStatus = "pending" | "sent" | "delivered" | "read";

export function deliveryStatus(m: ChatMessage): DeliveryStatus {
  if (m.id.startsWith("local-")) return "pending";
  const read = m.is_admin_reply ? m.read_by_member : m.read;
  if (read) return "read";
  if (m.delivered_at) return "delivered";
  return "sent";
}

const LABELS: Record<DeliveryStatus, string> = {
  pending: "Enviando",
  sent: "Enviado",
  delivered: "Recibido",
  read: "Leído",
};

export function MessageTicks({ message }: { message: ChatMessage }) {
  const status = deliveryStatus(message);
  const color = status === "read" ? "text-green" : "text-muted/80";
  return (
    <span
      role="img"
      aria-label={LABELS[status]}
      title={LABELS[status]}
      className={`ml-1 inline-flex align-[-2px] ${color}`}
    >
      {status === "pending" ? (
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
          <circle cx="8" cy="8" r="6" />
          <path d="M8 4.8V8l2 1.4" />
        </svg>
      ) : status === "sent" ? (
        <svg viewBox="0 0 16 12" className="h-3 w-[14px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 6.5l3 3 7-7" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 12" className="h-3 w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M1.5 6.5l3 3 7-7" />
          <path d="M8.5 9.5l7-7" />
        </svg>
      )}
    </span>
  );
}
