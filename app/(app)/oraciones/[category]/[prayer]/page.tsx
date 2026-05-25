import { notFound } from "next/navigation";
import { GoldHeader } from "@/components/GoldHeader";
import { requireMember } from "@/lib/auth";
import { findPrayer } from "@/lib/oraciones";
import { SharePrayerButton } from "../../share-button";

export const dynamic = "force-dynamic";

export default async function OracionLecturaPage({
  params,
}: {
  params: { category: string; prayer: string };
}) {
  await requireMember(`/oraciones/${params.category}/${params.prayer}`);

  const found = findPrayer(params.category, params.prayer);
  if (!found) notFound();
  const { category, prayer } = found;

  return (
    <>
      <GoldHeader
        title="Oración"
        subtitle={prayer.section ? `${category.name} · ${prayer.section}` : category.name}
        backHref={`/oraciones/${category.id}`}
      />
      <main className="scroll-area flex-1 px-4 pb-8 pt-4">
        <article className="rounded-2xl bg-card p-5 shadow-card">
          <p className="whitespace-pre-line font-body text-[15.5px] leading-[1.75] text-dark">
            {prayer.body}
          </p>
          {prayer.author && (
            <p className="mt-5 text-right font-display text-[14px] italic text-muted">
              — {prayer.author}
            </p>
          )}
          <div className="mt-5 border-t border-black/[0.06] pt-4">
            <SharePrayerButton
              title={prayer.title}
              body={prayer.body}
              reference={prayer.author ?? ""}
            />
          </div>
        </article>
      </main>
    </>
  );
}
