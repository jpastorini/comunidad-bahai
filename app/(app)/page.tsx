import { FeaturedMessageCard } from "@/components/home/FeaturedMessageCard";
import { GoldHeader } from "@/components/GoldHeader";
import { SectionGrid } from "@/components/home/SectionGrid";
import { UpcomingActivities } from "@/components/home/UpcomingActivities";
import {
  getBadges,
  getLatestLocalAnnouncement,
  getUpcomingActivities,
} from "@/lib/data";
import { formatLongDate } from "@/lib/format";

export default async function HomePage() {
  const [featured, upcoming, badges] = await Promise.all([
    getLatestLocalAnnouncement(),
    getUpcomingActivities(2),
    getBadges(),
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
        <UpcomingActivities activities={upcoming} />
      </main>
    </>
  );
}
