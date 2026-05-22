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
const MONTHS_ES_LONG = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

type MonthGroup = {
  key: string;       // "2026-05"
  label: string;     // "Mayo 2026"
  year: number;
  month: number;
  items: UnifiedCalendarItem[];
};

export default async function AdminCalendarPage() {
  await requireAdmin();
  const items = await getUnifiedCalendarItems();

  const today = new Date();
  const todayKey =
    today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  // Marcamos la próxima entrada (hoy o futura) como destacada visualmente.
  const nextId = items.find(
    (i) => i.year * 10000 + i.month * 100 + i.day >= todayKey
  )?.id;

  // Agrupar por mes gregoriano, en orden cronológico ascendente.
  const groups = groupByMonth(items);

  return (
    <>
      <PageHeader
        eyebrow="Comunidad"
        title="Calendario"
        description="Vista general agrupada por mes gregoriano. Si vas a crear un nuevo evento, revisa primero esta lista para evitar solapamientos."
        actions={<Button href="/admin/calendario/nuevo">+ Nuevo evento</Button>}
      />

      <Banner tone="info">
        Las <strong>Fiestas</strong> se siembran automáticamente — desde acá las
        ves para evitar superposición. Para editar el programa, oraciones,
        publicar o iniciar una Fiesta, abrí su detalle desde la columna
        "Acciones" o desde el sidebar "Fiestas de 19 Días".
      </Banner>

      {groups.length === 0 ? (
        <div className="mt-5 rounded-2xl bg-card px-4 py-12 text-center text-[14px] text-muted shadow-card-soft">
          Aún no hay eventos ni Fiestas en el calendario.
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-6">
          {groups.map((group) => (
            <MonthSection
              key={group.key}
              group={group}
              isCurrentMonth={group.key === currentMonthKey}
              nextId={nextId}
            />
          ))}
        </div>
      )}
    </>
  );
}

function MonthSection({
  group,
  isCurrentMonth,
  nextId,
}: {
  group: MonthGroup;
  isCurrentMonth: boolean;
  nextId: string | undefined;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-baseline gap-3">
        <h2 className="font-display text-[18px] font-semibold text-dark">
          {group.label}
        </h2>
        {isCurrentMonth && (
          <span className="rounded-full bg-terra/15 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-terra">
            Este mes
          </span>
        )}
        <span className="text-[11px] text-muted">
          {group.items.length}{" "}
          {group.items.length === 1 ? "entrada" : "entradas"}
        </span>
      </div>
      <DataTable
        rows={group.items}
        rowKey={(i) => `${i.source}-${i.id}`}
        rowClassName={(i) =>
          i.id === nextId ? "bg-[#C4A235]/[0.06]" : undefined
        }
        empty=""
        columns={[
          {
            key: "date",
            label: "Fecha",
            width: "130px",
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
    </section>
  );
}

function groupByMonth(items: UnifiedCalendarItem[]): MonthGroup[] {
  const map = new Map<string, MonthGroup>();
  for (const i of items) {
    const key = `${i.year}-${String(i.month).padStart(2, "0")}`;
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        label: `${MONTHS_ES_LONG[i.month - 1]} ${i.year}`,
        year: i.year,
        month: i.month,
        items: [],
      };
      map.set(key, group);
    }
    group.items.push(i);
  }
  return [...map.values()].sort(
    (a, b) => a.year * 12 + a.month - (b.year * 12 + b.month)
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
