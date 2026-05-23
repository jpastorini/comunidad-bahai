import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { FeaturedMessageCard } from "@/components/home/FeaturedMessageCard";
import { GoldHeader } from "@/components/GoldHeader";
import { SectionGrid } from "@/components/home/SectionGrid";
import { UpcomingEvents } from "@/components/home/UpcomingEvents";
import { requireMember } from "@/lib/auth";
import {
  getBadges,
  getLatestLocalAnnouncement,
  getUpcomingCalendarEvents,
} from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await requireMember("/");
  const [featured, upcoming, badges] = await Promise.all([
    getLatestLocalAnnouncement(),
    getUpcomingCalendarEvents(2),
    getBadges(session.user.id),
  ]);

  return (
    <>
      <GoldHeader
        title={session.locality.name}
        subtitle="Centro de Comunicados"
        rightSlot={
          <Link href="/perfil" aria-label="Mi perfil" className="tap inline-flex">
            <Avatar
              url={session.profile.avatar_url}
              name={session.profile.full_name}
              size={38}
            />
          </Link>
        }
        starSize={130}
      />
      <main className="scroll-area flex-1 px-3.5 pt-3">
        {featured && (
          <FeaturedMessageCard
            eyebrow="✦ Asamblea Local"
            title={featured.title}
            excerpt={featured.excerpt}
            ctaLabel="Leer comunicado"
            href="/comunicados"
          />
        )}
        <SectionGrid badges={badges} />
        <UpcomingEvents events={upcoming} />
      </main>
    </>
  );
}
