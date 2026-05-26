import { notFound } from "next/navigation";
import { FullGalleryView } from "@/components/gallery/FullGalleryView";
import { GoldHeader } from "@/components/GoldHeader";
import { getOptionalMember } from "@/lib/auth";
import { getCalendarEvent } from "@/lib/data";
import { getEventPhotos } from "@/lib/event-photos";
import { getPhotosInteractions } from "@/lib/photo-interactions";

export const revalidate = 60;

export default async function CalendarEventGalleryPage({
  params,
}: {
  params: { id: string };
}) {
  const [event, photos, session] = await Promise.all([
    getCalendarEvent(params.id),
    getEventPhotos("calendar", params.id),
    getOptionalMember(),
  ]);

  if (!event) notFound();

  const { reactions, comments } = await getPhotosInteractions(
    photos.map((p) => p.id),
    session?.user.id ?? null
  );

  return (
    <>
      <GoldHeader
        title="Galería"
        subtitle={event.title}
        backHref={`/calendario/${event.id}`}
      />
      <FullGalleryView
        eventType="calendar"
        eventId={event.id}
        photos={photos}
        currentUserId={session?.user.id ?? null}
        currentUserName={session?.profile.full_name ?? null}
        isAdmin={session?.profile.role === "admin"}
        adminLocalityId={session?.locality?.id ?? null}
        canUpload={!!session}
        reactionsMap={reactions}
        commentsMap={comments}
      />
    </>
  );
}
