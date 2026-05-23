import Link from "next/link";
import { PhotoGrid } from "@/components/gallery/PhotoGrid";
import type { EventPhoto } from "@/lib/types";

type Props = {
  photos: EventPhoto[];
  eventTitles: Map<string, string>;
  currentUserId: string;
  isAdmin: boolean;
  adminLocalityId: string;
};

export function MyPhotosSection({
  photos,
  eventTitles,
  currentUserId,
  isAdmin,
  adminLocalityId,
}: Props) {
  if (photos.length === 0) {
    return (
      <section>
        <h3 className="mb-2.5 text-[13px] font-semibold text-dark">
          Mis fotos compartidas
        </h3>
        <div className="rounded-2xl border border-dashed border-black/10 bg-card/50 px-4 py-6 text-center text-[12.5px] text-muted">
          Todavía no compartiste ninguna foto en los eventos.
        </div>
      </section>
    );
  }

  // Agrupar por evento para mostrarlas como secciones chicas.
  type Group = {
    key: string;
    href: string;
    title: string;
    photos: EventPhoto[];
  };
  const groups = new Map<string, Group>();
  for (const p of photos) {
    const key = `${p.event_type}:${p.event_id}`;
    if (!groups.has(key)) {
      const title = eventTitles.get(key) ?? "Evento";
      const href =
        p.event_type === "calendar"
          ? `/calendario/${p.event_id}/galeria`
          : `/fiestas/${p.event_id}/galeria`;
      groups.set(key, { key, href, title, photos: [] });
    }
    groups.get(key)!.photos.push(p);
  }
  const groupList = [...groups.values()];

  return (
    <section>
      <h3 className="mb-2.5 text-[13px] font-semibold text-dark">
        Mis fotos compartidas{" "}
        <span className="ml-1 text-[11px] font-normal text-muted">
          · {photos.length}
        </span>
      </h3>
      <div className="flex flex-col gap-4">
        {groupList.map((g) => (
          <div key={g.key}>
            <div className="mb-1.5 flex items-baseline justify-between">
              <Link
                href={g.href}
                className="text-[12.5px] font-semibold text-dark hover:text-terra hover:underline"
              >
                {g.title}
              </Link>
              <span className="text-[10.5px] text-muted">
                {g.photos.length}{" "}
                {g.photos.length === 1 ? "foto" : "fotos"}
              </span>
            </div>
            <PhotoGrid
              photos={g.photos}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              adminLocalityId={adminLocalityId}
              variant="compact"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
