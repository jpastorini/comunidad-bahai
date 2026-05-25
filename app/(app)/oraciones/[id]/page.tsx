import { notFound } from "next/navigation";
import { GoldHeader } from "@/components/GoldHeader";
import { requireMember } from "@/lib/auth";
import { PRAYER_POOL } from "@/lib/feast-prayer-pool";
import { SharePrayerButton } from "../share-button";

export const dynamic = "force-dynamic";

export default async function OracionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireMember(`/oraciones/${params.id}`);

  const prayer = PRAYER_POOL.find((p) => p.sourceId === params.id);
  if (!prayer) notFound();

  return (
    <>
      <GoldHeader
        title="Oración"
        subtitle={prayer.reference}
        backHref="/oraciones"
      />
      <main className="scroll-area flex-1 px-4 pb-8 pt-4">
        <article className="rounded-2xl bg-card p-5 shadow-card">
          <h1 className="font-display text-[22px] font-semibold leading-tight text-dark">
            {prayer.title}
          </h1>
          <p className="mt-4 whitespace-pre-line font-body text-[15px] leading-[1.7] text-dark">
            {prayer.body}
          </p>
          <p className="mt-5 text-right font-display text-[14px] italic text-muted">
            — {prayer.reference}
          </p>
          <div className="mt-5 border-t border-black/[0.06] pt-4">
            <SharePrayerButton
              title={prayer.title}
              body={prayer.body}
              reference={prayer.reference}
            />
          </div>
        </article>
      </main>
    </>
  );
}
