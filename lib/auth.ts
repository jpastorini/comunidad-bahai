import { redirect } from "next/navigation";
import { createSupabaseServer, isSupabaseConfigured } from "./supabase/server";
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

/**
 * Loads the signed-in member (any role) and their locality, or redirects
 * to /login. If logged in but locality not chosen yet, redirects to
 * /seleccionar-localidad.
 */
export async function requireMember(
  redirectTo: string = "/"
): Promise<MemberSession & { locality: Locality }> {
  if (!isSupabaseConfigured()) {
    redirect(`/login?error=no-supabase&next=${encodeURIComponent(redirectTo)}`);
  }

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

  const { data: locality } = await supabase
    .from("localities")
    .select("*")
    .eq("id", profile.locality_id)
    .maybeSingle();

  if (!locality) {
    // Localidad borrada — el usuario debe elegir otra.
    redirect(`/seleccionar-localidad?error=missing&next=${encodeURIComponent(redirectTo)}`);
  }

  return {
    user: { id: user.id, email: user.email ?? "" },
    profile: profile as Profile,
    locality: locality as Locality,
  };
}

/** Returns the current member session if authenticated, otherwise null. */
export async function getOptionalMember(): Promise<MemberSession | null> {
  if (!isSupabaseConfigured()) return null;
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

  let locality: Locality | null = null;
  if (profile.locality_id) {
    const { data: loc } = await supabase
      .from("localities")
      .select("*")
      .eq("id", profile.locality_id)
      .maybeSingle();
    locality = (loc as Locality | null) ?? null;
  }

  return {
    user: { id: user.id, email: user.email ?? "" },
    profile: profile as Profile,
    locality,
  };
}

/**
 * Loads the signed-in admin (rol='admin' Y locality_id set), o redirige.
 */
export async function requireAdmin(): Promise<AdminSession> {
  if (!isSupabaseConfigured()) {
    redirect("/admin/login?error=no-supabase");
  }

  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    redirect("/admin/login?error=not-admin");
  }

  if (!profile.locality_id) {
    redirect("/seleccionar-localidad?next=%2Fadmin");
  }

  const { data: locality } = await supabase
    .from("localities")
    .select("*")
    .eq("id", profile.locality_id)
    .maybeSingle();

  if (!locality) {
    redirect("/seleccionar-localidad?error=missing&next=%2Fadmin");
  }

  return {
    user: { id: user.id, email: user.email ?? "" },
    profile: profile as Profile,
    locality: locality as Locality,
  };
}

/**
 * Admin Nacional: puede gestionar localidades y asignar roles globalmente.
 * Redirige si el usuario no tiene el flag.
 */
export async function requireNationalAdmin(): Promise<NationalAdminSession> {
  if (!isSupabaseConfigured()) {
    redirect("/admin/login?error=no-supabase");
  }
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/admin/login?next=%2Fadmin%2Fnacional");
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
