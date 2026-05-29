import Link from "next/link";
import { Banner, Button, DataTable, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  PRIORITY_META,
  STATUS_META,
  STATUS_ORDER,
  type AssemblyTask,
} from "@/lib/tasks";
import { deleteTaskAction } from "./actions";
import { StatusControl } from "./status-control";

export default async function AdminTareasPage() {
  await requireAdmin();
  const supabase = createSupabaseServer();

  const { data } = await supabase
    .from("assembly_tasks")
    .select("*, acta:assembly_actas(title, meeting_date)")
    .eq("scope", "local")
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as AssemblyTask[];

  // Orden de tablero: por hacer → en progreso → hecha; dentro, por fecha
  // límite (las sin fecha al final).
  const statusRank = (s: AssemblyTask["status"]) => STATUS_ORDER.indexOf(s);
  const sorted = [...rows].sort((a, b) => {
    if (a.status !== b.status) return statusRank(a.status) - statusRank(b.status);
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return 0;
  });

  const counts = STATUS_ORDER.map((s) => ({
    status: s,
    n: rows.filter((r) => r.status === s).length,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Asamblea Espiritual Local"
        title="Tareas de la Asamblea"
        description="Tablero interno de la Asamblea para listar las tareas que salen de la consulta y seguir su avance. Privado: solo lo ven los miembros de la Asamblea."
        actions={<Button href="/admin/tareas/nueva">+ Nueva tarea</Button>}
      />

      <div className="mb-4">
        <Banner tone="info">
          {counts.map((c, i) => (
            <span key={c.status}>
              {i > 0 && " · "}
              <strong>{c.n}</strong> {STATUS_META[c.status].label.toLowerCase()}
            </span>
          ))}
        </Banner>
      </div>

      <DataTable
        rows={sorted}
        rowKey={(t) => t.id}
        empty="Todavía no hay tareas. Creá la primera con “+ Nueva tarea”."
        columns={[
          {
            key: "description",
            label: "Tarea",
            render: (t) => (
              <div>
                <div className="font-medium text-dark">{t.description}</div>
                {t.acta?.title && (
                  <div className="mt-0.5 text-[11px] text-muted">
                    De: {t.acta.title}
                  </div>
                )}
              </div>
            ),
          },
          {
            key: "assignee",
            label: "Responsable",
            width: "150px",
            render: (t) => (
              <span className="text-[12px] text-muted">{t.assignee ?? "—"}</span>
            ),
          },
          {
            key: "priority",
            label: "Prioridad",
            width: "100px",
            render: (t) => (
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${PRIORITY_META[t.priority].className}`}
              >
                {PRIORITY_META[t.priority].label}
              </span>
            ),
          },
          {
            key: "due_date",
            label: "Vence",
            width: "110px",
            render: (t) => (
              <span className="text-[12px] text-muted">
                {formatDate(t.due_date)}
              </span>
            ),
          },
          {
            key: "status",
            label: "Estado",
            width: "150px",
            render: (t) => <StatusControl id={t.id} status={t.status} />,
          },
          {
            key: "actions",
            label: "",
            width: "140px",
            render: (t) => (
              <div className="flex items-center justify-end gap-2">
                <Link
                  href={`/admin/tareas/${t.id}`}
                  className="text-[12px] font-semibold text-terra hover:underline"
                >
                  Editar
                </Link>
                <form action={deleteTaskAction}>
                  <input type="hidden" name="id" value={t.id} />
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

function formatDate(date: string | null): string {
  if (!date) return "—";
  const [y, m, d] = date.split("-");
  if (!y || !m || !d) return date;
  return `${d}/${m}/${y}`;
}
