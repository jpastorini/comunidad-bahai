import Link from "next/link";
import { GoldHeader } from "@/components/GoldHeader";
import { AEL_SEGMENTS, SegmentedNav } from "@/components/SegmentedNav";
import { requireMember } from "@/lib/auth";
import { getPublishedBulletins } from "@/lib/bulletins";
import { formatDate } from "@/lib/format";

export const revalidate = 60;

export default async function BoletinLocalPage() {
  const session = await requireMember("/boletin-local");
  const bulletins = await getPublishedBulletins(session.locality.id);

  return (
    <>
      <GoldHeader
        title="Asamblea Local"
        subtitle={session.locality.name}
        backHref="/"
      />
      <SegmentedNav items={AEL_SEGMENTS} />
      <main className="scroll-area flex-1 px-4 pb-4 pt-2">
        {bulletins.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-muted">
            La Asamblea todavía no publicó ningún boletín.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {bulletins.map((b, i) => {
              const counts = [
                b.content.events.length > 0 &&
                  `${b.content.events.length} eventos`,
                b.content.announcements.length > 0 &&
                  `${b.content.announcements.length} comunicados`,
                b.content.photos.length > 0 &&
                  `${b.content.photos.length} fotos`,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <Link
                  key={b.id}
                  href={`/boletin-local/${b.id}`}
                  className={
                    i === 0
                      ? "tap overflow-hidden rounded-2xl p-4 shadow-card-elevated ring-1 ring-gold/45"
                      : "tap overflow-hidden rounded-2xl bg-card p-4 shadow-card"
                  }
                  style={
                    i === 0
                      ? {
                          background:
                            "linear-gradient(160deg, #FBF6E4, #FFFDF7)",
                        }
                      : undefined
                  }
                >
                  <div className="text-[10px] font-semibold tracking-[0.3px] text-terra">
                    {b.published_at ? formatDate(b.published_at) : ""}
                  </div>
                  <h2 className="mt-0.5 font-display text-[18px] font-semibold leading-[1.25] text-dark">
                    {b.title}
                  </h2>
                  {b.editorial && (
                    <p className="mt-1 line-clamp-2 font-body text-[12px] leading-[1.5] text-muted">
                      {b.editorial}
                    </p>
                  )}
                  {counts && (
                    <div className="mt-1.5 text-[11px] text-muted">{counts}</div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
