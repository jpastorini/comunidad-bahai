import { GoldHeader } from "@/components/GoldHeader";
import { requireMember } from "@/lib/auth";
import { getNationalBulletinPhotos } from "@/lib/event-photos";
import { formatMessageDate } from "@/lib/format";

export const revalidate = 60;

export default async function BoletinPage() {
  await requireMember("/boletin");
  const photos = await getNationalBulletinPhotos();

  return (
    <>
      <GoldHeader
        title="Boletín Nacional"
        subtitle="Fotos de las comunidades del país"
        backHref="/"
      />
      <main className="scroll-area flex-1 px-3.5 pt-3.5">
        {photos.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-muted">
            Todavía no hay fotos en el boletín nacional. Cuando una Asamblea
            destaque fotos para el boletín, van a aparecer acá.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 pb-4">
            {photos.map((p) => (
              <article
                key={p.id}
                className="overflow-hidden rounded-2xl bg-card shadow-card"
              >
                <div className="aspect-square w-full bg-bg/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.public_url}
                    alt={p.caption ?? p.event_title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="px-3 py-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.5px] text-gold-dark">
                    {p.locality_name}
                  </div>
                  <div className="mt-0.5 truncate text-[12.5px] font-semibold text-dark">
                    {p.event_title}
                  </div>
                  {p.caption && (
                    <p className="mt-0.5 line-clamp-2 text-[11px] italic text-muted">
                      “{p.caption}”
                    </p>
                  )}
                  <div className="mt-1 text-[10.5px] text-muted">
                    {p.uploader_name} · {formatMessageDate(p.created_at)}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
