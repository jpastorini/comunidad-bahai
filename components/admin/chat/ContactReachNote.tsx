import { Banner } from "@/components/admin/ui";
import type { ContactReach } from "@/lib/chat-contact";
import { formatSinceDays } from "@/lib/message-reads";

/**
 * ¿Le va a llegar lo que escribas? Arriba de la conversación, cuando la
 * inicia la Asamblea o cuando la persona no tiene avisos. Sin push, el
 * mensaje queda esperando a que abra la app: mejor saberlo antes de
 * contar con que lo leyó.
 */
export function ContactReachNote({
  reach,
  name,
  isEmpty,
}: {
  reach: ContactReach | null;
  name: string;
  isEmpty: boolean;
}) {
  if (!reach) return null;
  const first = name.split(" ")[0] || "Esta persona";
  const since = formatSinceDays(reach.lastSeenAt).toLowerCase();

  if (reach.hasPush) {
    if (!isEmpty) return null;
    return (
      <div className="mb-4">
        <Banner tone="info">
          Todavía no hay mensajes. {first} tiene los avisos activados: lo que
          escribas le llega al teléfono.
        </Banner>
      </div>
    );
  }
  return (
    <div className="mb-4">
      <Banner tone="warning">
        {first} no tiene los avisos activados
        {reach.lastSeenAt
          ? ` y entró a la app por última vez ${since}`
          : " y nunca entró a la app"}
        . El mensaje le queda esperando hasta que la abra: si es importante,
        buscá también otro medio para llegarle.
      </Banner>
    </div>
  );
}
