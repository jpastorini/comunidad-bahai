import Link from "next/link";
import type { FeaturedPhoto } from "@/lib/event-photos";

export function FeaturedPhotos({ photos }: { photos: FeaturedPhoto[] }) {
  if (photos.length === 0) return null;
  return (
    <section className="mb-5">
      <h2 className="mb-2 px-1 text-[13.5px] font-semibold text-dark">
        Fotos destacadas
      </h2>
      <div className="-mx-3.5 flex gap-2.5 overflow-x-auto px-3.5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {photos.map((p) => (
          <Link
            key={p.id}
            href={galleryHref(p)}
            className="tap group relative w-[140px] shrink-0 overflow-hidden rounded-2xl bg-bg/40 shadow-card"
          >
            <div className="aspect-[4/5] w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.public_url}
                alt={p.caption ?? p.event_title}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-2.5 pb-2 pt-6">
              <div className="truncate text-[11px] font-semibold text-white">
                {p.event_title}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function galleryHref(p: FeaturedPhoto): string {
  return p.event_type === "calendar"
    ? `/calendario/${p.event_id}/galeria`
    : `/fiestas/${p.event_id}/galeria`;
}
