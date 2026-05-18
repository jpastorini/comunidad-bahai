import Link from "next/link";
import { Button, DataTable, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { deleteNeedAction } from "./actions";

const URGENCY_COLOR: Record<string, string> = {
  alta: "#2A3F8F",
  media: "#7E44B8",
  baja: "#C4A235",
};

type Row = {
  id: string;
  title: string;
  description: string;
  urgency: "alta" | "media" | "baja";
  volunteer_count: number;
};

export default async function AdminServicioPage() {
  await requireAdmin();
  const supabase = createSupabaseServer();

  const { data: needs } = await supabase
    .from("service_needs")
    .select("id, title, description, urgency")
    .order("created_at", { ascending: false });

  // Volunteer counts (one query, grouped client-side).
  const ids = (needs ?? []).map((n) => n.id);
  const { data: vols } = ids.length
    ? await supabase
        .from("service_volunteers")
        .select("need_id")
        .in("need_id", ids)
    : { data: [] as { need_id: string }[] };

  const counts = new Map<string, number>();
  for (const v of vols ?? []) {
    counts.set(v.need_id, (counts.get(v.need_id) ?? 0) + 1);
  }

  const rows: Row[] = (needs ?? []).map((n) => ({
    ...n,
    urgency: n.urgency as Row["urgency"],
    volunteer_count: counts.get(n.id) ?? 0,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Servicio"
        title="Necesidades de la comunidad"
        description="Publica oportunidades para que los miembros se ofrezcan como voluntarios."
        actions={<Button href="/admin/servicio/nueva">+ Nueva necesidad</Button>}
      />

      <DataTable
        rows={rows}
        rowKey={(n) => n.id}
        empty="No hay necesidades publicadas."
        columns={[
          {
            key: "title",
            label: "Necesidad",
            render: (n) => (
              <div>
                <div className="text-[14px] font-semibold text-dark">{n.title}</div>
                <div className="line-clamp-1 text-[12px] text-muted">
                  {n.description}
                </div>
              </div>
            ),
          },
          {
            key: "urgency",
            label: "Urgencia",
            width: "100px",
            render: (n) => (
              <span
                className="rounded px-2 py-0.5 text-[10px] font-bold uppercase"
                style={{
                  background: `${URGENCY_COLOR[n.urgency]}15`,
                  color: URGENCY_COLOR[n.urgency],
                }}
              >
                {n.urgency}
              </span>
            ),
          },
          {
            key: "volunteers",
            label: "Voluntarios",
            width: "130px",
            render: (n) => (
              <Link
                href={`/admin/servicio/${n.id}/voluntarios`}
                className="text-[12px] font-semibold text-terra hover:underline"
              >
                {n.volunteer_count} {n.volunteer_count === 1 ? "miembro" : "miembros"}
              </Link>
            ),
          },
          {
            key: "actions",
            label: "",
            width: "150px",
            render: (n) => (
              <div className="flex items-center justify-end gap-2">
                <Link
                  href={`/admin/servicio/${n.id}`}
                  className="text-[12px] font-semibold text-terra hover:underline"
                >
                  Editar
                </Link>
                <form action={deleteNeedAction}>
                  <input type="hidden" name="id" value={n.id} />
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
