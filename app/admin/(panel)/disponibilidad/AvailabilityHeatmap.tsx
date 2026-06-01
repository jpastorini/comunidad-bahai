"use client";

import { useState } from "react";
import {
  HOURS,
  WEEKDAYS,
  cellKey,
  formatHourRange,
  type CellEntry,
  type LocalityAvailability,
} from "@/lib/availability";

type TipState = {
  weekday: number;
  hour: number;
  available: CellEntry[];
  sometimes: CellEntry[];
  x: number;
  y: number;
  above: boolean;
};

/**
 * Heatmap del equipo (pensado para PC): semana × hora. Cada celda se pinta
 * según cuántos miembros están "Disponible" ahí; el "+N" ámbar suma los
 * "A veces puedo". Al pasar el mouse (o tocar) se despliega un tooltip con
 * los nombres, separados por nivel y con un puntito de color.
 */
export function AvailabilityHeatmap({ data }: { data: LocalityAvailability }) {
  const { members, filledMemberIds, cells } = data;
  const totalMembers = members.length;
  const filled = new Set(filledMemberIds);
  const notFilled = members.filter((m) => !filled.has(m.id));

  // Denominador para la intensidad: cantidad de miembros que ya cargaron
  // (si nadie cargó, evitamos dividir por cero).
  const denom = Math.max(filled.size, 1);

  const [tip, setTip] = useState<TipState | null>(null);

  function showTip(
    e: React.MouseEvent<HTMLButtonElement>,
    weekday: number,
    hour: number,
    available: CellEntry[],
    sometimes: CellEntry[]
  ) {
    const rect = e.currentTarget.getBoundingClientRect();
    // Si hay poco lugar arriba, lo mostramos abajo de la celda.
    const above = rect.top > 200;
    setTip({
      weekday,
      hour,
      available,
      sometimes,
      x: rect.left + rect.width / 2,
      y: above ? rect.top - 8 : rect.bottom + 8,
      above,
    });
  }

  return (
    <div>
      {/* Leyenda */}
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-muted">
        <span className="inline-flex items-center gap-2">
          Menos
          <span className="inline-flex overflow-hidden rounded">
            {[0.12, 0.35, 0.58, 0.8, 1].map((a) => (
              <span
                key={a}
                className="h-3.5 w-5"
                style={{ background: `rgba(16,185,129,${a})` }}
              />
            ))}
          </span>
          Más disponibles
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="font-bold text-amber-600">+N</span> = a veces puedo
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3.5 w-3.5 rounded"
            style={{ background: "#f3d7d7" }}
          />
          Nadie disponible
        </span>
        <span>
          {filled.size}/{totalMembers} cargaron su disponibilidad
        </span>
      </div>

      <div className="overflow-x-auto">
        <div
          className="grid min-w-[640px] gap-1"
          style={{ gridTemplateColumns: "auto repeat(7, minmax(64px, 1fr))" }}
        >
          {/* Cabecera */}
          <div />
          {WEEKDAYS.map((d) => (
            <div
              key={d.index}
              className="pb-1 text-center text-[12px] font-semibold text-dark"
            >
              {d.short}
            </div>
          ))}

          {/* Filas por hora */}
          {HOURS.map((hour) => (
            <Row
              key={hour}
              hour={hour}
              cells={cells}
              denom={denom}
              onEnter={showTip}
              onLeave={() => setTip(null)}
            />
          ))}
        </div>
      </div>

      {/* Tooltip flotante con nombres */}
      {tip && (tip.available.length > 0 || tip.sometimes.length > 0) && (
        <div
          className="pointer-events-none fixed z-50 min-w-[170px] max-w-[240px] rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[12px] shadow-card-elevated"
          style={{
            left: tip.x,
            top: tip.y,
            transform: `translate(-50%, ${tip.above ? "-100%" : "0"})`,
          }}
        >
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
            {WEEKDAYS[tip.weekday].long} · {formatHourRange(tip.hour)}
          </div>
          {tip.available.length > 0 && (
            <NameList
              title="Disponible"
              titleClass="text-emerald-700"
              dotClass="bg-emerald-500"
              entries={tip.available}
            />
          )}
          {tip.sometimes.length > 0 && (
            <div className={tip.available.length > 0 ? "mt-2" : ""}>
              <NameList
                title="A veces puedo"
                titleClass="text-yellow-700"
                dotClass="bg-yellow-400"
                entries={tip.sometimes}
              />
            </div>
          )}
        </div>
      )}

      {/* Quién falta */}
      {notFilled.length > 0 && (
        <div className="mt-6 rounded-xl border border-black/[0.06] bg-card p-4">
          <div className="text-[12px] font-semibold text-dark">
            Todavía no cargaron ({notFilled.length})
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {notFilled.map((m) => (
              <span
                key={m.id}
                className="rounded-full bg-bg px-2.5 py-1 text-[11.5px] text-muted"
              >
                {m.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {totalMembers === 0 && (
        <p className="mt-4 text-[13px] text-muted">
          No hay miembros de la Asamblea (rol admin) en esta localidad todavía.
        </p>
      )}
    </div>
  );
}

function NameList({
  title,
  titleClass,
  dotClass,
  entries,
}: {
  title: string;
  titleClass: string;
  dotClass: string;
  entries: CellEntry[];
}) {
  return (
    <div>
      <div
        className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${titleClass}`}
      >
        {title} ({entries.length})
      </div>
      <ul className="flex flex-col gap-0.5">
        {entries.map((e) => (
          <li key={e.userId} className="flex items-center gap-1.5 text-dark">
            <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
            <span className="truncate">{e.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({
  hour,
  cells,
  denom,
  onEnter,
  onLeave,
}: {
  hour: number;
  cells: LocalityAvailability["cells"];
  denom: number;
  onEnter: (
    e: React.MouseEvent<HTMLButtonElement>,
    weekday: number,
    hour: number,
    available: CellEntry[],
    sometimes: CellEntry[]
  ) => void;
  onLeave: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-end pr-2 text-[11px] tabular-nums text-muted">
        {formatHourRange(hour)}
      </div>
      {WEEKDAYS.map((d) => {
        const entries = cells[cellKey(d.index, hour)] ?? [];
        const available = entries.filter((e) => e.level === 2);
        const sometimes = entries.filter((e) => e.level === 1);
        const intensity = available.length / denom;
        const strong = intensity > 0.5;

        return (
          <button
            key={d.index}
            type="button"
            onMouseEnter={(e) => onEnter(e, d.index, hour, available, sometimes)}
            onMouseLeave={onLeave}
            onClick={(e) => onEnter(e, d.index, hour, available, sometimes)}
            className="flex h-11 items-center justify-center rounded-md border border-black/[0.05] text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-terra/40"
            style={{
              background:
                available.length > 0
                  ? `rgba(16,185,129,${0.12 + 0.78 * Math.min(intensity, 1)})`
                  : sometimes.length > 0
                    ? "rgba(250,204,21,0.30)"
                    : "#f3d7d7",
              color: strong ? "#fff" : "#1f2937",
            }}
          >
            {available.length > 0 && <span>{available.length}</span>}
            {sometimes.length > 0 && (
              <span className="ml-0.5 text-[10px] font-bold text-amber-600">
                +{sometimes.length}
              </span>
            )}
          </button>
        );
      })}
    </>
  );
}
