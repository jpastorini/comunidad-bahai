/**
 * Secciones de la app para la estadística de uso (migración 049).
 *
 * Una "sección" es una zona grande, no una pantalla: /mensajes y
 * /mensajes/[id] son las dos "Biblioteca". Las claves viajan a la base
 * (`usage_daily.section`, check `^[a-z_]{1,32}$`), así que son cortas y
 * sin acentos; la etiqueta visible sale de acá.
 *
 * Compartido entre el beacon del cliente y el informe del panel.
 */

export const USAGE_SECTION_LABELS: Record<string, string> = {
  inicio: "Inicio",
  comunicados: "Comunicados",
  chat: "Chat",
  calendario: "Calendario",
  fiestas: "Fiestas de 19 Días",
  dias_sagrados: "Días Sagrados",
  biblioteca: "Biblioteca",
  citas: "Lectura de hoy",
  oraciones: "Oraciones",
  fotos: "Fotos",
  actividades: "Actividades",
  materiales: "Materiales",
  servicio: "Servicio",
  tesoreria: "Tesorería",
  aportes: "Mis aportes",
  boletin: "Boletín",
  notificaciones: "Notificaciones",
  perfil: "Perfil",
  bienvenida: "Bienvenida",
  otro: "Otras pantallas",
};

const FIRST_SEGMENT: Record<string, string> = {
  "": "inicio",
  comunicados: "comunicados",
  chat: "chat",
  calendario: "calendario",
  fiestas: "fiestas",
  "dias-sagrados": "dias_sagrados",
  mensajes: "biblioteca",
  citas: "citas",
  oraciones: "oraciones",
  fotos: "fotos",
  actividades: "actividades",
  materiales: "materiales",
  servicio: "servicio",
  tesoreria: "tesoreria",
  boletin: "boletin",
  "boletin-local": "boletin",
  notificaciones: "notificaciones",
  perfil: "perfil",
  bienvenida: "bienvenida",
};

/** Sección a la que pertenece una ruta de la app de la comunidad. */
export function sectionForPath(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  const first = parts[0] ?? "";
  if (first === "perfil" && parts[1] === "aportes") return "aportes";
  return FIRST_SEGMENT[first] ?? "otro";
}

export function usageSectionLabel(key: string): string {
  return USAGE_SECTION_LABELS[key] ?? key;
}
