import { notFound } from "next/navigation";
import { GoldHeader } from "@/components/GoldHeader";
import { requireMember } from "@/lib/auth";
import { findTopic } from "@/lib/citas";
import { withVolver } from "../back";

export const revalidate = 60;

export default async function CitasTemaPage({
  params,
  searchParams,
}: {
  params: { topic: string };
  searchParams?: { volver?: string };
}) {
  await requireMember(`/citas/${params.topic}`);

  const topic = findTopic(params.topic);
  if (!topic) notFound();

  return (
    <>
      <GoldHeader
        title={topic.name}
        subtitle={`${topic.quotes.length} citas`}
        backHref={withVolver("/citas", searchParams?.volver)}
      />
      <main className="scroll-area flex-1 px-4 pb-8 pt-4">
        <div className="space-y-2.5">
          {topic.quotes.map((cita) => (
            <article
              key={cita.id}
              className="rounded-2xl bg-card p-4 shadow-card-soft"
            >
              <p className="font-body text-[14px] leading-[1.65] text-dark">
                {cita.text}
              </p>
              <div className="mt-2 font-body text-[11px] text-muted">
                — {cita.reference}
              </div>
            </article>
          ))}
        </div>
      </main>
    </>
  );
}
