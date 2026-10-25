/**
 * Datos que aparecen en las páginas legales (privacidad y términos) y en
 * la configuración del consent screen de Google. Centralizados acá para
 * que cambiarlos sea un solo renglón.
 *
 * Si cambia el dominio, actualizá `appUrl` y, en
 * Google Cloud Console, el "authorized domain".
 */
export const LEGAL = {
  appName: "Comunidad Bahá'í",
  /** Responsable del tratamiento de los datos. */
  responsible: "Jorge Pastorini",
  /** Contacto de privacidad / soporte. */
  contactEmail: "jpastorini@gmail.com",
  /** URL pública de la app (sin barra final). */
  appUrl: "https://mvd.bahai.uy",
  /** Última actualización del texto legal. */
  lastUpdated: "30 de mayo de 2026",
} as const;
