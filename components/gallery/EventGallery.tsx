import { getOptionalMember } from "@/lib/auth";
import { getEventPhotos } from "@/lib/event-photos";
import type { EventPhoto } from "@/lib/types";
import { PhotoCard } from "./PhotoCard";
import { PhotoUpload } from "./PhotoUpload";

type Props = {
  eventType: "calendar" | "feast";
  eventId: string;
};

/**
 * Server component que renderiza la galería completa de un evento:
 * grilla de fotos + formulario de subida (si el miembro está logueado).
 *
 * RLS de Supabase filtra automáticamente a la localidad del usuario.
 * Si no hay sesión, no se muestra el form de subida (los miembros
 * anónimos solo ven las fotos del evento si tienen acceso).
 */
export async function EventGallery({ eventType, eventId }: Props) {
  const [photos, session] = await Promise.all([
    getEventPhotos(eventType, eventId),
    getOptionalMember(),
  ]);

  const canDelete = (photo: EventPhoto): boolean => {
    if (!session) return false;
    if (photo.uploader_user_id === session.user.id) return true;
    if (
      session.profile.role === "admin" &&
      photo.locality_id === session.locality?.id
    ) {
      return true;
    }
    return false;
  };

  return (
    <section className="mb-5 mt-2">
      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 className="text-[13px] font-semibold text-dark">
          Galería{" "}
          {photos.length > 0 && (
            <span className="ml-1 text-[11px] font-normal text-muted">
              · {photos.length}{" "}
              {photos.length === 1 ? "foto" : "fotos"}
            </span>
          )}
        </h2>
      </div>

      {photos.length === 0 ? (
        <div className="mb-3 rounded-2xl border border-dashed border-black/10 bg-card/50 px-4 py-6 text-center text-[12.5px] text-muted">
          Aún no hay fotos compartidas.
          {session ? " ¡Sé el primero!" : ""}
        </div>
      ) : (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((p) => (
            <PhotoCard key={p.id} photo={p} canDelete={canDelete(p)} />
          ))}
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
