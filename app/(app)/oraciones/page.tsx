import Link from "next/link";
import { GoldHeader } from "@/components/GoldHeader";
import { IconChevronRight } from "@/components/Icons";
import { requireMember } from "@/lib/auth";
import { PRAYER_POOL, type PoolPrayer } from "@/lib/feast-prayer-pool";

export const dynamic = "force-dynamic";

// Orden de presentación por autor (Manifestación / Centro de la Alianza).
const AUTHOR_ORDER: PoolPrayer["reference"][] = [
  "Bahá'u'lláh",
  "el Báb",
  "ʻAbdu'l-Bahá",
];

function excerpt(body: string, max = 90): string {
  const clean = body.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
}

export default async function OracionesPage() {
  const session = await requireMember("/oraciones");

  const groups = AUTHOR_ORDER.map((author) => ({
    author,
    prayers: PRAYER_POOL.filter((p) => p.reference === author),
  })).filter((g) => g.prayers.length > 0);

  return (
    <>
      <GoldHeader
        title="Oraciones"
        subtitle={session.locality.name}
        backHref="/"
      />
      <main className="scroll-area flex-1 px-4 pb-6 pt-4">
        <p className="mb-4 font-body text-[12.5px] leading-relaxed text-muted">
          Una selección de oraciones reveladas por Bahá'u'lláh, el Báb y
          ʻAbdu'l-Bahá. Tocá una para leerla y compartirla.
        </p>

        {groups.map((group) => (
          <section key={group.author} className="mb-5">
            <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {group.author}
            </h2>
            <div className="flex flex-col gap-2">
              {group.prayers.map((prayer) => (
                <Link
                  key={prayer.sourceId}
                  href={`/oraciones/${prayer.sourceId}`}
                  className="tap flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-card-soft"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold text-dark">
                      {prayer.title}
                    </div>
                    <div className="mt-0.5 truncate font-body text-[11.5px] text-muted">
                      {excerpt(prayer.body)}
                    </div>
                  </div>
                  <IconChevronRight size={14} className="shrink-0 text-muted" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
