import Link from "next/link";
import type {
  EventPhoto,
  PhotoComment,
  PhotoReactionSummary,
} from "@/lib/types";
import { PhotoGrid } from "./PhotoGrid";
import { PhotoUpload } from "./PhotoUpload";

type Props = {
  eventType: "calendar" | "feast";
  eventId: string;
  photos: EventPhoto[];
  currentUserId: string | null;
  currentUserName?: string | null;
  isAdmin: boolean;
  adminLocalityId: string | null;
  canUpload: boolean;
  reactionsMap?: Record<string, PhotoReactionSummary>;
  commentsMap?: Record<string, PhotoComment[]>;
};

/**
 * Vista full-screen de la galería de un evento. Grid denso estilo
 * red social (3 columnas en móvil, 4-5 en desktop). Click en una
 * foto abre el lightbox con navegación.
 */
export function FullGalleryView({
  eventType,
  eventId,
  photos,
  currentUserId,
  currentUserName = null,
  isAdmin,
  adminLocalityId,
  canUpload,
  reactionsMap,
  commentsMap,
}: Props) {
  const detailHref =
    eventType === "calendar" ? `/calendario/${eventId}` : `/fiestas/${eventId}`;

  return (
    <main className="scroll-area flex-1 px-4 pb-6 pt-3.5">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-[12px] text-muted">
          {photos.length === 0
            ? "Sin fotos todavía"
            : `${photos.length} ${photos.length === 1 ? "foto" : "fotos"}`}
        </p>
        <Link
          href={detailHref}
          className="text-[11.5px] font-semibold text-muted hover:text-terra hover:underline"
        >
          ← Volver al evento
        </Link>
      </div>

      {photos.length === 0 ? (
        <div className="mb-4 rounded-2xl border border-dashed border-black/10 bg-card/50 px-4 py-12 text-center text-[13px] text-muted">
          Aún no hay fotos compartidas.
          {canUpload ? " ¡Sé el primero en subir una!" : ""}
        </div>
      ) : (
        <PhotoGrid
          photos={photos}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          isAdmin={isAdmin}
          adminLocalityId={adminLocalityId}
          variant="full"
          reactionsMap={reactionsMap}
          commentsMap={commentsMap}
        />
      )}

      {canUpload && (
        <div className="mt-6">
          <PhotoUpload eventType={eventType} eventId={eventId} />
        </div>
      )}
    </main>
  );
}
