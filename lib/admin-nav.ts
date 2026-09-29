import type { LocalityKind, Profile } from "@/lib/types";

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
  /** Solo en una Asamblea Local: la Comunidad Nacional no lo tiene (056). */
  aelOnly?: boolean;
  /**
   * Título del bloque dentro del grupo. Tesorería tiene demasiadas
   * pantallas para una lista plana: se parten en bloques por FRECUENCIA
   * de uso (todos los días, cada mes, el ejercicio, ajustes), y el
   * Sidebar dibuja el título cuando cambia respecto de la hoja anterior.
   * No es un nivel más de navegación: no se pliega ni tiene ruta.
   */
  section?: string;
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
      // Se llama "Registro" y no "Informes de Tesorería" porque el grupo
      // Tesorería tiene su propio ítem "Informes" (el taller del tesorero)
      // y dos ítems con casi el mismo nombre confundían.
      { href: "/admin/informes", label: "Registro de informes" },
      // La ficha legal (RUT, BPS, estatutos) y quiénes la integran, por
      // ejercicio (052). Informativa: los permisos siguen en los tags.
      { href: "/admin/asamblea", label: "Datos de la Asamblea" },
    ],
  },
  {
    key: "comunicacion",
    label: "Comunicación",
    children: [
      { href: "/admin/comunicados", label: "Comunicados" },
      // Una encuesta ES un comunicado con pregunta (051), pero para quien
      // la arma es otra cosa: tiene su pantalla, pensada desde la pregunta.
      { href: "/admin/encuestas", label: "Encuestas" },
      { href: "/admin/boletin", label: "Boletín", requires: "bulletin" },
      { href: "/admin/chat", label: "Chat de Secretaría", requires: "chat" },
    ],
  },
  {
    key: "comunidad",
    label: "Vida comunitaria",
    children: [
      { href: "/admin/calendario", label: "Calendario" },
      { href: "/admin/fiestas", label: "Fiestas de 19 Días", aelOnly: true },
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
    // Cuatro bloques por frecuencia de uso, pensados para un tesorero que
    // recién agarra el cargo: lo de todos los días arriba, lo que se
    // configura una vez abajo. Un ítem por pantalla principal; las
    // subpantallas (metas, recibo concreto) prenden su ítem por `match`.
    children: [
      // ── Empezar ──
      // El ciclo del mes paso a paso, con el estado de cada paso y el
      // traspaso del cargo. Primero de todo: es por donde arranca quien
      // recién agarra la Tesorería.
      { href: "/admin/tesoreria/guia", label: "Guía del mes", section: "Empezar" },
      // ── Todos los días ──
      // El recibo se abre desde el libro: prende "Libro".
      {
        href: "/admin/tesoreria/libro",
        label: "Libro",
        match: ["/admin/tesoreria/recibo"],
        section: "Todos los días",
      },
      { href: "/admin/tesoreria/chat", label: "Mensajes", section: "Todos los días" },
      // El extracto de la plataforma contra el libro de esa cuenta (061).
      {
        href: "/admin/tesoreria/conciliacion",
        label: "Conciliación",
        section: "Todos los días",
      },
      // ── Cada mes ──
      // El cierre mensual y el Libro de Caja imprimible (054).
      { href: "/admin/tesoreria/libro/cierres", label: "Cierres", section: "Cada mes" },
      // Las reglas deterministas sobre el libro (059): lo que se mira
      // ANTES de cerrar un mes.
      { href: "/admin/tesoreria/auditoria", label: "Auditoría", section: "Cada mes" },
      // Calcular y compartir el estado del Fondo (066): lo ÚNICO que la
      // comunidad ve de la Tesorería, en la app y en la Fiesta.
      { href: "/admin/tesoreria/publicar", label: "Publicar", section: "Cada mes" },
      // Quién declaró un compromiso mensual y cómo viene el mes (063).
      { href: "/admin/tesoreria/compromisos", label: "Compromisos", section: "Cada mes" },
      // ── El ejercicio ──
      // Presupuesto y metas son un solo ítem: las metas se editan en una
      // subpantalla del presupuesto (/metas prende este ítem).
      {
        href: "/admin/tesoreria/presupuesto",
        label: "Presupuesto y metas",
        match: ["/admin/tesoreria/metas"],
        section: "El ejercicio",
      },
      { href: "/admin/tesoreria/progreso", label: "Progreso", section: "El ejercicio" },
      { href: "/admin/tesoreria/informes", label: "Informes", section: "El ejercicio" },
      // Todo lo que el auditor pide, en un ZIP: libro, Libro de Caja por
      // mes, recibos, comprobantes, extractos, auditoría, informes, ficha.
      { href: "/admin/tesoreria/legajo", label: "Legajo para el auditor", section: "El ejercicio" },
      // ── Ajustes ──
      // Cuentas, fondos, categorías y subcategorías con que se carga el libro.
      { href: "/admin/tesoreria/catalogo", label: "Catálogo", section: "Ajustes" },
      // Quién firma, con qué firma y de qué color sale el recibo (060), y
      // los medios de pago que ve la comunidad en "Cómo aportar".
      // ⚠️ El href es más largo que el `match` de "Libro" de arriba, así
      // que la coincidencia de prefijo más larga lo prende a él: un
      // recibo concreto (/recibo/<uuid>) sigue prendiendo "Libro".
      {
        href: "/admin/tesoreria/recibo/ajustes",
        label: "Recibo y medios de pago",
        match: ["/admin/tesoreria/aportar"],
        section: "Ajustes",
      },
      // Cargar un ejercicio entero desde la planilla con que se llevaba
      // antes (062).
      { href: "/admin/tesoreria/libro/importar", label: "Importar", section: "Ajustes" },
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
export function visibleNav(
  profile: Profile,
  localityKind: LocalityKind = "ael"
): NavGroup[] {
  const isNational = localityKind === "nacional";
  const out: NavGroup[] = [];
  for (const group of ADMIN_NAV) {
    if (group.requires && !canSee(group.requires, profile)) continue;
    if (!group.children) {
      if (canSee(undefined, profile)) out.push(group);
      continue;
    }
    const children = group.children.filter(
      (leaf) =>
        canSee(leaf.requires ?? group.requires, profile) &&
        !(isNational && leaf.aelOnly)
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
