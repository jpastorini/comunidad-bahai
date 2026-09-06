import { unstable_cache } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import {
  createSupabaseAnonNoCookies,
  createSupabaseServer,
  isSupabaseConfigured,
} from "./supabase/server";
import type { Locality, Profile } from "./types";

export type AdminSession = {
  user: { id: string; email: string };
  profile: Profile;
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
  profile: Profile;
} | null {
  try {
    const h = headers();
    const profileJson = h.get("x-profile");
    const userId = h.get("x-user-id");
    if (!profileJson || !userId) return null;
    return {
      userId,
      email: h.get("x-user-email") ?? "",
      profile: JSON.parse(profileJson) as Profile,
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
 * Acceso al shell del panel: admin local O editor designado del Boletín
 * (`can_manage_bulletin`). Lo usan el layout del panel y las pantallas de
 * /admin/boletin — el resto de las páginas del panel siguen auto-protegidas
 * con requireAdmin, así que un editor de boletín no-admin solo puede usar
 * esa sección (el middleware además le bloquea las otras rutas /admin).
 */
export async function requirePanelAccess(): Promise<AdminSession> {
  if (!isSupabaseConfigured()) {
    redirect("/login?error=no-supabase");
  }

  const qualifies = (p: Profile) => p.role === "admin" || p.can_manage_bulletin;

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !qualifies(profile as Profile)) {
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
