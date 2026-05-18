import Link from "next/link";
import { Button, DataTable, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { deleteEventAction } from "./actions";
import type { CalendarEvent } from "@/lib/types";

export default async function AdminCalendarPage() {
  await requireAdmin();
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("calendar_events")
    .select("*")
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .order("day", { ascending: false });

  const rows = (data ?? []) as CalendarEvent[];

  return (
    <>
      <PageHeader
        eyebrow="Comunidad"
        title="Calendario"
        description="Eventos que se muestran en la vista mensual."
        actions={<Button href="/admin/calendario/nuevo">+ Nuevo evento</Button>}
      />
      <DataTable
        rows={rows}
        rowKey={(e) => e.id}
        empty="Aún no hay eventos en el calendario."
        columns={[
          {
            key: "date",
            label: "Fecha",
            width: "130px",
            render: (e) => (
              <span className="font-medium text-terra">
                {String(e.day).padStart(2, "0")}/{String(e.month).padStart(2, "0")}/{e.year}
              </span>
            ),
          },
          {
            key: "title",
            label: "Evento",
            render: (e) => (
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ background: e.color }}
                />
                <span className="text-[14px] font-semibold text-dark">{e.title}</span>
              </div>
            ),
          },
          {
            key: "time",
            label: "Hora",
            width: "110px",
            render: (e) => <span className="text-[12px] text-muted">{e.time}</span>,
          },
          {
            key: "location",
            label: "Ubicación",
            render: (e) => (
              <span className="text-[12px] text-muted">{e.location ?? "—"}</span>
            ),
          },
          {
            key: "image",
            label: "Imagen",
            width: "80px",
            render: (e) =>
              e.image_url ? (
                <a
                  href={e.image_url}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1 rounded bg-gold/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-gold-dark hover:bg-gold/25"
                >
                  IMG
                </a>
              ) : (
                <span className="text-[11px] text-muted">—</span>
              ),
          },
          {
            key: "actions",
            label: "",
            width: "150px",
            render: (e) => (
              <div className="flex items-center justify-end gap-2">
                <Link
                  href={`/admin/calendario/${e.id}`}
                  className="text-[12px] font-semibold text-terra hover:underline"
                >
                  Editar
                </Link>
                <form action={deleteEventAction}>
                  <input type="hidden" name="id" value={e.id} />
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
