import Link from "next/link";
import { GoldHeader } from "@/components/GoldHeader";
import { requireMember } from "@/lib/auth";
import { civilDateLabel, getCitaDelDia, getCitasData } from "@/lib/citas";
import { SharePrayerButton } from "../oraciones/share-button";

export const revalidate = 60;

export default async function CitasPage() {
  await requireMember("/citas");

  const { cita, topic } = getCitaDelDia();
  const data = getCitasData();
  const topics = [...data.topics].sort((a, b) =>
    a.name.localeCompare(b.name, "es")
  );

  return (
    <>
      <GoldHeader
        title="Escritos Sagrados"
        subtitle="Lectura de hoy"
        backHref="/"
      />
      <main className="scroll-area flex-1 px-4 pb-8 pt-4">
        <article className="rounded-2xl bg-card p-5 shadow-card-elevated ring-1 ring-gold/15">
          <div className="mb-3 flex items-baseline justify-between gap-2 text-[9.5px] font-semibold uppercase tracking-[1.5px]">
            <span className="text-gold-dark/70">✦ Lectura de hoy</span>
            <span className="shrink-0 text-muted/70">{civilDateLabel()}</span>
          </div>
          <p className="font-display text-[18px] italic leading-[1.6] text-dark">
            “{cita.text}”
          </p>
          <div className="mt-3 font-body text-[12px] text-muted">
            — {cita.reference}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-black/[0.06] pt-4">
            <SharePrayerButton
              title={topic.name}
              body={cita.text}
              reference={cita.reference}
              label="Compartir cita"
            />
            <Link
              href={`/citas/${topic.id}`}
              className="tap inline-flex items-center rounded-xl border border-black/10 px-3.5 py-2 text-[12px] font-semibold text-dark hover:bg-bg"
            >
              Más sobre {topic.name}
            </Link>
          </div>
        </article>

        <h2 className="mb-2 mt-7 px-1 text-[13px] font-semibold text-dark">
          Por tema
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {topics.map((t) => (
            <Link
              key={t.id}
              href={`/citas/${t.id}`}
              className="tap rounded-full bg-card px-3 py-1.5 text-[12px] font-medium text-dark shadow-card-soft hover:bg-bg"
            >
              {t.name}
              <span className="ml-1.5 text-[10.5px] text-muted">
                {t.quotes.length}
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-6 px-1 font-body text-[10.5px] leading-relaxed text-muted">
          {data.quoteCount} citas de {data.topicCount} temas, tomadas de{" "}
          <a
            href={data.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {data.source}
          </a>
        </p>
      </main>
    </>
  );
}
