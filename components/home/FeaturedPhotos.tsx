import Link from "next/link";
import type { FeaturedPhoto } from "@/lib/event-photos";
import { IconGaleria } from "../Icons";

export function FeaturedPhotos({ photos }: { photos: FeaturedPhoto[] }) {
  // Sin destacadas locales, igual ofrecemos la entrada al boletín nacional
  // (una galería distinta que vive más allá de la localidad).
  if (photos.length === 0) {
    return (
      <section className="mb-5">
        <Link
          href="/boletin"
          className="tap flex items-center gap-3 rounded-2xl bg-card px-3.5 py-3 shadow-card"
        >
          <div
            className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[13px]"
            style={{ background: "#B0506B12", color: "#B0506B" }}
          >
            <IconGaleria size={21} />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-dark">
              Boletín Nacional
            </div>
            <div className="truncate text-[11.5px] text-muted">
              Fotos de las comunidades del país
            </div>
          </div>
          <span className="ml-auto text-[15px] text-muted">→</span>
        </Link>
      </section>
    );
  }

  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-[13.5px] font-semibold text-dark">
          Fotos destacadas
        </h2>
        <Link
          href="/boletin"
          className="tap inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/[0.07] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.6px] text-gold-dark"
        >
          Boletín nacional →
        </Link>
      </div>
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
