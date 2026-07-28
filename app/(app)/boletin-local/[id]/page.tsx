import { notFound } from "next/navigation";
import { BulletinView } from "@/components/BulletinView";
import { GoldHeader } from "@/components/GoldHeader";
import { ShareBulletinButton } from "@/components/ShareBulletinButton";
import { requireMember } from "@/lib/auth";
import { getPublishedBulletin } from "@/lib/bulletins";

export const revalidate = 60;

export default async function BoletinLocalDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireMember(`/boletin-local/${params.id}`);
  const bulletin = await getPublishedBulletin(params.id);

  if (!bulletin || bulletin.locality_id !== session.locality.id) {
    notFound();
  }

  return (
    <>
      <GoldHeader
        title="Boletín"
        subtitle={session.locality.name}
        backHref="/boletin-local"
      />
      <main className="scroll-area flex-1 px-3.5 pt-3.5">
        <div className="mb-3 flex justify-end">
          <ShareBulletinButton
            token={bulletin.share_token}
            title={bulletin.title}
          >
            Compartir fuera de la app
          </ShareBulletinButton>
        </div>
        <BulletinView bulletin={bulletin} localityName={session.locality.name} />
      </main>
    </>
  );
}
