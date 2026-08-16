import { notFound } from "next/navigation";
import { DevotionalToggle } from "@/components/DevotionalToggle";
import { GoldHeader } from "@/components/GoldHeader";
import { requireMember } from "@/lib/auth";
import { findPrayer } from "@/lib/oraciones";
import { PrayerReader } from "../../prayer-reader";
import { SharePrayerButton } from "../../share-button";

export const revalidate = 60;

/** La oración obligatoria corta: la única que ofrece el recordatorio diario
 *  de las 13:00, porque es la que se reza entre el mediodía y la puesta del
 *  sol (ver supabase/migrations/038_devotional_reminders.sql). */
const SHORT_OBLIGATORY_CATEGORY = "oracion-obligatoria-corta";

export default async function OracionLecturaPage({
  params,
}: {
  params: { category: string; prayer: string };
}) {
  const session = await requireMember(
    `/oraciones/${params.category}/${params.prayer}`
  );

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
          <PrayerReader body={prayer.body} author={prayer.author} />
          <div className="mt-5 border-t border-black/[0.06] pt-4">
            <SharePrayerButton
              title={prayer.title}
              body={prayer.body}
              reference={prayer.author ?? ""}
            />
          </div>
        </article>

        {category.id === SHORT_OBLIGATORY_CATEGORY && (
          <div className="mt-3 rounded-2xl bg-card p-4 shadow-card-soft">
            <div className="mb-2.5 text-[12.5px] leading-relaxed text-muted">
              La oración obligatoria corta se reza una vez al día, entre el
              mediodía y la puesta del sol.
            </div>
            <DevotionalToggle
              variant="button"
              pref="prayer_reminder_enabled"
              initialEnabled={session.profile.prayer_reminder_enabled ?? false}
              title="Recordatorio de la Oración Obligatoria"
              description="Un aviso todos los días a las 13:00."
              callToAction="Recordármelo a las 13:00"
              enabledLabel="Te avisamos a las 13:00"
            />
          </div>
        )}
      </main>
    </>
  );
}
