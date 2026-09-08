import { GoldHeader } from "@/components/GoldHeader";
import { BIBLIOTECA_SEGMENTS, SegmentedNav } from "@/components/SegmentedNav";
import { requireMember } from "@/lib/auth";
import { SearchClient } from "./search-client";

export default async function BuscarPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const session = await requireMember("/buscar");
  const initialQuery = (searchParams?.q ?? "").slice(0, 200);

  return (
    <>
      <GoldHeader title="Biblioteca" subtitle={session.locality.name} backHref="/" />
      {/* El cuadro va arriba de los segmentos, en el mismo lugar que en
          Mensajes y Materiales: la Biblioteca se busca desde ahí. */}
      <SearchClient
        initialQuery={initialQuery}
        nav={<SegmentedNav items={BIBLIOTECA_SEGMENTS} />}
      />
    </>
  );
}
