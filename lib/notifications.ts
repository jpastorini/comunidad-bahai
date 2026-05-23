import { createSupabaseServer, isSupabaseConfigured } from "./supabase/server";
import type { SocialNotification } from "./types";

export async function getNotifications(
  userId: string,
  limit = 50
): Promise<SocialNotification[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("social_notifications")
    .select("*")
    .eq("recipient_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[getNotifications] error:", error);
    return [];
  }
  return (data ?? []) as SocialNotification[];
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const supabase = createSupabaseServer();
  const { count } = await supabase
    .from("social_notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_user_id", userId)
    .is("read_at", null);
  return count ?? 0;
}
