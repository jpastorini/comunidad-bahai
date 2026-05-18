import Link from "next/link";
import { Button, DataTable, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { formatMessageDate } from "@/lib/format";
import type { Message } from "@/lib/types";
import { deleteMessageAction } from "./actions";

export default async function AdminMensajesPage() {
  await requireAdmin();
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("source", "casa_universal")
    .order("date", { ascending: false });

  const rows = (data ?? []) as Message[];

  return (
    <>
      <PageHeader
        eyebrow="Casa Universal de Justicia"
        title="Mensajes"
        description="Publica los mensajes oficiales de la Casa Universal de Justicia. Cada mensaje consta de un título, fecha y el PDF correspondiente."
        actions={<Button href="/admin/mensajes/nuevo">+ Nuevo mensaje</Button>}
      />

      <DataTable
        rows={rows}
        rowKey={(m) => m.id}
        empty="Aún no hay mensajes publicados."
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
            label: "Título",
            render: (m) => (
              <div className="font-display text-[15px] font-semibold text-dark">
                {m.title}
              </div>
            ),
          },
          {
            key: "pdf",
            label: "PDF",
            width: "100px",
            render: (m) =>
              m.pdf_url ? (
                <a
                  href={m.pdf_url}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1 rounded bg-gold/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-gold-dark hover:bg-gold/25"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  PDF
                </a>
              ) : (
                <span className="text-[11px] text-muted">—</span>
              ),
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
                  href={`/admin/mensajes/${m.id}`}
                  className="text-[12px] font-semibold text-terra hover:underline"
                >
                  Editar
                </Link>
                <form action={deleteMessageAction}>
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
