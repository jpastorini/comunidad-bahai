import { ChatDutyCard } from "@/components/home/ChatDutyCard";
import { CitaDelDiaCard } from "@/components/home/CitaDelDiaCard";
import { FeaturedMessageCard } from "@/components/home/FeaturedMessageCard";
import { FeaturedPhotos } from "@/components/home/FeaturedPhotos";
import { HomeFeed } from "@/components/home/HomeFeed";
import { GoldHeader } from "@/components/GoldHeader";
import { SectionGrid } from "@/components/home/SectionGrid";
import { UpcomingEvents } from "@/components/home/UpcomingEvents";
import { requireMember } from "@/lib/auth";
import {
  getBadges,
  getChatDuty,
  getLatestLocalAnnouncement,
  getUpcomingCalendarEvents,
} from "@/lib/data";
import { civilDateLabel, getCitaDelDia } from "@/lib/citas";
import { getFeaturedPhotos } from "@/lib/event-photos";
import { getHomeFeed } from "@/lib/feed";

export const revalidate = 60;

export default async function HomePage() {
  const session = await requireMember("/");
  const [featured, upcoming, badges, feed, featuredPhotos, chatDuty] =
    await Promise.all([
      getLatestLocalAnnouncement(),
      getUpcomingCalendarEvents(2),
      getBadges(session.user.id),
      getHomeFeed(10),
      getFeaturedPhotos(session.locality.id),
      // Solo consulta si la persona atiende algún canal; para la
      // comunidad no agrega ninguna ida a Supabase.
      getChatDuty(session.profile),
    ]);

  // Cita del día: determinística por fecha, sin consulta a la base.
  const citaDelDia = getCitaDelDia();

  return (
    <>
      <GoldHeader
        title={session.locality.name}
        subtitle="Centro de Comunicados"
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
        <CitaDelDiaCard
          cita={citaDelDia.cita}
          topic={citaDelDia.topic}
          dateLabel={civilDateLabel()}
        />
        <SectionGrid badges={badges} isBahai={session.profile.is_bahai} />
        <ChatDutyCard duties={chatDuty} />
        <UpcomingEvents events={upcoming} />
        <FeaturedPhotos photos={featuredPhotos} />
        <HomeFeed items={feed} />
      </main>
    </>
  );
}
