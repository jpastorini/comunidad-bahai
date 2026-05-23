import { notFound } from "next/navigation";
import { FullGalleryView } from "@/components/gallery/FullGalleryView";
import { GoldHeader } from "@/components/GoldHeader";
import { getOptionalMember } from "@/lib/auth";
import { getCalendarEvent } from "@/lib/data";
import { getEventPhotos } from "@/lib/event-photos";

export const dynamic = "force-dynamic";

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
        isAdmin={session?.profile.role === "admin"}
        adminLocalityId={session?.locality?.id ?? null}
        canUpload={!!session}
      />
    </>
  );
}
