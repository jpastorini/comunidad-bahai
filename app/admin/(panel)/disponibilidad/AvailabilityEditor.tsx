"use client";

import { useState, useTransition } from "react";
import {
  HOURS,
  LEVELS,
  WEEKDAYS,
  cellKey,
  formatHourRange,
  type AvailabilityLevel,
  type MyAvailability,
} from "@/lib/availability";
import { setAvailabilityCellAction } from "./actions";

/** Ciclo al tocar: No puedo → Disponible (2) → A veces (1) → No puedo. */
function nextLevel(cur: AvailabilityLevel | undefined): AvailabilityLevel | null {
  if (cur === undefined) return 2;
  if (cur === 2) return 1;
  return null;
}

const CELL_STYLE: Record<
  "empty" | "1" | "2",
  { cls: string; label: string }
> = {
  empty: { cls: "bg-card border border-black/[0.07] text-transparent", label: "" },
  "2": { cls: "bg-emerald-500 text-white border border-emerald-600", label: "✓" },
  "1": { cls: "bg-amber-400 text-white border border-amber-500", label: "~" },
};

export function AvailabilityEditor({ initial }: { initial: MyAvailability }) {
  const [grid, setGrid] = useState<MyAvailability>(initial);
  const [pending, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(weekday: number, hour: number) {
    const key = cellKey(weekday, hour);
    const cur = grid[key];
    const next = nextLevel(cur);

    // Optimista: aplicamos ya y revertimos si el server falla.
    const prev = grid;
    const optimistic = { ...grid };
    if (next === null) delete optimistic[key];
    else optimistic[key] = next;
    setGrid(optimistic);
    setError(null);

    startSave(async () => {
      const res = await setAvailabilityCellAction(weekday, hour, next);
      if (!res.ok) {
        setGrid(prev);
        setError(res.error ?? "No se pudo guardar. Probá de nuevo.");
      }
    });
  }

  const total = Object.keys(grid).length;

  return (
    <div>
      {/* Leyenda + instrucción */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded bg-emerald-500" />
          Disponible
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded bg-amber-400" />
          A veces puedo
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded border border-black/15 bg-card" />
          No puedo
        </span>
      </div>
      <p className="mb-3 text-[12px] text-muted">
        Tocá una franja para marcarla. Cada toque cambia el estado:{" "}
        <span className="font-medium text-dark">No puedo → Disponible → A veces</span>.
        Se guarda solo.
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
          {error}
        </div>
      )}

      {/* Grilla: columna de horas + 7 días. Cabecera pegajosa. */}
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[320px] gap-1"
          style={{ gridTemplateColumns: "auto repeat(7, minmax(34px, 1fr))" }}
        >
          {/* Cabecera */}
          <div className="sticky top-0 z-10" />
          {WEEKDAYS.map((d) => (
            <div
              key={d.index}
              className="pb-1 text-center text-[11px] font-semibold text-dark"
            >
              {d.short}
            </div>
          ))}

          {/* Filas por hora */}
          {HOURS.map((hour) => (
            <FragmentRow key={hour} hour={hour} grid={grid} onToggle={toggle} />
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-[12px] text-muted">
        <span>
          {total === 0
            ? "Todavía no marcaste ninguna franja."
            : `${total} ${total === 1 ? "franja marcada" : "franjas marcadas"}.`}
        </span>
        {pending && <span className="text-gold-dark">Guardando…</span>}
      </div>
    </div>
  );
}

function FragmentRow({
  hour,
  grid,
  onToggle,
}: {
  hour: number;
  grid: MyAvailability;
  onToggle: (weekday: number, hour: number) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-end pr-1.5 text-[10.5px] tabular-nums text-muted">
        {formatHourRange(hour)}
      </div>
      {WEEKDAYS.map((d) => {
        const level = grid[cellKey(d.index, hour)];
        const variant =
          level === 2 ? CELL_STYLE["2"] : level === 1 ? CELL_STYLE["1"] : CELL_STYLE.empty;
        return (
          <button
            key={d.index}
            type="button"
            onClick={() => onToggle(d.index, hour)}
            aria-label={`${d.long} ${formatHourRange(hour)}: ${
              level ? LEVELS[level].label : "No puedo"
            }`}
            className={`tap h-9 rounded-md text-[12px] font-bold transition active:scale-95 ${variant.cls}`}
          >
            {variant.label}
          </button>
        );
      })}
    </>
  );
}
