import { notFound } from "next/navigation";
import { FullGalleryView } from "@/components/gallery/FullGalleryView";
import { GoldHeader } from "@/components/GoldHeader";
import { getOptionalMember } from "@/lib/auth";
import { getFeast } from "@/lib/data";
import { getEventPhotos } from "@/lib/event-photos";
import { getPhotosInteractions } from "@/lib/photo-interactions";

export const revalidate = 60;

export default async function FeastGalleryPage({
  params,
}: {
  params: { id: string };
}) {
  const [feast, photos, session] = await Promise.all([
    getFeast(params.id),
    getEventPhotos("feast", params.id),
    getOptionalMember(),
  ]);

  if (!feast) notFound();

  const { reactions, comments } = await getPhotosInteractions(
    photos.map((p) => p.id),
    session?.user.id ?? null
  );

  return (
    <>
      <GoldHeader
        title="Galería"
        subtitle={`Fiesta de ${feast.bahai_month_name}`}
        backHref={`/fiestas/${feast.id}`}
      />
      <FullGalleryView
        eventType="feast"
        eventId={feast.id}
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
