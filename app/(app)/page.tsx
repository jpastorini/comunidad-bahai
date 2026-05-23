import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { FeaturedMessageCard } from "@/components/home/FeaturedMessageCard";
import { HomeFeed } from "@/components/home/HomeFeed";
import { GoldHeader } from "@/components/GoldHeader";
import { NotificationBell } from "@/components/NotificationBell";
import { SectionGrid } from "@/components/home/SectionGrid";
import { UpcomingEvents } from "@/components/home/UpcomingEvents";
import { requireMember } from "@/lib/auth";
import {
  getBadges,
  getLatestLocalAnnouncement,
  getUpcomingCalendarEvents,
} from "@/lib/data";
import { getHomeFeed } from "@/lib/feed";
import { getUnreadNotificationCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await requireMember("/");
  const [featured, upcoming, badges, unreadNotifs, feed] = await Promise.all([
    getLatestLocalAnnouncement(),
    getUpcomingCalendarEvents(2),
    getBadges(session.user.id),
    getUnreadNotificationCount(session.user.id),
    getHomeFeed(10),
  ]);

  return (
    <>
      <GoldHeader
        title={session.locality.name}
        subtitle="Centro de Comunicados"
        rightSlot={
          <span className="inline-flex items-center gap-1">
            <NotificationBell unreadCount={unreadNotifs} />
            <Link href="/perfil" aria-label="Mi perfil" className="tap inline-flex">
              <Avatar
                url={session.profile.avatar_url}
                name={session.profile.full_name}
                size={38}
              />
            </Link>
          </span>
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
        <HomeFeed items={feed} />
      </main>
    </>
  );
}
