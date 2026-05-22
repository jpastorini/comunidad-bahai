import Link from "next/link";
import { Banner, Button, DataTable, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { getCalendarKind } from "@/lib/calendar-kinds";
import { getUnifiedCalendarItems } from "@/lib/data";
import type { UnifiedCalendarItem } from "@/lib/data";
import { deleteEventAction } from "./actions";

const WEEKDAYS_ES = [
  "Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb",
];
const MONTHS_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

export default async function AdminCalendarPage() {
  await requireAdmin();
  const items = await getUnifiedCalendarItems();

  const todayKey = (() => {
    const t = new Date();
    return t.getFullYear() * 10000 + (t.getMonth() + 1) * 100 + t.getDate();
  })();

  // Marcamos la próxima entrada (hoy o futura) como destacada visualmente.
  const nextId = items.find(
    (i) => i.year * 10000 + i.month * 100 + i.day >= todayKey
  )?.id;

  return (
    <>
      <PageHeader
        eyebrow="Comunidad"
        title="Calendario"
        description="Vista general: eventos, Fiestas y, a futuro, Días Sagrados. Si vas a crear un nuevo evento, revisa primero esta lista para evitar solapamientos."
        actions={<Button href="/admin/calendario/nuevo">+ Nuevo evento</Button>}
      />

      <Banner tone="info">
        Las <strong>Fiestas</strong> se siembran automáticamente — desde acá las
        ves para evitar superposición. Para editar el programa, oraciones,
        publicar o iniciar una Fiesta, abrí su detalle desde la columna
        "Acciones" o desde el sidebar "Fiestas de 19 Días".
      </Banner>

      <div className="mt-5">
        <DataTable
          rows={items}
          rowKey={(i) => `${i.source}-${i.id}`}
          rowClassName={(i) =>
            i.id === nextId ? "bg-[#C4A235]/[0.06]" : undefined
          }
          empty="Aún no hay eventos ni Fiestas en el calendario."
          columns={[
            {
              key: "date",
              label: "Fecha",
              width: "150px",
              render: (i) => <DateCell item={i} isNext={i.id === nextId} />,
            },
            {
              key: "title",
              label: "Evento",
              render: (i) => <TitleCell item={i} />,
            },
            {
              key: "time",
              label: "Hora",
              width: "100px",
              render: (i) => (
                <span className="text-[12px] text-muted">{i.time}</span>
              ),
            },
            {
              key: "location",
              label: "Ubicación",
              render: (i) => (
                <span className="text-[12px] text-muted">
                  {i.location ?? "—"}
                </span>
              ),
            },
            {
              key: "actions",
              label: "Acciones",
              width: "180px",
              render: (i) => <ActionsCell item={i} />,
            },
          ]}
        />
      </div>
    </>
  );
}

function DateCell({
  item,
  isNext,
}: {
  item: UnifiedCalendarItem;
  isNext: boolean;
}) {
  const date = new Date(Date.UTC(item.year, item.month - 1, item.day, 12, 0));
  return (
    <div>
      {isNext && (
        <div className="mb-1 inline-block rounded-full bg-[#C4A235]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gold-dark">
          ✦ Próximo
        </div>
      )}
      <div className="font-display text-[13px] font-semibold text-dark">
        {WEEKDAYS_ES[date.getUTCDay()]} {item.day} {MONTHS_ES[item.month - 1]}
      </div>
      <div className="text-[10.5px] text-muted">{item.year}</div>
    </div>
  );
}

function TitleCell({ item }: { item: UnifiedCalendarItem }) {
  const meta = getCalendarKind(item.kind);
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block h-3 w-3 rounded-full"
        style={{ background: item.color }}
      />
      <div className="min-w-0">
        <div className="text-[14px] font-semibold text-dark">{item.title}</div>
        <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-wide text-muted">
          <span>{meta.label}</span>
          {item.source === "feast" && item.feastStatus && (
            <FeastStatusPill status={item.feastStatus} />
          )}
        </div>
      </div>
    </div>
  );
}

function FeastStatusPill({
  status,
}: {
  status: NonNullable<UnifiedCalendarItem["feastStatus"]>;
}) {
  if (status === "in_progress") {
    return (
      <span className="rounded bg-[#C4A235]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gold-dark">
        Iniciada
      </span>
    );
  }
  if (status === "published") {
    return (
      <span className="rounded bg-terra/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-terra">
        Publicada
      </span>
    );
  }
  return (
    <span className="rounded bg-bg px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted">
      No publicada
    </span>
  );
}

function ActionsCell({ item }: { item: UnifiedCalendarItem }) {
  if (item.source === "feast") {
    return (
      <div className="flex items-center justify-end">
        <Link
          href={item.adminHref}
          className="text-[12px] font-semibold text-terra hover:underline"
        >
          Editar Fiesta
        </Link>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-end gap-2">
      <Link
        href={item.adminHref}
        className="text-[12px] font-semibold text-terra hover:underline"
      >
        Editar
      </Link>
      <form action={deleteEventAction}>
        <input type="hidden" name="id" value={item.id} />
        <button
          type="submit"
          className="text-[12px] font-semibold text-rose-600 hover:underline"
        >
          Borrar
        </button>
      </form>
    </div>
  );
}
