import { FeaturedMessageCard } from "@/components/home/FeaturedMessageCard";
import { GoldHeader } from "@/components/GoldHeader";
import { SectionGrid } from "@/components/home/SectionGrid";
import { UpcomingEvents } from "@/components/home/UpcomingEvents";
import { getOptionalMember } from "@/lib/auth";
import {
  getBadges,
  getLatestLocalAnnouncement,
  getUpcomingCalendarEvents,
} from "@/lib/data";
import { formatLongDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getOptionalMember();
  const [featured, upcoming, badges] = await Promise.all([
    getLatestLocalAnnouncement(),
    getUpcomingCalendarEvents(2),
    getBadges(session?.user.id ?? null),
  ]);

  return (
    <>
      <GoldHeader
        title="Comunidad Bahá'í"
        subtitle="Centro de Comunicados"
        rightSlot={formatLongDate(new Date())}
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
