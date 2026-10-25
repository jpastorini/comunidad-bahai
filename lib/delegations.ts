import type { Profile } from "./types";

/**
 * Ayudantes de la Asamblea (migración 088): lo que una Asamblea le puede
 * encargar a un creyente que no la integra. Puro, sin `server-only`: lo
 * usan el menú del panel (cliente) y los guards del servidor.
 *
 * La lista tiene que coincidir con el check de `delegations.permission`.
 * La Tesorería, Creyentes, Datos de la Asamblea, Actas y Estructuras no
 * están a propósito: no se delegan.
 */
export type Permission =
  | "calendario"
  | "fiestas"
  | "actividades"
  | "servicio"
  | "materiales"
  | "fotos"
  | "comunicados"
  | "boletin"
  | "contactos"
  | "secretaria";

export type PermissionInfo = {
  key: Permission;
  label: string;
  group: "Vida comunitaria" | "Comunicación" | "Secretaría";
  /** Una línea para la ficha: qué puede hacer con esto. */
  hint: string;
  /**
   * Solo en una Asamblea Local. La Fiesta no existe en la Comunidad
   * Nacional (056), y un comunicado con el sombrero nacional es para todo
   * el país, que publica solo la Asamblea Nacional (057).
   */
  aelOnly?: boolean;
};

export const PERMISSIONS: PermissionInfo[] = [
  { key: "calendario", label: "Calendario", group: "Vida comunitaria", hint: "Crear y editar eventos." },
  { key: "fiestas", label: "Fiestas de 19 Días", group: "Vida comunitaria", hint: "Armar la Fiesta, ver quiénes van y las sugerencias.", aelOnly: true },
  { key: "actividades", label: "Actividades", group: "Vida comunitaria", hint: "Cargar las actividades de la comunidad." },
  { key: "servicio", label: "Servicio", group: "Vida comunitaria", hint: "Publicar necesidades y ver quiénes se ofrecen." },
  { key: "materiales", label: "Materiales", group: "Vida comunitaria", hint: "Subir y ordenar materiales de la comunidad." },
  { key: "fotos", label: "Fotos", group: "Vida comunitaria", hint: "Ordenar, destacar y quitar fotos y comentarios." },
  { key: "comunicados", label: "Comunicados y encuestas", group: "Comunicación", hint: "Publicar (con aviso a todos) y ver quién los leyó.", aelOnly: true },
  { key: "boletin", label: "Boletín", group: "Comunicación", hint: "Armar y publicar el Boletín local." },
  { key: "contactos", label: "Contactos", group: "Comunicación", hint: "Atender a quien dejó sus datos en el folleto." },
  { key: "secretaria", label: "Chat de Secretaría", group: "Secretaría", hint: "Leer y responder las conversaciones con la Secretaría." },
];

export const PERMISSION_LABELS = Object.fromEntries(
  PERMISSIONS.map((p) => [p.key, p.label])
) as Record<Permission, string>;

export function isPermission(value: unknown): value is Permission {
  return PERMISSIONS.some((p) => p.key === value);
}

/** ¿Se puede encargar en esta comunidad? Ver `aelOnly`. */
export function permissionAvailable(perm: Permission, national: boolean): boolean {
  return !(national && PERMISSIONS.find((p) => p.key === perm)?.aelOnly);
}

/**
 * El perfil como lo ven el panel y los guards: los nombramientos vigentes
 * en la comunidad puesta los inyecta el middleware SOLO para quien no es
 * de la Asamblea y entra a /admin (header `x-delegations`).
 */
export type PanelProfile = Profile & { delegations?: Permission[] };

/** Es ayudante (y no Asamblea) en la comunidad puesta. */
export function isHelper(profile: PanelProfile): boolean {
  return profile.role !== "admin" && (profile.delegations?.length ?? 0) > 0;
}

/**
 * ¿Puede usar esta sección? La Asamblea puede todo menos los canales que
 * piden tag (el chat de Secretaría y Contactos los atiende quien tiene
 * `can_respond_chat`, como siempre); un ayudante, lo que le encargaron.
 */
export function hasPermission(profile: PanelProfile, perm: Permission): boolean {
  if (profile.delegations?.includes(perm)) return true;
  if (profile.role !== "admin") return false;
  if (perm === "secretaria" || perm === "contactos") return !!profile.can_respond_chat;
  return true;
}

/** "Fotos, Calendario y Boletín", en el orden del catálogo. */
export function permissionsSentence(perms: Permission[]): string {
  const labels = PERMISSIONS.filter((p) => perms.includes(p.key)).map((p) => p.label);
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`;
}
