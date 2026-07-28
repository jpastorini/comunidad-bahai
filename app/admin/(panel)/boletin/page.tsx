import Link from "next/link";
import { Card, PageHeader } from "@/components/admin/ui";
import { ShareBulletinButton } from "@/components/ShareBulletinButton";
import { requirePanelAccess } from "@/lib/auth";
import { getAdminBulletins } from "@/lib/bulletins";
import { formatDate } from "@/lib/format";
import type { Bulletin } from "@/lib/types";
import { ConfirmSubmit } from "../miembros/confirm-submit";
import { deleteBulletinAction } from "./actions";

export default async function AdminBoletinPage() {
  const session = await requirePanelAccess();
  const bulletins = await getAdminBulletins(session.locality.id);

  const drafts = bulletins.filter((b) => b.status === "draft");
  const published = bulletins.filter((b) => b.status === "published");

  return (
    <>
      <PageHeader
        eyebrow="Comunidad"
        title="Boletín local"
        description="Ediciones que compilan eventos, comunicados y fotos para compartir con la comunidad."
        actions={
          <Link
            href="/admin/boletin/nuevo"
            className="tap rounded-xl bg-terra px-4 py-2 text-[13px] font-semibold text-white shadow-card-soft"
          >
            + Nueva edición
          </Link>
        }
      />

      {bulletins.length === 0 && (
        <Card>
          <p className="py-6 text-center text-[13px] text-muted">
            Todavía no hay boletines. Creá la primera edición: se arma sola
            con los eventos, comunicados y fotos que ya cargaste.
          </p>
        </Card>
      )}

      {drafts.length > 0 && (
        <BulletinGroup title="Borradores" bulletins={drafts} />
      )}
      {published.length > 0 && (
        <BulletinGroup title="Publicados" bulletins={published} />
      )}
    </>
  );
}

function BulletinGroup({
  title,
  bulletins,
}: {
  title: string;
  bulletins: Bulletin[];
}) {
  return (
    <div className="mb-6">
      <h2 className="mb-2.5 flex items-center gap-2 font-display text-[18px] font-semibold text-dark">
        {title}
        <span className="rounded-full bg-black/10 px-2 py-0.5 text-[11px] font-bold text-muted">
          {bulletins.length}
        </span>
      </h2>
      <div className="grid gap-3">
        {bulletins.map((b) => (
          <BulletinCard key={b.id} bulletin={b} />
        ))}
      </div>
    </div>
  );
}

function BulletinCard({ bulletin: b }: { bulletin: Bulletin }) {
  const counts = [
    b.content.events.length > 0 && `${b.content.events.length} eventos`,
    b.content.announcements.length > 0 &&
      `${b.content.announcements.length} comunicados`,
    b.content.photos.length > 0 && `${b.content.photos.length} fotos`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-display text-[16px] font-semibold text-dark">
              {b.title}
            </div>
            {b.status === "published" ? (
              <span className="rounded bg-terra/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-terra">
                Publicado
              </span>
            ) : (
              <span className="rounded bg-black/[0.07] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted">
                Borrador
              </span>
            )}
          </div>
          <div className="mt-1 text-[11.5px] text-muted">
            {b.status === "published" && b.published_at
              ? `Publicado el ${formatDate(b.published_at)}`
              : `Creado el ${formatDate(b.created_at)}`}
            {counts && ` · ${counts}`}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {b.status === "published" && (
            <ShareBulletinButton token={b.share_token} title={b.title} />
          )}
          <Link
            href={`/admin/boletin/${b.id}`}
            className="tap rounded-xl border border-black/10 bg-card px-3.5 py-2 text-[12.5px] font-semibold text-dark hover:bg-bg"
          >
            Editar
          </Link>
          <form action={deleteBulletinAction}>
            <input type="hidden" name="id" value={b.id} />
            <ConfirmSubmit
              message={`¿Borrar "${b.title}"? Esta acción no se puede deshacer.`}
              className="tap rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-[12.5px] font-semibold text-rose-600 hover:bg-rose-100"
            >
              Borrar
            </ConfirmSubmit>
          </form>
        </div>
      </div>
    </Card>
  );
}
