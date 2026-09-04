import { notFound } from "next/navigation";
import { GoldHeader } from "@/components/GoldHeader";
import { requireMember } from "@/lib/auth";
import { getMessage } from "@/lib/data";
import { formatMessageDate } from "@/lib/format";
import { MessageReader } from "./reader";

export const revalidate = 60;

export default async function MensajePage({
  params,
}: {
  params: { id: string };
}) {
  const [, message] = await Promise.all([
    requireMember(`/mensajes/${params.id}`),
    getMessage(params.id),
  ]);
  if (!message) notFound();

  return (
    <>
      <GoldHeader
        title="Casa Universal de Justicia"
        subtitle={formatMessageDate(message.date)}
        backHref="/mensajes"
        backLabel="Mensajes"
      />
      <main className="scroll-area flex-1 px-4 pb-8 pt-4">
        <MessageReader message={message} />
      </main>
    </>
  );
}
