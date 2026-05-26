import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase con service-role (bypassa RLS). SOLO para código de
 * servidor que necesita leer/escribir a través de usuarios — por ejemplo,
 * enviar Web Push a las suscripciones de otro usuario.
 *
 * Devuelve null si falta SUPABASE_SERVICE_ROLE_KEY (el envío de push hace
 * no-op en ese caso). Nunca exponer esta key al cliente.
 */
export function createSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
