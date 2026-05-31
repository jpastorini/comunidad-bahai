import { GoldHeader } from "@/components/GoldHeader";
import {
  PhotoUploadFlow,
  type PickerEvent,
} from "@/components/gallery/PhotoUploadFlow";
import { requireMember } from "@/lib/auth";
import { getCalendarKind } from "@/lib/calendar-kinds";
import { getUnifiedCalendarItems } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function SubirFotoPage() {
  await requireMember("/");
  const items = await getUnifiedCalendarItems();

  const events: PickerEvent[] = items.map((it) => ({
    key: `${it.source}:${it.id}`,
    eventType: it.source === "feast" ? "feast" : "calendar",
    eventId: it.id,
    title: it.title,
    day: it.day,
    month: it.month,
    year: it.year,
    kindShort: getCalendarKind(it.kind).short,
    color: it.color,
  }));

  return (
    <>
      <GoldHeader
        title="Compartir fotos"
        subtitle="Galería de la comunidad"
        backHref="/"
      />
      <PhotoUploadFlow events={events} />
    </>
  );
}
