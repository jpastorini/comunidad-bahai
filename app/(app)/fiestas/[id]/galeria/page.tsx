import { notFound } from "next/navigation";
import { FullGalleryView } from "@/components/gallery/FullGalleryView";
import { GoldHeader } from "@/components/GoldHeader";
import { getOptionalMember } from "@/lib/auth";
import { getFeast } from "@/lib/data";
import { getEventPhotos } from "@/lib/event-photos";

export const dynamic = "force-dynamic";

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
        isAdmin={session?.profile.role === "admin"}
        adminLocalityId={session?.locality?.id ?? null}
        canUpload={!!session}
      />
    </>
  );
}
