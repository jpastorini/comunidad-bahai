import Link from "next/link";
import { Banner, Button, DataTable, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { getLocalityPushReach } from "@/lib/push";
import { createSupabaseServer } from "@/lib/supabase/server";
import { formatMessageDate } from "@/lib/format";
import type { Message } from "@/lib/types";
import { deleteComunicadoAction } from "./actions";

export default async function AdminComunicadosPage() {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();
  const [{ data }, pushReach] = await Promise.all([
    supabase
      .from("messages")
      .select("*")
      .eq("source", "asamblea_local")
      .order("date", { ascending: false }),
    getLocalityPushReach(session.locality.id),
  ]);

  const rows = (data ?? []) as Message[];

  return (
    <>
      <PageHeader
        eyebrow="Asamblea Espiritual Local"
        title="Comunicados"
        description="Comunicados de la Asamblea Local con texto, imagen de invitación y PDF adjunto."
        actions={
          <Button href="/admin/comunicados/nuevo">+ Nuevo comunicado</Button>
        }
      />

      <div className="mb-4">
        <Banner tone="info">
          {pushReach.total === 0 ? (
            "Aún no hay miembros en la comunidad."
          ) : pushReach.withPush === 0 ? (
            <>
              Al publicar, la notificación push <strong>no llega a nadie</strong>{" "}
              todavía: ninguno de los {pushReach.total} miembros activó las
              notificaciones.
            </>
          ) : (
            <>
              Al publicar, la notificación push llega a{" "}
              <strong>
                {pushReach.withPush} de {pushReach.total}
              </strong>{" "}
              miembros con notificaciones activas.
            </>
          )}
        </Banner>
      </div>

      <DataTable
        rows={rows}
        rowKey={(m) => m.id}
        empty="Aún no hay comunicados publicados."
        columns={[
          {
            key: "date",
            label: "Fecha",
            width: "130px",
            render: (m) => (
              <span className="font-medium text-terra">
                {formatMessageDate(m.date)}
              </span>
            ),
          },
          {
            key: "title",
            label: "Comunicado",
            render: (m) => (
              <div>
                <div className="font-display text-[15px] font-semibold text-dark">
                  {m.title}
                </div>
                {m.subject && (
                  <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-amber">
                    {m.subject}
                  </div>
                )}
                <div className="mt-0.5 line-clamp-1 text-[12px] text-muted">
                  {m.excerpt}
                </div>
              </div>
            ),
          },
          {
            key: "attachments",
            label: "Adjuntos",
            width: "110px",
            render: (m) => {
              const tags: string[] = [];
              if (m.image_url) tags.push("IMG");
              if (m.pdf_url) tags.push("PDF");
              return tags.length === 0 ? (
                <span className="text-[11px] text-muted">—</span>
              ) : (
                <div className="flex gap-1">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="rounded bg-gold/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-gold-dark"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              );
            },
          },
          {
            key: "new",
            label: "Nuevo",
            width: "70px",
            render: (m) =>
              m.is_new ? (
                <span className="rounded bg-terra px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                  Sí
                </span>
              ) : (
                <span className="text-[11px] text-muted">—</span>
              ),
          },
          {
            key: "actions",
            label: "",
            width: "150px",
            render: (m) => (
              <div className="flex items-center justify-end gap-2">
                <Link
                  href={`/admin/comunicados/${m.id}`}
                  className="text-[12px] font-semibold text-terra hover:underline"
                >
                  Editar
                </Link>
                <form action={deleteComunicadoAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <button
                    type="submit"
                    className="text-[12px] font-semibold text-rose-600 hover:underline"
                  >
                    Borrar
                  </button>
                </form>
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
