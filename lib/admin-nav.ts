import type { Profile } from "@/lib/types";

/**
 * Estructura del menú del panel de la Asamblea.
 *
 * Es UNA sola fuente para el Sidebar: pocos grupos (uno por área de
 * trabajo de la Asamblea) que se despliegan con sus pantallas adentro. Los
 * sub-ítems del menú son también la navegación interna de cada sección, así
 * que no hay pestañas ni hubs de botones aparte: un solo mecanismo.
 *
 * `requires` acota por tag o flag, igual que antes. `match` lista los
 * prefijos de ruta que prenden el ítem cuando no alcanza con el `href`
 * (por ejemplo, el hub viejo de /admin/tesoreria/informes/... no debe
 * prender "Informes de Tesorería" del grupo Asamblea, que es /admin/informes).
 */
export type NavRequirement = "chat" | "treasury" | "bulletin" | "national";

export type NavLeaf = {
  href: string;
  label: string;
  requires?: NavRequirement;
  /** Prefijos extra que también prenden el ítem (además de `href`). */
  match?: string[];
  /** Si es true, el ítem prende solo con la ruta exacta (para "/admin"). */
  exact?: boolean;
};

export type NavGroup = {
  key: string;
  label: string;
  /** Un grupo con `href` y sin `children` es un ítem suelto (Inicio). */
  href?: string;
  children?: NavLeaf[];
  requires?: NavRequirement;
  /** El grupo Nacional se pinta en dorado, el resto en terra. */
  tone?: "terra" | "gold";
};

export const ADMIN_NAV: NavGroup[] = [
  { key: "inicio", label: "Inicio", href: "/admin" },
  {
    key: "asamblea",
    label: "Asamblea",
    children: [
      { href: "/admin/tareas", label: "Tareas" },
      { href: "/admin/disponibilidad", label: "Reuniones" },
      // Registro de solo lectura de los informes emitidos: lo aprueba la
      // Asamblea, así que va acá y no dentro de Tesorería.
      { href: "/admin/informes", label: "Informes de Tesorería" },
    ],
  },
  {
    key: "comunicacion",
    label: "Comunicación",
    children: [
      { href: "/admin/comunicados", label: "Comunicados" },
      { href: "/admin/boletin", label: "Boletín", requires: "bulletin" },
      { href: "/admin/chat", label: "Chat de Secretaría", requires: "chat" },
    ],
  },
  {
    key: "comunidad",
    label: "Vida comunitaria",
    children: [
      { href: "/admin/calendario", label: "Calendario" },
      { href: "/admin/fiestas", label: "Fiestas de 19 Días" },
      { href: "/admin/sugerencias", label: "Sugerencias" },
      { href: "/admin/actividades", label: "Actividades" },
      { href: "/admin/servicio", label: "Servicio" },
      { href: "/admin/materiales", label: "Materiales" },
      { href: "/admin/fotos", label: "Fotos" },
    ],
  },
  {
    key: "creyentes",
    label: "Creyentes",
    children: [
      { href: "/admin/miembros", label: "Creyentes" },
      { href: "/admin/uso", label: "Uso de la app" },
    ],
  },
  {
    key: "tesoreria",
    label: "Tesorería",
    requires: "treasury",
    children: [
      // El recibo se abre desde el libro: prende "Libro".
      { href: "/admin/tesoreria/libro", label: "Libro", match: ["/admin/tesoreria/recibo"] },
      { href: "/admin/tesoreria/informes", label: "Informes" },
      { href: "/admin/tesoreria/progreso", label: "Progreso" },
      { href: "/admin/tesoreria/presupuesto", label: "Presupuesto" },
      { href: "/admin/tesoreria/metas", label: "Metas" },
      { href: "/admin/tesoreria/chat", label: "Mensajes" },
      // El formulario viejo de la tabla `treasury`: lo único que la app de
      // la comunidad sigue leyendo de ahí es "Cómo aportar". Pendiente de
      // jubilar (ver CLAUDE.md).
      { href: "/admin/tesoreria/aportar", label: "Cómo aportar" },
    ],
  },
  {
    key: "nacional",
    label: "Admin Nacional",
    requires: "national",
    tone: "gold",
    children: [
      { href: "/admin/nacional", label: "Panel", exact: true },
      { href: "/admin/mensajes", label: "Mensajes de la Casa Universal" },
      { href: "/admin/nacional/materiales", label: "Materiales nacionales" },
      { href: "/admin/nacional/localidades", label: "Localidades" },
      { href: "/admin/nacional/miembros", label: "Creyentes de todo el país" },
    ],
  },
];

export function canSee(req: NavRequirement | undefined, profile: Profile): boolean {
  // Un editor designado del Boletín (role='member' + can_manage_bulletin)
  // entra al panel pero solo ve su sección; el resto exige rol admin.
  const isAdminRole = profile.role === "admin";
  switch (req) {
    case "chat":
      return isAdminRole && !!profile.can_respond_chat;
    case "treasury":
      return isAdminRole && !!profile.can_manage_treasury;
    case "bulletin":
      return isAdminRole || !!profile.can_manage_bulletin;
    case "national":
      return !!profile.is_national_admin;
    default:
      return isAdminRole;
  }
}

/** Grupos y hojas visibles para este perfil; grupos sin hijos visibles se van. */
export function visibleNav(profile: Profile): NavGroup[] {
  const out: NavGroup[] = [];
  for (const group of ADMIN_NAV) {
    if (group.requires && !canSee(group.requires, profile)) continue;
    if (!group.children) {
      if (canSee(undefined, profile)) out.push(group);
      continue;
    }
    const children = group.children.filter((leaf) =>
      canSee(leaf.requires ?? group.requires, profile)
    );
    if (children.length > 0) out.push({ ...group, children });
  }
  return out;
}

function leafHits(leaf: NavLeaf, pathname: string): boolean {
  if (leaf.exact) return pathname === leaf.href;
  const prefixes = [leaf.href, ...(leaf.match ?? [])];
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * La hoja activa para una ruta: la coincidencia MÁS LARGA entre todas las
 * hojas visibles. Sin esto, /admin/tesoreria/informes prendería también
 * "Informes de Tesorería" (/admin/informes) si compartieran prefijo, y
 * /admin/nacional/materiales prendería "Panel" (/admin/nacional).
 */
export function activeLeaf(
  groups: NavGroup[],
  pathname: string
): { group: NavGroup; leaf: NavLeaf | null } | null {
  let best: { group: NavGroup; leaf: NavLeaf | null; len: number } | null = null;
  for (const group of groups) {
    if (!group.children) {
      if (group.href && pathname === group.href) {
        if (!best || group.href.length > best.len)
          best = { group, leaf: null, len: group.href.length };
      }
      continue;
    }
    for (const leaf of group.children) {
      if (!leafHits(leaf, pathname)) continue;
      const len = Math.max(leaf.href.length, ...(leaf.match ?? []).map((m) => m.length));
      if (!best || len > best.len) best = { group, leaf, len };
    }
  }
  return best ? { group: best.group, leaf: best.leaf } : null;
}
