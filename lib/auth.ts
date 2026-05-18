import { redirect } from "next/navigation";
import { createSupabaseServer, isSupabaseConfigured } from "./supabase/server";
import type { Profile } from "./types";

export type AdminSession = {
  user: { id: string; email: string };
  profile: Profile;
};

export type MemberSession = {
  user: { id: string; email: string };
  profile: Profile;
};

/**
 * Loads the signed-in member (any role) or redirects to /login.
 * Use for member-facing features that need identity (chat, volunteer, etc.).
 */
export async function requireMember(
  redirectTo: string = "/"
): Promise<MemberSession> {
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

  return {
    user: { id: user.id, email: user.email ?? "" },
    profile: profile as Profile,
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
  return {
    user: { id: user.id, email: user.email ?? "" },
    profile: profile as Profile,
  };
}

/**
 * Loads the signed-in admin or redirects to /admin/login.
 * Use at the top of every server component inside (admin) routes.
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
