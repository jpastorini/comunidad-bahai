import Link from "next/link";
import { Banner, Button, DataTable, PageHeader } from "@/components/admin/ui";
import { requirePermission } from "@/lib/auth";
import { isNationalLocality, isStructureLocality } from "@/lib/types";
import { getCalendarKind } from "@/lib/calendar-kinds";
import { getUnifiedCalendarItems } from "@/lib/data";
import {
  familyOf,
  getInstitutionalItems,
  getNationalLocalityId,
  parseCalendarScope,
  SCOPE_FAMILY,
  type CalendarScope,
} from "@/lib/institutional-calendar";
import type { UnifiedCalendarItem } from "@/lib/data";
import { ensureYearSeeded } from "@/lib/year-seed";
import { deleteEventAction } from "./actions";
import { MonthGrid, parseMonthParam } from "./MonthGrid";

const WEEKDAYS_ES = [
  "Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb",
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

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: { vista?: string; m?: string; ambito?: string };
}) {
  const session = await requirePermission("calendario");
  // Una estructura (082) no siembra nada: los Días Sagrados y las Fiestas
  // ya están en el calendario de la Asamblea de la que depende.
  if (!isStructureLocality(session.locality)) {
    await ensureYearSeeded(session.locality.id, new Date(), {
      seedFeasts: !isNationalLocality(session.locality),
    });
  }

  // Lo propio, más lo de las otras instituciones de la comunidad y las
  // nacionales (085), con el filtro Locales / Nacionales / Ambas.
  const scope = parseCalendarScope(searchParams?.ambito);
  const now = new Date();
  const [own, others, nationalId] = await Promise.all([
    getUnifiedCalendarItems(),
    getInstitutionalItems(
      `${now.getFullYear() - 1}-01-01`,
      `${now.getFullYear() + 2}-12-31`
    ),
    getNationalLocalityId(),
  ]);
  const ownFamily = familyOf(session.locality, nationalId);
  const othersIds = new Set(others.map((i) => i.id));
  const items = [
    // Un evento que una estructura compartió con la comunidad llega por
    // los dos lados: queda el de la otra institución, que dice de quién es.
    ...own
      .filter((i) => !othersIds.has(i.id))
      .map((i) =>
        i.localityId && i.localityId !== session.locality.id
          ? { ...i, readOnly: true, family: ownFamily }
          : { ...i, family: ownFamily }
      ),
    ...others,
  ]
    .filter(
      (i) =>
        scope === "ambas" ||
        i.family === SCOPE_FAMILY[scope]
    )
    .sort(
      (a, b) =>
        a.year * 10000 + a.month * 100 + a.day - (b.year * 10000 + b.month * 100 + b.day)
    );
  const scopeQuery = scope === "ambas" ? "" : `&ambito=${scope}`;

  const vista = searchParams?.vista === "lista" ? "lista" : "mes";

  const today = new Date();
  const todayKey =
    today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const { month, year } = parseMonthParam(searchParams?.m, today);

  // Marcamos la próxima entrada (hoy o futura) como destacada visualmente.
  const nextId = items.find(
    (i) => i.year * 10000 + i.month * 100 + i.day >= todayKey
  )?.id;

  // Agrupar por mes gregoriano, en orden cronológico ascendente.
  const groups = groupByMonth(items);

  return (
    <>
      <PageHeader
        eyebrow="Vida comunitaria"
        title="Calendario"
        description="La vista centralizada de todo lo que tiene la Asamblea entre manos: eventos, Fiestas, Días Sagrados y reuniones. Si vas a crear un nuevo evento, revisá primero acá para evitar solapamientos."
        actions={
          <>
            <ScopeToggle scope={scope} vista={vista} m={searchParams?.m} />
            <ViewToggle vista={vista} query={scopeQuery} />
            <Button href="/admin/calendario/nuevo">+ Nuevo evento</Button>
          </>
        }
      />

      {!isStructureLocality(session.locality) && (
      <Banner tone="info">
        Las <strong>Fiestas</strong> se siembran automáticamente — desde acá las
        ves para evitar superposición. Para editar el programa, oraciones,
        publicar o iniciar una Fiesta, abrí su detalle{" "}
        {vista === "mes" ? "haciendo clic en la entrada" : 'desde la columna "Acciones"'}{" "}
        o desde el sidebar "Fiestas de 19 Días".
      </Banner>
      )}
      <p className="mt-3 text-[12.5px] text-muted">
        Con borde punteado, lo de las otras instituciones de la comunidad y las
        nacionales: se ve para coordinar, lo edita cada una.
      </p>

      {vista === "mes" ? (
        <div className="mt-5">
          <MonthGrid items={items} month={month} year={year} query={scopeQuery} />
        </div>
      ) : groups.length === 0 ? (
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

/** Locales / Nacionales / Ambas (085). Conserva la vista y el mes. */
function ScopeToggle({
  scope,
  vista,
  m,
}: {
  scope: CalendarScope;
  vista: "mes" | "lista";
  m?: string;
}) {
  const base = "rounded-[10px] px-3 py-1.5 text-[12px] font-semibold transition";
  const active = "bg-terra text-white shadow-card-soft";
  const inactive = "text-muted hover:text-dark";
  const href = (s: CalendarScope) => {
    const q = new URLSearchParams();
    if (vista === "lista") q.set("vista", "lista");
    if (m) q.set("m", m);
    if (s !== "ambas") q.set("ambito", s);
    const qs = q.toString();
    return qs ? `/admin/calendario?${qs}` : "/admin/calendario";
  };
  const options: Array<[CalendarScope, string]> = [
    ["locales", "Locales"],
    ["agrupacion", "Agrupación"],
    ["nacionales", "Nacionales"],
    ["ambas", "Todas"],
  ];
  return (
    <div className="inline-flex items-center gap-0.5 rounded-xl border border-black/10 bg-card p-1">
      {options.map(([s, label]) => (
        <Link key={s} href={href(s)} className={`${base} ${scope === s ? active : inactive}`}>
          {label}
        </Link>
      ))}
    </div>
  );
}

function ViewToggle({ vista, query }: { vista: "mes" | "lista"; query: string }) {
  const base =
    "rounded-[10px] px-3 py-1.5 text-[12px] font-semibold transition";
  const active = "bg-terra text-white shadow-card-soft";
  const inactive = "text-muted hover:text-dark";
  return (
    <div className="inline-flex items-center gap-0.5 rounded-xl border border-black/10 bg-card p-1">
      <Link
        href={query ? `/admin/calendario?${query.slice(1)}` : "/admin/calendario"}
        className={`${base} ${vista === "mes" ? active : inactive}`}
      >
        Mes
      </Link>
      <Link
        href={`/admin/calendario?vista=lista${query}`}
        className={`${base} ${vista === "lista" ? active : inactive}`}
      >
        Lista
      </Link>
    </div>
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
        {WEEKDAYS_ES[date.getUTCDay()]} {String(item.day).padStart(2, "0")}/
        {String(item.month).padStart(2, "0")}/{item.year}
      </div>
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
          {item.institution && <span className="normal-case">· {item.institution}</span>}
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
  // De otra institución (085): lo edita la que lo cargó.
  if (item.readOnly) {
    return (
      <div className="text-right text-[11.5px] text-muted">
        Lo edita {item.institution ?? "otra institución"}
      </div>
    );
  }
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

  // Día Sagrado (system-seeded): solo editar, no borrar.
  if (item.isSystemSeeded) {
    return (
      <div className="flex items-center justify-end">
        <Link
          href={item.adminHref}
          className="text-[12px] font-semibold text-terra hover:underline"
        >
          Editar
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
