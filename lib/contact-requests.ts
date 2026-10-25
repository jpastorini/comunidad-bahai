import "server-only";
import { createSupabaseAdmin } from "./supabase/admin";
import { createSupabaseServer, isSupabaseConfigured } from "./supabase/server";
import { getDelegateIds } from "./delegations-server";
import { getChatAdminIds, sendPushToUsers } from "./push";

/**
 * Pedidos de contacto desde el folleto "Qué es la Fe Bahá'í" (080).
 *
 * El formulario es PÚBLICO (la persona que lee /la-fe no tiene sesión), así
 * que el alta la hace el servidor con service-role después de validar; la
 * tabla no tiene policy de insert. Quien lo recibe es quien atiende el chat
 * de Secretaría en la comunidad elegida: le llega un push y lo ve en
 * Comunicación → Contactos.
 */

export type ContactRequest = {
  id: string;
  locality_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  message: string | null;
  source: "folleto" | "app";
  created_by: string | null;
  status: "nuevo" | "atendido";
  handled_at: string | null;
  handled_by: string | null;
  notes: string | null;
  created_at: string;
};

export type ContactInput = {
  localityId: string;
  name: string;
  phone: string;
  email: string;
  message: string;
  source: "folleto" | "app";
  createdBy?: string | null;
};

export type ContactResult =
  | { ok: true }
  | { ok: false; error: string; field?: "name" | "phone" | "email" | "locality" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valida y guarda el pedido; avisa por push a quienes atienden el chat. */
export async function submitContactRequest(input: ContactInput): Promise<ContactResult> {
  const name = input.name.trim().slice(0, 120);
  const phone = input.phone.trim().slice(0, 40);
  const email = input.email.trim().toLowerCase().slice(0, 160);
  const message = input.message.trim().slice(0, 2000);

  if (!input.localityId) {
    return { ok: false, error: "Elegí la comunidad más cercana.", field: "locality" };
  }
  if (!name) return { ok: false, error: "Decinos tu nombre.", field: "name" };
  if (!phone && !email) {
    return {
      ok: false,
      error: "Dejanos un teléfono o un correo para poder contactarte.",
      field: "phone",
    };
  }
  if (email && !EMAIL_RE.test(email)) {
    return { ok: false, error: "Ese correo no parece válido.", field: "email" };
  }

  const admin = createSupabaseAdmin();
  if (!admin) return { ok: false, error: "El servidor no está configurado para recibir contactos." };

  const { data: locality } = await admin
    .from("localities")
    .select("id, name, is_active, kind")
    .eq("id", input.localityId)
    .maybeSingle();
  // Una estructura (082) no recibe contactos: no tiene comunidad.
  const loc = locality as { is_active: boolean; kind?: string } | null;
  if (!loc || !loc.is_active || loc.kind === "estructura") {
    return { ok: false, error: "Esa comunidad no existe.", field: "locality" };
  }

  const { error } = await admin.from("contact_requests").insert({
    locality_id: input.localityId,
    name,
    phone: phone || null,
    email: email || null,
    message: message || null,
    source: input.source,
    created_by: input.createdBy ?? null,
  });
  if (error) {
    console.error(`[contact] insert: ${error.code} ${error.message}`);
    if (isContactSchemaMissing(error.code)) {
      return { ok: false, error: "Falta aplicar la migración 080 en la base." };
    }
    return { ok: false, error: "No se pudo enviar. Probá de nuevo en un rato." };
  }

  // Los contactos los atiende quien atiende la Secretaría (sin contar a
  // sus ayudantes, que tienen el chat y no esto) más los ayudantes de
  // Contactos (088).
  const [chat, chatHelpers, contactHelpers] = await Promise.all([
    getChatAdminIds(input.localityId),
    getDelegateIds(input.localityId, "secretaria"),
    getDelegateIds(input.localityId, "contactos"),
  ]);
  const tagHolders = chat.filter((id) => !chatHelpers.includes(id));
  const ids = Array.from(new Set([...tagHolders, ...contactHelpers]));
  await sendPushToUsers(ids, {
    title: "Alguien quiere contactarse",
    body: `${name} dejó sus datos desde el folleto de la Fe${phone ? ` · ${phone}` : ""}`,
    url: "/admin/contactos",
    tag: "contact-request",
  });

  return { ok: true };
}

export function isContactSchemaMissing(code: string | undefined): boolean {
  return code === "42P01" || code === "42703" || code === "PGRST205";
}

/** Los pedidos de la comunidad de quien pregunta (RLS: tag de chat). */
export async function getContactRequests(): Promise<{
  rows: ContactRequest[];
  schemaMissing: boolean;
}> {
  if (!isSupabaseConfigured()) return { rows: [], schemaMissing: false };
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("contact_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) {
    if (!isContactSchemaMissing(error.code)) {
      console.error(`[contact] list: ${error.code} ${error.message}`);
    }
    return { rows: [], schemaMissing: isContactSchemaMissing(error.code) };
  }
  return { rows: (data ?? []) as ContactRequest[], schemaMissing: false };
}

/** Cuántos pedidos nuevos hay en la comunidad (para la tarjeta del Inicio
 *  del panel). Falla a cero: el Inicio no puede romperse por esto. */
export async function countNewContactRequests(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const supabase = createSupabaseServer();
  const { count, error } = await supabase
    .from("contact_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "nuevo");
  if (error) return 0;
  return count ?? 0;
}

/** Comunidades activas que se pueden elegir en el formulario público. Se
 *  lee con service-role porque no hay sesión; `localities` es pública igual
 *  (`using (true)`, 012). */
export async function getContactLocalities(): Promise<
  Array<{ id: string; name: string; kind: string }>
> {
  const admin = createSupabaseAdmin();
  if (!admin) return [];
  const { data } = await admin
    .from("localities")
    .select("id, name, kind")
    .eq("is_active", true)
    // Las estructuras (082) no son comunidades que alguien pueda elegir.
    .neq("kind", "estructura")
    .order("name");
  return (data ?? []) as Array<{ id: string; name: string; kind: string }>;
}
