import { MarkAsReadOnMount } from "@/components/notifications/MarkAsReadOnMount";
import { NotificationsList } from "@/components/notifications/NotificationsList";
import { GoldHeader } from "@/components/GoldHeader";
import { requireMember } from "@/lib/auth";
import { getNotifications } from "@/lib/notifications";
import { createSupabaseServer } from "@/lib/supabase/server";

export const revalidate = 60;

export default async function NotificationsPage() {
  const session = await requireMember("/notificaciones");
  const notifications = await getNotifications(session.user.id);

  const photoIds = Array.from(
    new Set(notifications.map((n) => n.photo_id).filter(Boolean) as string[])
  );
  const thumbnails = await fetchThumbnails(photoIds);

  return (
    <>
      <GoldHeader title="Notificaciones" backHref="/" />
      <MarkAsReadOnMount />
      <main className="scroll-area flex-1">
        <NotificationsList
          notifications={notifications}
          thumbnails={thumbnails}
        />
      </main>
    </>
  );
}

async function fetchThumbnails(
  photoIds: string[]
): Promise<Record<string, string>> {
  if (photoIds.length === 0) return {};
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("event_photos")
    .select("id, public_url")
    .in("id", photoIds);
  const map: Record<string, string> = {};
  for (const row of (data ?? []) as { id: string; public_url: string }[]) {
    map[row.id] = row.public_url;
  }
  return map;
}
