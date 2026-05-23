import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { BahaiStar } from "@/components/BahaiStar";
import type {
  FeedAnnouncement,
  FeedItem,
  FeedPhotoGroup,
} from "@/lib/feed";

type Props = {
  items: FeedItem[];
};

export function HomeFeed({ items }: Props) {
  if (items.length === 0) return null;
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-[13.5px] font-semibold text-dark">
          Actividad reciente
        </h2>
      </div>
      <ul className="flex flex-col gap-2.5">
        {items.map((item) =>
          item.type === "photos" ? (
            <PhotoGroupCard key={item.id} group={item} />
          ) : (
            <AnnouncementCard key={item.id} announcement={item} />
          )
        )}
      </ul>
    </section>
  );
}

function PhotoGroupCard({ group }: { group: FeedPhotoGroup }) {
  const galleryHref =
    group.event_type === "calendar"
      ? `/calendario/${group.event_id}/galeria`
      : `/fiestas/${group.event_id}/galeria`;
  const eventDetailHref =
    group.event_type === "calendar"
      ? `/calendario/${group.event_id}`
      : `/fiestas/${group.event_id}`;

  return (
    <li className="overflow-hidden rounded-2xl bg-card shadow-card">
      <div className="px-4 pt-3.5">
        <div className="flex items-center gap-2.5">
          <Avatar
            url={group.uploader_avatar_url}
            name={group.uploader_name}
            size={36}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-dark">
              {group.uploader_name}
            </div>
            <div className="text-[10.5px] text-muted">
              {formatRelative(group.last_at)}
            </div>
          </div>
        </div>
        <Link
          href={eventDetailHref}
          className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-terra hover:underline"
        >
          {photoCountLabel(group.photo_count)} a {group.event_title}
        </Link>
        {group.event_when && (
          <div className="text-[10.5px] text-muted">{group.event_when}</div>
        )}
      </div>

      <Link href={galleryHref} className="tap mt-2.5 block">
        <PhotoPreviewGrid
          urls={group.preview_urls}
          totalCount={group.photo_count}
        />
      </Link>

      {(group.reaction_total > 0 || group.comment_total > 0) && (
        <Link
          href={galleryHref}
          className="tap flex items-center gap-3 px-4 py-2.5 text-[12px] font-semibold text-muted hover:text-terra"
        >
          {group.reaction_total > 0 && (
            <span className="inline-flex items-center gap-1">
              <span className="text-[13px] leading-none">❤️</span>
              {group.reaction_total}
            </span>
          )}
          {group.comment_total > 0 && (
            <span className="inline-flex items-center gap-1">
              <span className="text-[13px] leading-none">💬</span>
              {group.comment_total}
            </span>
          )}
        </Link>
      )}
    </li>
  );
}

function PhotoPreviewGrid({
  urls,
  totalCount,
}: {
  urls: string[];
  totalCount: number;
}) {
  const remaining = Math.max(0, totalCount - urls.length);
  const n = urls.length;
  if (n === 0) return null;
  if (n === 1) {
    return (
      <div className="aspect-[4/3] w-full bg-bg/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={urls[0]}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }
  const cols = n === 2 ? 2 : n === 3 ? 3 : 2;
  return (
    <div
      className="grid gap-0.5 bg-card"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
      }}
    >
      {urls.map((u, i) => (
        <div key={i} className="relative aspect-square bg-bg/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={u}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
          {i === urls.length - 1 && remaining > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-[15px] font-semibold text-white">
              +{remaining}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AnnouncementCard({ announcement }: { announcement: FeedAnnouncement }) {
  return (
    <li className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-terra to-[#3D56B0] px-4 py-3.5 text-white shadow-card">
      <div className="pointer-events-none absolute -bottom-3 -right-2 opacity-[0.07]">
        <BahaiStar size={70} color="#fff" />
      </div>
      <div className="relative">
        <div className="flex items-center gap-2 text-[9.5px] font-bold uppercase tracking-[1.5px] text-white/65">
          <span>✦ Asamblea Local</span>
          <span className="rounded bg-white/15 px-1.5 py-[1px] text-[8.5px] tracking-wide">
            Oficial
          </span>
          <span className="ml-auto text-[9.5px] font-medium tracking-normal text-white/55 normal-case">
            {formatRelative(announcement.created_at)}
          </span>
        </div>
        <div className="mt-1.5 font-display text-[16px] font-semibold leading-tight">
          {announcement.title}
        </div>
        {announcement.excerpt && (
          <p className="mt-1 font-body text-[11.5px] leading-snug text-white/75">
            {announcement.excerpt}
          </p>
        )}
        <Link
          href="/comunicados"
          className="tap mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-white"
        >
          Leer comunicado →
        </Link>
      </div>
    </li>
  );
}

function photoCountLabel(n: number): string {
  if (n === 1) return "Compartió 1 foto";
  return `Compartió ${n} fotos`;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
  });
}
