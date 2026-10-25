import { unstable_cache } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import {
  createSupabaseAnonNoCookies,
  createSupabaseServer,
  isSupabaseConfigured,
} from "./supabase/server";
import {
  hasPermission,
  permissionAvailable,
  type PanelProfile,
  type Permission,
} from "./delegations";
import {
  isNationalLocality,
  isStructureLocality,
  type Locality,
  type Profile,
} from "./types";

export type AdminSession = {
  user: { id: string; email: string };
  /** Con `delegations` si es un ayudante (088), no la Asamblea. */
  profile: PanelProfile;
  locality: Locality;
};

export type MemberSession = {
  user: { id: string; email: string };
  profile: Profile;
  locality: Locality | null; // null si todavía no eligió
};

export type NationalAdminSession = {
  user: { id: string; email: string };
  profile: Profile;
};

// ── Helpers internos ──────────────────────────────────────────────

/**
 * Lee el perfil inyectado por el middleware (x-profile header).
 * Devuelve null si no hay header (fallback al flujo original).
 */
function getProfileFromHeaders(): {
  userId: string;
  email: string;
  profile: PanelProfile;
} | null {
  try {
    const h = headers();
    const profileJson = h.get("x-profile");
    const userId = h.get("x-user-id");
    if (!profileJson || !userId) return null;
    const profile = JSON.parse(profileJson) as PanelProfile;
    // Los nombramientos de un ayudante (088): el middleware los pone solo
    // para quien no es de la Asamblea y entra a /admin.
    const delegations = h.get("x-delegations");
    if (delegations) profile.delegations = JSON.parse(delegations) as Permission[];
    return {
      userId,
      email: h.get("x-user-email") ?? "",
      profile,
    };
  } catch {
    return null;
  }
}

/** Tag para invalidar la localidad cacheada cuando el admin nacional la edita. */
export const localityTag = (localityId: string) => `locality-${localityId}`;

/**
 * Localidad por id. Era la única query que quedaba en cada render de cada
 * página del panel y de la app — y salía DOS veces por navegación, porque
 * el layout y la página llaman al mismo guard. Ahora va por dos cachés:
 *
 *   - unstable_cache la guarda entre requests, con tag propio para tirarla
 *     abajo cuando se edita (ver app/admin/(panel)/nacional/actions.ts).
 *     El revalidate de una hora es solo la red de seguridad: la
 *     invalidación real es por tag.
 *   - cache() de React deduplica las llamadas dentro de un mismo render,
 *     que es lo que arregla el layout+página.
 *
 * ⚠️ Adentro de unstable_cache no se puede leer cookies(), así que va con
 * el cliente anónimo. Es válido acá y solo acá porque la policy de lectura
 * de `localities` es `using (true)` (migración 012): el dato es el mismo
 * para todos y no depende de quién pregunta.
 */
const getLocality = cache(
  async (localityId: string): Promise<Locality | null> =>
    unstable_cache(
      async () => {
        const supabase = createSupabaseAnonNoCookies();
        const { data } = await supabase
          .from("localities")
          .select("*")
          .eq("id", localityId)
          .maybeSingle();
        return (data as Locality | null) ?? null;
      },
      ["locality", localityId],
      { tags: [localityTag(localityId)], revalidate: 3600 }
    )()
);

/**
 * Igual que getLocality, pero manda a elegir localidad si no existe.
 * El redirect queda AFUERA del caché a propósito: redirect() lanza una
 * excepción de control de Next y no tiene por qué quedar guardada.
 */
async function loadLocality(
  localityId: string,
  redirectOnMissing: string
): Promise<Locality> {
  const locality = await getLocality(localityId);
  if (!locality) {
    redirect(
      `/seleccionar-localidad?error=missing&next=${encodeURIComponent(redirectOnMissing)}`
    );
  }
  return locality;
}

/**
 * Una estructura (082) se tiene puesta solo en el panel: no tiene
 * creyentes, y con ella puesta el Inicio, los Comunicados y la Tesorería
 * del creyente le apuntarían al comité. Si alguien entra a la app así,
 * va a /comunidad/volver, que le devuelve su comunidad y lo trae de
 * vuelta adonde iba. Esa pantalla cambia el sombrero recién al montarse
 * en el navegador, así que un prefetch no lo cambia por accidente.
 */
function leaveStructureHat(locality: Locality, fallbackPath: string): void {
  if (!isStructureLocality(locality)) return;
  let next = fallbackPath;
  try {
    next = headers().get("x-pathname") ?? fallbackPath;
  } catch {
    // sin headers: vuelve al destino que pidió la página
  }
  redirect(`/comunidad/volver?next=${encodeURIComponent(next)}`);
}

// ── Funciones públicas ────────────────────────────────────────────

/**
 * Loads the signed-in member (any role) and their locality, or redirects
 * to /login. If logged in but locality not chosen yet, redirects to
 * /seleccionar-localidad.
 *
 * OPTIMIZADO: lee el perfil del header x-profile (inyectado por el
 * middleware), eliminando 2 round-trips a Supabase por navegación.
 */
export async function requireMember(
  redirectTo: string = "/"
): Promise<MemberSession & { locality: Locality }> {
  if (!isSupabaseConfigured()) {
    redirect(`/login?error=no-supabase&next=${encodeURIComponent(redirectTo)}`);
  }

  // ── Fast path: perfil ya disponible desde middleware ──────────
  const cached = getProfileFromHeaders();
  if (cached) {
    if (!cached.profile.locality_id) {
      redirect(`/seleccionar-localidad?next=${encodeURIComponent(redirectTo)}`);
    }
    const locality = await loadLocality(cached.profile.locality_id, redirectTo);
    leaveStructureHat(locality, redirectTo);
    return {
      user: { id: cached.userId, email: cached.email },
      profile: cached.profile,
      locality,
    };
  }

  // ── Fallback: comportamiento original (sin header) ────────────
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(redirectTo)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/login?error=no-profile");
  }

  // Si no eligió localidad, forzamos la selección antes de cualquier otra cosa.
  if (!profile.locality_id) {
    redirect(`/seleccionar-localidad?next=${encodeURIComponent(redirectTo)}`);
  }

  const locality = await loadLocality(profile.locality_id, redirectTo);
  leaveStructureHat(locality, redirectTo);

  return {
    user: { id: user.id, email: user.email ?? "" },
    profile: profile as Profile,
    locality,
  };
}

/** Returns the current member session if authenticated, otherwise null. */
export async function getOptionalMember(): Promise<MemberSession | null> {
  if (!isSupabaseConfigured()) return null;

  // ── Fast path ─────────────────────────────────────────────────
  const cached = getProfileFromHeaders();
  if (cached) {
    const locality = cached.profile.locality_id
      ? await getLocality(cached.profile.locality_id)
      : null;
    return {
      user: { id: cached.userId, email: cached.email },
      profile: cached.profile,
      locality,
    };
  }

  // ── Fallback ──────────────────────────────────────────────────
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;

  const locality = profile.locality_id
    ? await getLocality(profile.locality_id)
    : null;

  return {
    user: { id: user.id, email: user.email ?? "" },
    profile: profile as Profile,
    locality,
  };
}

/**
 * Loads the signed-in admin (rol='admin' Y locality_id set), o redirige.
 *
 * OPTIMIZADO: usa el header x-profile del middleware.
 */
export async function requireAdmin(): Promise<AdminSession> {
  if (!isSupabaseConfigured()) {
    redirect("/login?error=no-supabase");
  }

  // ── Fast path ─────────────────────────────────────────────────
  const cached = getProfileFromHeaders();
  if (cached) {
    if (cached.profile.role !== "admin") {
      // Logueado pero sin rol admin → a su app de comunidad.
      redirect("/");
    }
    if (!cached.profile.locality_id) {
      redirect("/seleccionar-localidad?next=%2Fadmin");
    }
    const locality = await loadLocality(cached.profile.locality_id, "/admin");
    return {
      user: { id: cached.userId, email: cached.email },
      profile: cached.profile,
      locality,
    };
  }

  // ── Fallback ──────────────────────────────────────────────────
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fadmin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    redirect("/");
  }

  if (!profile.locality_id) {
    redirect("/seleccionar-localidad?next=%2Fadmin");
  }

  const locality = await loadLocality(profile.locality_id, "/admin");

  return {
    user: { id: user.id, email: user.email ?? "" },
    profile: profile as Profile,
    locality,
  };
}

/**
 * Acceso al shell del panel: la Asamblea (rol admin) o un ayudante con
 * algún nombramiento vigente en la comunidad puesta (088). Lo usa el layout
 * del panel; cada sección se protege además con requirePermission (las
 * delegables) o requireAdmin (las que solo son de la Asamblea).
 */
export async function requirePanelAccess(): Promise<AdminSession> {
  if (!isSupabaseConfigured()) {
    redirect("/login?error=no-supabase");
  }

  const qualifies = (p: PanelProfile) =>
    p.role === "admin" || (p.delegations?.length ?? 0) > 0;

  // ── Fast path ─────────────────────────────────────────────────
  const cached = getProfileFromHeaders();
  if (cached) {
    if (!qualifies(cached.profile)) {
      redirect("/");
    }
    if (!cached.profile.locality_id) {
      redirect("/seleccionar-localidad?next=%2Fadmin");
    }
    const locality = await loadLocality(cached.profile.locality_id, "/admin");
    return {
      user: { id: cached.userId, email: cached.email },
      profile: cached.profile,
      locality,
    };
  }

  // ── Fallback ──────────────────────────────────────────────────
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fadmin");
  }

  const { data: row } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  const profile = row as PanelProfile | null;
  if (profile && profile.role !== "admin") {
    const { data, error } = await supabase.rpc("my_delegations");
    profile.delegations = error
      ? profile.can_manage_bulletin
        ? ["boletin"]
        : []
      : ((data as Permission[] | null) ?? []);
  }

  if (!profile || !qualifies(profile)) {
    redirect("/");
  }

  if (!profile.locality_id) {
    redirect("/seleccionar-localidad?next=%2Fadmin");
  }

  const locality = await loadLocality(profile.locality_id, "/admin");

  return {
    user: { id: user.id, email: user.email ?? "" },
    profile,
    locality,
  };
}

/**
 * Guard de una sección que se puede delegar (088): la Asamblea (con el tag
 * de chat para Secretaría y Contactos) o un ayudante con ese permiso. A
 * quien no lo tiene lo devuelve al Inicio del panel, que a un ayudante lo
 * manda a su primera sección.
 */
export async function requirePermission(perm: Permission): Promise<AdminSession> {
  const session = await requirePanelAccess();
  const helperOutOfPlace =
    session.profile.role !== "admin" &&
    !permissionAvailable(perm, isNationalLocality(session.locality));
  if (!hasPermission(session.profile, perm) || helperOutOfPlace) {
    redirect("/admin?error=sin-permiso");
  }
  return session;
}

/**
 * Admin Nacional: puede gestionar localidades y asignar roles globalmente.
 * Redirige si el usuario no tiene el flag.
 */
export async function requireNationalAdmin(): Promise<NationalAdminSession> {
  if (!isSupabaseConfigured()) {
    redirect("/login?error=no-supabase");
  }

  // ── Fast path ─────────────────────────────────────────────────
  const cached = getProfileFromHeaders();
  if (cached) {
    if (!cached.profile.is_national_admin) {
      redirect("/admin?error=not-national-admin");
    }
    return {
      user: { id: cached.userId, email: cached.email },
      profile: cached.profile,
    };
  }

  // ── Fallback ──────────────────────────────────────────────────
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=%2Fadmin%2Fnacional");
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_national_admin) {
    redirect("/admin?error=not-national-admin");
  }
  return {
    user: { id: user.id, email: user.email ?? "" },
    profile: profile as Profile,
  };
}

/** Throws (404) if the admin doesn't have the `can_respond_chat` tag. */
export function ensureChatTag(profile: Profile) {
  if (!profile.can_respond_chat) {
    redirect("/admin?error=no-chat-tag");
  }
}

/** Throws (redirect) if the admin doesn't have the `can_manage_treasury` tag. */
export function ensureTreasuryTag(profile: Profile) {
  if (!profile.can_manage_treasury) {
    redirect("/admin?error=no-treasury-tag");
  }
}

/**
 * Como requireMember, pero además exige ser creyente. Es el guard de las
 * pantallas que un Amigo/a de la Fe no tiene (Tesorería, Fiestas, Mis
 * aportes, chat con el tesorero): la RLS ya no le devolvería nada, esto
 * evita mostrarle una pantalla vacía y lo manda al Inicio. Migración 047.
 */
export async function requireBahai(
  redirectTo: string = "/"
): Promise<MemberSession & { locality: Locality }> {
  const session = await requireMember(redirectTo);
  if (!session.profile.is_bahai) {
    redirect("/");
  }
  return session;
}

/**
 * La Fiesta de los 19 Días se celebra en la comunidad local: la
 * Comunidad Nacional (056) no la tiene. Quien ande con ese sombrero
 * puesto vuelve al Inicio en vez de encontrar una pantalla vacía.
 * Incluye el guard de creyente, porque un Amigo/a de la Fe tampoco.
 */
export async function requireFeastAccess(
  redirectTo: string = "/"
): Promise<MemberSession & { locality: Locality }> {
  const session = await requireBahai(redirectTo);
  if (isNationalLocality(session.locality)) {
    redirect("/");
  }
  return session;
}
