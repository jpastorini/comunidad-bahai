import { NextResponse } from "next/server";
import { getCalendarEvent } from "@/lib/data";
import { buildIcs } from "@/lib/ics";

/**
 * GET /calendario/:id/ics
 * Sirve el evento como archivo .ics descargable. Los OS abren este
 * mime-type con el calendario nativo (Apple Calendar, Google Calendar,
 * Outlook, etc.) y permiten al usuario añadirlo con un toque.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const event = await getCalendarEvent(params.id);
  if (!event) {
    return new NextResponse("Event not found", { status: 404 });
  }

  const url = new URL(request.url);
  const origin = `${url.protocol}//${url.host}`;
  const ics = buildIcs(event, origin);

  const safeTitle = event.title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase()
    .slice(0, 40);
  const filename = `evento-${safeTitle || event.id}.ics`;

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
