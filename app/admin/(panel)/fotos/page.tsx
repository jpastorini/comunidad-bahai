import { Banner, DataTable, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { getAdminPhotos, MAX_FEATURED_PER_EVENT, type AdminPhoto } from "@/lib/event-photos";
import { formatMessageDate } from "@/lib/format";
import { deletePhotoAction } from "./actions";
import { PhotoToggles } from "./photo-toggles";

export const revalidate = 60;

export default async function AdminFotosPage() {
  const session = await requireAdmin();
  const photos = await getAdminPhotos(session.locality.id);

  const featuredCount = photos.filter((p) => p.featured).length;
  const nationalCount = photos.filter((p) => p.visibility === "national").length;

  return (
    <>
      <PageHeader
        eyebrow="Asamblea Espiritual Local"
        title="Fotos de la comunidad"
        description={`Fotos que suben los miembros en cada evento. Destacá hasta ${MAX_FEATURED_PER_EVENT} por evento (se muestran en el Inicio) y enviá las mejores al boletín nacional que ven todas las comunidades.`}
      />

      <div className="mb-4">
        <Banner tone="info">
          <strong>{photos.length}</strong> foto{photos.length === 1 ? "" : "s"} ·{" "}
          <strong>{featuredCount}</strong> destacada{featuredCount === 1 ? "" : "s"} ·{" "}
          <strong>{nationalCount}</strong> en el boletín nacional
        </Banner>
      </div>

      <DataTable<AdminPhoto>
        rows={photos}
        rowKey={(p) => p.id}
        empty="Todavía no hay fotos. Aparecerán acá cuando los miembros suban fotos a los eventos."
        columns={[
          {
            key: "thumb",
            label: "Foto",
            width: "84px",
            render: (p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.public_url}
                alt={p.caption ?? ""}
                className="h-14 w-14 rounded-lg object-cover"
                loading="lazy"
              />
            ),
          },
          {
            key: "event",
            label: "Evento",
            render: (p) => (
              <div>
                <div className="font-medium text-dark">{p.event_title}</div>
                {p.event_when && (
                  <div className="mt-0.5 text-[11px] text-muted">{p.event_when}</div>
                )}
                {p.caption && (
                  <div className="mt-0.5 text-[11px] italic text-muted">
                    “{p.caption}”
                  </div>
                )}
              </div>
            ),
          },
          {
            key: "uploader",
            label: "Subió",
            width: "150px",
            render: (p) => (
              <span className="text-[12px] text-muted">{p.uploader_name}</span>
            ),
          },
          {
            key: "date",
            label: "Fecha",
            width: "120px",
            render: (p) => (
              <span className="text-[12px] text-muted">
                {formatMessageDate(p.created_at)}
              </span>
            ),
          },
          {
            key: "curate",
            label: "Curaduría",
            width: "210px",
            render: (p) => (
              <PhotoToggles
                photoId={p.id}
                featured={p.featured}
                national={p.visibility === "national"}
              />
            ),
          },
          {
            key: "actions",
            label: "",
            width: "80px",
            render: (p) => (
              <form action={deletePhotoAction}>
                <input type="hidden" name="id" value={p.id} />
                <button
                  type="submit"
                  className="text-[12px] font-semibold text-rose-600 hover:underline"
                >
                  Borrar
                </button>
              </form>
            ),
          },
        ]}
      />
    </>
  );
}
