"use server";

import { submitContactRequest, type ContactResult } from "@/lib/contact-requests";

/**
 * El formulario del folleto público: sin sesión. Valida y guarda el
 * servidor con service-role (ver lib/contact-requests.ts); el campo
 * `website` es la trampa para bots y, si viene lleno, se finge éxito.
 */
export async function submitPublicContactAction(formData: FormData): Promise<ContactResult> {
  if (String(formData.get("website") ?? "")) return { ok: true };
  return submitContactRequest({
    localityId: String(formData.get("locality_id") ?? ""),
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    message: String(formData.get("message") ?? ""),
    source: "folleto",
  });
}
