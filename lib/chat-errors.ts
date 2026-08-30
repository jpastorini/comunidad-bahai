import "server-only";

/**
 * Forma mínima de un error de PostgREST/Supabase. No importamos el tipo
 * de la librería para que este módulo sirva igual con `.rpc()`, `.insert()`
 * y `.select()`, que lo tipan distinto.
 */
type SupabaseErrorLike = {
  message: string;
  code?: string | null;
  details?: string | null;
} | null;

/**
 * Códigos que significan "la base no tiene todavía lo que el código pide":
 * columna inexistente (42703), función inexistente (42883), y sus
 * equivalentes del caché de esquema de PostgREST (PGRST202/PGRST204).
 *
 * Vale la pena distinguirlos: es exactamente lo que pasa cuando se
 * despliega antes de correr la migración, y sin este mensaje el síntoma
 * es una conversación vacía —indistinguible de "no hay mensajes"— que
 * parece pérdida de datos.
 */
const SCHEMA_CODES = new Set(["42703", "42883", "PGRST202", "PGRST204"]);

const SCHEMA_MESSAGE =
  "El chat necesita una actualización de la base de datos que todavía no se aplicó. Avisale a quien administra la app.";

/**
 * Loguea el error con contexto y devuelve el texto a mostrar, o null si
 * no hubo error. `fallback` es el mensaje propio de cada pantalla
 * ("no pudimos cargar…", "no pudimos enviar…").
 *
 * El log va SIEMPRE, aunque la pantalla decida no mostrar nada: es lo que
 * queda en los logs de Vercel para saber qué falló.
 */
export function chatFailure(
  where: string,
  error: SupabaseErrorLike,
  fallback: string
): string | null {
  if (!error) return null;
  console.error(
    `[chat] ${where}: ${error.code ?? "sin código"} — ${error.message}`
  );
  if (error.code && SCHEMA_CODES.has(error.code)) return SCHEMA_MESSAGE;
  return fallback;
}
