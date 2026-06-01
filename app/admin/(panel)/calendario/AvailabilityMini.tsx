import Link from "next/link";
import {
  WEEKDAYS,
  HOURS,
  cellKey,
  formatHourRange,
  type LocalityAvailability,
} from "@/lib/availability";

/**
 * Versión compacta del consolidado de disponibilidad, para mostrar al
 * costado del formulario de una "Reunión AEL" (solo PC). Arriba, las
 * mejores franjas (más miembros disponibles); abajo, un mini-heatmap.
 */
export function AvailabilityMini({ data }: { data: LocalityAvailability }) {
  const { members, filledMemberIds, cells } = data;
  const filled = new Set(filledMemberIds);
  const denom = Math.max(filled.size, 1);

  // Ranking de franjas por cantidad de "Disponible" (desempata "a veces").
  const ranked = Object.entries(cells)
    .map(([key, entries]) => {
      const [wd, hr] = key.split(":").map(Number);
      return {
        weekday: wd,
        hour: hr,
        available: entries.filter((e) => e.level === 2).length,
        sometimes: entries.filter((e) => e.level === 1).length,
      };
    })
    .filter((c) => c.available > 0)
    .sort((a, b) => b.available - a.available || b.sometimes - a.sometimes)
    .slice(0, 4);

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-[15px] font-semibold text-dark">
          Disponibilidad del equipo
        </h3>
        <Link
          href="/admin/disponibilidad?v=equipo"
          className="text-[11px] font-semibold text-terra hover:underline"
        >
          Ver todo
        </Link>
      </div>
      <p className="mt-0.5 text-[11px] text-muted">
        {filled.size}/{members.length} de la AEL cargaron su disponibilidad.
      </p>

      {/* Mejores franjas */}
      {ranked.length > 0 ? (
        <div className="mt-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gold-dark">
            Mejores franjas
          </div>
          <ul className="mt-1.5 flex flex-col gap-1">
            {ranked.map((c) => (
              <li
                key={cellKey(c.weekday, c.hour)}
                className="flex items-center justify-between rounded-lg bg-bg/60 px-2.5 py-1.5 text-[12px]"
              >
                <span className="font-medium text-dark">
                  {WEEKDAYS[c.weekday].long} {formatHourRange(c.hour)}
                </span>
                <span className="text-[11px] text-muted">
                  <span className="font-bold text-emerald-600">{c.available}</span>
                  {c.sometimes > 0 && (
                    <span className="ml-1 font-bold text-yellow-600">
                      +{c.sometimes}?
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-[12px] text-muted">
          Todavía nadie marcó franjas disponibles.
        </p>
      )}

      {/* Mini-heatmap */}
      <div className="mt-4">
        <div
          className="grid gap-0.5"
          style={{ gridTemplateColumns: "auto repeat(7, minmax(0, 1fr))" }}
        >
          <div />
          {WEEKDAYS.map((d) => (
            <div
              key={d.index}
              className="pb-0.5 text-center text-[9px] font-semibold text-muted"
            >
              {d.short[0]}
            </div>
          ))}
          {HOURS.map((hour) => (
            <MiniRow key={hour} hour={hour} cells={cells} denom={denom} />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted">
          <span>Menos</span>
          <span className="inline-flex overflow-hidden rounded-sm">
            {[0.12, 0.4, 0.68, 1].map((a) => (
              <span
                key={a}
                className="h-2.5 w-3.5"
                style={{ background: `rgba(16,185,129,${a})` }}
              />
            ))}
          </span>
          <span>Más disponibles</span>
        </div>
      </div>
    </div>
  );
}

function MiniRow({
  hour,
  cells,
  denom,
}: {
  hour: number;
  cells: LocalityAvailability["cells"];
  denom: number;
}) {
  return (
    <>
      <div className="pr-1 text-right text-[8.5px] leading-[14px] tabular-nums text-muted">
        {String(hour).padStart(2, "0")}
      </div>
      {WEEKDAYS.map((d) => {
        const entries = cells[cellKey(d.index, hour)] ?? [];
        const available = entries.filter((e) => e.level === 2).length;
        const sometimes = entries.filter((e) => e.level === 1).length;
        const intensity = available / denom;
        const title = `${WEEKDAYS[d.index].long} ${formatHourRange(hour)} · ${available} disponible${available === 1 ? "" : "s"}${sometimes ? `, ${sometimes} a veces` : ""}`;
        return (
          <div
            key={d.index}
            title={title}
            className="h-3.5 rounded-[3px] border border-black/[0.04]"
            style={{
              background:
                available > 0
                  ? `rgba(16,185,129,${0.12 + 0.78 * Math.min(intensity, 1)})`
                  : sometimes > 0
                    ? "rgba(250,204,21,0.30)"
                    : "#f3d7d7",
            }}
          />
        );
      })}
    </>
  );
}
