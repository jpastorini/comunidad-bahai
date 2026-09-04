import { notFound } from "next/navigation";
import { GoldHeader } from "@/components/GoldHeader";
import { requireMember } from "@/lib/auth";
import { findTopic } from "@/lib/citas";
import { withVolver } from "../back";
import { QuotesReader } from "./quotes-reader";

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
        <QuotesReader quotes={topic.quotes} />
      </main>
    </>
  );
}
