import Link from "next/link";
import { getOptionalMember } from "@/lib/auth";
import { getEventPhotos } from "@/lib/event-photos";
import { getPhotosInteractions } from "@/lib/photo-interactions";
import { PhotoGrid } from "./PhotoGrid";
import { PhotoUpload } from "./PhotoUpload";

type Props = {
  eventType: "calendar" | "feast";
  eventId: string;
};

const PREVIEW_LIMIT = 6;

/**
 * Server component que renderiza la galería embebida en el detalle
 * del evento: preview de las primeras N fotos (con CTA a la galería
 * completa si hay más) + formulario de subida.
 */
export async function EventGallery({ eventType, eventId }: Props) {
  const [allPhotos, session] = await Promise.all([
    getEventPhotos(eventType, eventId),
    getOptionalMember(),
  ]);

  const previewPhotos = allPhotos.slice(0, PREVIEW_LIMIT);
  const { reactions, comments } = await getPhotosInteractions(
    previewPhotos.map((p) => p.id),
    session?.user.id ?? null
  );
  const remaining = Math.max(0, allPhotos.length - PREVIEW_LIMIT);
  const fullHref =
    eventType === "calendar"
      ? `/calendario/${eventId}/galeria`
      : `/fiestas/${eventId}/galeria`;

  return (
    <section className="mb-5 mt-2">
      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 className="text-[13px] font-semibold text-dark">
          Galería
          {allPhotos.length > 0 && (
            <span className="ml-1 text-[11px] font-normal text-muted">
              · {allPhotos.length}{" "}
              {allPhotos.length === 1 ? "foto" : "fotos"}
            </span>
          )}
        </h2>
        {allPhotos.length > 0 && (
          <Link
            href={fullHref}
            className="text-[11.5px] font-semibold text-terra hover:underline"
          >
            Ver todas →
          </Link>
        )}
      </div>

      {allPhotos.length === 0 ? (
        <div className="mb-3 rounded-2xl border border-dashed border-black/10 bg-card/50 px-4 py-6 text-center text-[12.5px] text-muted">
          Aún no hay fotos compartidas.
          {session ? " ¡Sé el primero!" : ""}
        </div>
      ) : (
        <div className="mb-4">
          <PhotoGrid
            photos={previewPhotos}
            currentUserId={session?.user.id ?? null}
            currentUserName={session?.profile.full_name ?? null}
            isAdmin={session?.profile.role === "admin"}
            adminLocalityId={session?.locality?.id ?? null}
            variant="compact"
            reactionsMap={reactions}
            commentsMap={comments}
          />
          {remaining > 0 && (
            <Link
              href={fullHref}
              className="tap mt-2 flex items-center justify-center gap-1 rounded-xl border border-terra/20 bg-terra/[0.05] px-4 py-2 text-[12px] font-semibold text-terra hover:bg-terra/10"
            >
              Ver galería completa ({allPhotos.length} fotos) →
            </Link>
          )}
        </div>
      )}

      {session ? (
        <PhotoUpload eventType={eventType} eventId={eventId} />
      ) : (
        <div className="rounded-xl bg-card px-4 py-3 text-center text-[12px] text-muted shadow-card-soft">
          <a
            href={`/login?next=${encodeURIComponent(
              eventType === "calendar"
                ? `/calendario/${eventId}`
                : `/fiestas/${eventId}`
            )}`}
            className="font-semibold text-terra hover:underline"
          >
            Iniciá sesión
          </a>{" "}
          para compartir fotos de este evento.
        </div>
      )}
    </section>
  );
}
