import {
  isHelper,
  permissionAvailable,
  type PanelProfile,
  type Permission,
} from "@/lib/delegations";
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
export type NavRequirement = "chat" | "treasury" | "national";

// Un ayudante (088) ve SOLO las hojas con `perm` que le encargaron. Es una
// lista de lo que sí, como el menú de una estructura: una pantalla nueva
// no se le aparece a un ayudante hasta que alguien le ponga su permiso.

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
  /**
   * Con una estructura puesta (082). En un grupo `inStructure: "some"`,
   * la hoja aparece solo si lo dice (`true`, o un texto que reemplaza la
   * etiqueta); en un grupo `"all"`, aparecen todas menos las `false`.
   */
  inStructure?: boolean | string;
  /** Solo con una estructura puesta: una Asamblea no lo tiene (084). */
  onlyInStructure?: boolean;
  /** El permiso que la abre para un ayudante (088). */
  perm?: Permission;
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
  /**
   * Qué ve una estructura (082). Es una lista de lo que SÍ, no de lo que
   * no: una estructura no tiene creyentes, y una pantalla nueva del panel
   * no tiene por qué aparecerle hasta que alguien lo decida. Sin esto, el
   * grupo no se muestra.
   */
  inStructure?: "some" | "all";
  /** El nombre del grupo con una estructura puesta. */
  structureLabel?: string;
};

export const ADMIN_NAV: NavGroup[] = [
  { key: "inicio", label: "Inicio", href: "/admin", inStructure: "all" },
  {
    key: "asamblea",
    label: "Asamblea",
    inStructure: "some",
    structureLabel: "Reuniones y tareas",
    children: [
      { href: "/admin/tareas", label: "Tareas", inStructure: true },
      { href: "/admin/disponibilidad", label: "Reuniones", inStructure: true },
      // Las actas con su archivo (084), de la institución puesta.
      { href: "/admin/actas", label: "Actas", inStructure: true },
      // Lo que una estructura le presenta a su Asamblea (084): informes de
      // actividad y de Tesorería. La Asamblea los ve en el Registro.
      {
        href: "/admin/presentar",
        label: "Informes a la Asamblea",
        inStructure: true,
        onlyInStructure: true,
      },
      // Los Comités, Departamentos y la Coordinación o Junta de Instituto
      // que creó esta Asamblea, con sus integrantes (082). Con una
      // estructura puesta, la misma pantalla muestra quiénes la integran.
      { href: "/admin/estructuras", label: "Estructuras", inStructure: "Integrantes" },
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
      { href: "/admin/comunicados", label: "Comunicados", perm: "comunicados" },
      // Una encuesta ES un comunicado con pregunta (051), pero para quien
      // la arma es otra cosa: tiene su pantalla, pensada desde la pregunta.
      { href: "/admin/encuestas", label: "Encuestas", perm: "comunicados" },
      { href: "/admin/boletin", label: "Boletín", perm: "boletin" },
      { href: "/admin/chat", label: "Chat de Secretaría", requires: "chat", perm: "secretaria" },
      // Quién dejó sus datos en el folleto público de la Fe (080): lo
      // atiende quien atiende el chat de Secretaría.
      { href: "/admin/contactos", label: "Contactos", requires: "chat", perm: "contactos" },
    ],
  },
  {
    key: "comunidad",
    label: "Vida comunitaria",
    inStructure: "some",
    structureLabel: "Agenda",
    children: [
      { href: "/admin/calendario", label: "Calendario", inStructure: true, perm: "calendario" },
      { href: "/admin/fiestas", label: "Fiestas de 19 Días", aelOnly: true, perm: "fiestas" },
      { href: "/admin/sugerencias", label: "Sugerencias", perm: "fiestas" },
      { href: "/admin/actividades", label: "Actividades", perm: "actividades" },
      { href: "/admin/servicio", label: "Servicio", perm: "servicio" },
      { href: "/admin/materiales", label: "Materiales", perm: "materiales" },
      { href: "/admin/fotos", label: "Fotos", perm: "fotos" },
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
    // Una estructura lleva su libro igual que una Asamblea (082), menos lo
    // que mira a la comunidad: el chat con los creyentes, Publicar, los
    // compromisos y los aportes por Mercado Pago.
    inStructure: "all",
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
      // Toda la ayuda junta, para imprimir el primer día.
      { href: "/admin/tesoreria/manual", label: "Manual", section: "Empezar" },
      // El acta que firman quien entrega y quien recibe, y los pasos del cambio.
      { href: "/admin/tesoreria/traspaso", label: "Traspaso", section: "Empezar" },
      // ── Todos los días ──
      // El recibo se abre desde el libro: prende "Libro".
      {
        href: "/admin/tesoreria/libro",
        label: "Libro",
        match: ["/admin/tesoreria/recibo"],
        section: "Todos los días",
      },
      { href: "/admin/tesoreria/chat", label: "Mensajes", section: "Todos los días", inStructure: false },
      // El extracto de la plataforma contra el libro de esa cuenta (061).
      {
        href: "/admin/tesoreria/conciliacion",
        label: "Conciliación",
        section: "Todos los días",
      },
      // ── Cada mes ──
      // El efectivo: cajas con responsable, fondo fijo, rendición y arqueo (074).
      { href: "/admin/tesoreria/cajas", label: "Cajas chicas", section: "Cada mes" },
      // El cierre mensual y el Libro de Caja imprimible (054).
      { href: "/admin/tesoreria/libro/cierres", label: "Cierres", section: "Cada mes" },
      // Las reglas deterministas sobre el libro (059): lo que se mira
      // ANTES de cerrar un mes.
      { href: "/admin/tesoreria/auditoria", label: "Auditoría", section: "Cada mes" },
      // Calcular y compartir el estado del Fondo (066): lo ÚNICO que la
      // comunidad ve de la Tesorería, en la app y en la Fiesta.
      { href: "/admin/tesoreria/publicar", label: "Publicar", section: "Cada mes", inStructure: false },
      // Quién declaró un compromiso mensual y cómo viene el mes (063).
      { href: "/admin/tesoreria/compromisos", label: "Compromisos", section: "Cada mes", inStructure: false },
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
      // El padrón de quienes aportan: vincular, fusionar dobles, desactivar (075).
      { href: "/admin/tesoreria/contribuyentes", label: "Contribuyentes", section: "Ajustes" },
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
      // La cuenta de Mercado Pago con que cobra la comunidad y los aportes
      // que entran solos al libro desde la app (079).
      { href: "/admin/tesoreria/mercadopago", label: "Mercado Pago", section: "Ajustes", inStructure: false },
      // Cargar un ejercicio entero desde la planilla con que se llevaba
      // antes (062).
      { href: "/admin/tesoreria/libro/importar", label: "Importar", section: "Ajustes" },
    ],
  },
  {
    key: "nacional",
    label: "Admin Nacional",
    requires: "national",
    inStructure: "all",
    tone: "gold",
    children: [
      { href: "/admin/nacional", label: "Panel", exact: true },
      { href: "/admin/mensajes", label: "Mensajes de la Casa Universal" },
      // Reemplazar la Lectura de hoy del día siguiente por una cita a mano (081).
      { href: "/admin/nacional/lectura", label: "Lectura de mañana" },
      { href: "/admin/nacional/materiales", label: "Materiales nacionales" },
      { href: "/admin/nacional/localidades", label: "Localidades" },
      // El mapa del país (086): qué agrupación va en cada zona electoral y
      // en qué agrupación está cada Asamblea Local.
      { href: "/admin/nacional/territorio", label: "Zonas y agrupaciones" },
      { href: "/admin/nacional/miembros", label: "Creyentes de todo el país" },
    ],
  },
];

export function canSee(req: NavRequirement | undefined, profile: Profile): boolean {
  const isAdminRole = profile.role === "admin";
  switch (req) {
    case "chat":
      return isAdminRole && !!profile.can_respond_chat;
    case "treasury":
      return isAdminRole && !!profile.can_manage_treasury;
    case "national":
      return !!profile.is_national_admin;
    default:
      return isAdminRole;
  }
}

/** Grupos y hojas visibles para este perfil; grupos sin hijos visibles se van. */
export function visibleNav(
  profile: PanelProfile,
  localityKind: LocalityKind = "ael"
): NavGroup[] {
  const isNational = localityKind === "nacional";
  const isStructure = localityKind === "estructura";
  if (isHelper(profile)) return helperNav(profile, isNational);
  const out: NavGroup[] = [];
  for (const group of ADMIN_NAV) {
    if (group.requires && !canSee(group.requires, profile)) continue;
    if (isStructure && !group.inStructure) continue;
    if (!group.children) {
      if (canSee(undefined, profile)) out.push(group);
      continue;
    }
    const children = group.children
      .filter(
        (leaf) =>
          canSee(leaf.requires ?? group.requires, profile) &&
          !((isNational || isStructure) && leaf.aelOnly) &&
          !(!isStructure && leaf.onlyInStructure) &&
          (!isStructure ||
            (group.inStructure === "all"
              ? leaf.inStructure !== false
              : !!leaf.inStructure))
      )
      .map((leaf) =>
        isStructure && typeof leaf.inStructure === "string"
          ? { ...leaf, label: leaf.inStructure }
          : leaf
      );
    if (children.length > 0) {
      out.push({
        ...group,
        label: isStructure ? group.structureLabel ?? group.label : group.label,
        children,
      });
    }
  }
  return out;
}

/** El menú de un ayudante: solo las hojas de sus permisos, sin Inicio. */
function helperNav(profile: PanelProfile, isNational: boolean): NavGroup[] {
  const perms = new Set(profile.delegations ?? []);
  const out: NavGroup[] = [];
  for (const group of ADMIN_NAV) {
    const children = (group.children ?? []).filter(
      (leaf) =>
        leaf.perm &&
        perms.has(leaf.perm) &&
        permissionAvailable(leaf.perm, isNational) &&
        !(isNational && leaf.aelOnly)
    );
    if (children.length > 0) out.push({ ...group, children });
  }
  return out;
}

/**
 * ¿Puede un ayudante (088) abrir esta ruta? Lo que no está en su menú no
 * está para él, aunque llegue por URL: el layout lo manda a su primera
 * sección (`helperHome`). Las subpantallas cuelgan del prefijo de su hoja.
 */
export function helperAllowsPath(
  profile: PanelProfile,
  pathname: string,
  localityKind: LocalityKind = "ael"
): boolean {
  return helperNav(profile, localityKind === "nacional").some((group) =>
    (group.children ?? []).some((leaf) => leafHits(leaf, pathname))
  );
}

/** Adónde entra un ayudante al abrir el panel: su primera sección. */
export function helperHome(
  profile: PanelProfile,
  localityKind: LocalityKind = "ael"
): string | null {
  return helperNav(profile, localityKind === "nacional")[0]?.children?.[0]?.href ?? null;
}

/**
 * ¿Puede una estructura (082) abrir esta ruta del panel? Lo que no está en
 * su menú no está para ella, aunque llegue por URL: el layout del panel la
 * manda al Inicio. Las subpantallas (nuevo, editar, un recibo) cuelgan del
 * prefijo de su hoja, así que pasan solas.
 */
export function structureAllowsPath(profile: Profile, pathname: string): boolean {
  // /admin/tesoreria solo redirige al Libro.
  if (pathname === "/admin/tesoreria") return true;
  const groups = visibleNav(profile, "estructura");
  return groups.some((group) =>
    group.children
      ? group.children.some((leaf) => leafHits(leaf, pathname))
      : group.href === pathname
  );
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
