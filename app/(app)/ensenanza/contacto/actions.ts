"use server";

import { requireMember } from "@/lib/auth";
import { submitContactRequest, type ContactResult } from "@/lib/contact-requests";

/**
 * Contacto desde el hub: un creyente le presta el teléfono a la persona
 * con la que está hablando. La comunidad es la de la sesión; quien lo
 * cargó queda en `created_by` para que la Asamblea sepa a quién preguntar.
 */
export async function submitContactFromAppAction(formData: FormData): Promise<ContactResult> {
  const session = await requireMember("/ensenanza/contacto");
  if (String(formData.get("website") ?? "")) return { ok: true }; // bot
  return submitContactRequest({
    localityId: session.locality.id,
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    message: String(formData.get("message") ?? ""),
    source: "app",
    createdBy: session.user.id,
  });
}
