import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Banner, Button, Card, DataTable, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { civilDateISO } from "@/lib/citas";
import { formatDate, formatDayMonth } from "@/lib/format";
import { formatSinceDays } from "@/lib/message-reads";
import {
  getUsageReport,
  REGULARITY_LABELS,
  resolveUsageRange,
  usagePresets,
  type UsagePerson,
} from "@/lib/usage";

/**
 * Uso de la app por localidad (049): cuántos la tienen instalada,
 * cuántos entran y con qué regularidad, qué secciones se usan más, y la
 * lista de personas de menos a más activa. El rango se elige arriba;
 * todo lo demás se recalcula para ese rango.
 */
export default async function UsoPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const session = await requireAdmin();
  const today = civilDateISO();
  const range = resolveUsageRange(searchParams, today);
  const presets = usagePresets(today);
  const report = await getUsageReport(session.locality.id, range);

  const activePreset = presets.find(
    (p) => p.from === range.from && p.to === range.to
  )?.key;

  return (
    <>
      <PageHeader
        eyebrow="Asamblea Espiritual Local"
        title="Uso de la app"
        description={`Cómo usa la comunidad de ${session.locality.name} la aplicación. Los datos empiezan el día en que se estrenó la medición.`}
      />

      {/* Rango */}
      <Card className="mb-6 !p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <Link
                key={p.key}
                href={`/admin/uso?from=${p.from}&to=${p.to}`}
                className={
                  activePreset === p.key
                    ? "rounded-full bg-terra px-3 py-1.5 text-[12px] font-semibold text-white"
                    : "rounded-full bg-black/[0.05] px-3 py-1.5 text-[12px] font-medium text-dark hover:bg-black/[0.09]"
                }
              >
                {p.label}
              </Link>
            ))}
          </div>
          <form method="get" className="flex flex-wrap items-center gap-2 text-[12px]">
            <label className="flex items-center gap-1.5">
              <span className="text-muted">Del</span>
              <input
                type="date"
                name="from"
                defaultValue={range.from}
                max={today}
                className="rounded-lg border border-black/10 bg-card px-2 py-1.5 text-[12px]"
              />
            </label>
            <label className="flex items-center gap-1.5">
              <span className="text-muted">al</span>
              <input
                type="date"
                name="to"
                defaultValue={range.to}
                max={today}
                className="rounded-lg border border-black/10 bg-card px-2 py-1.5 text-[12px]"
              />
            </label>
            <Button type="submit" variant="secondary">
              Ver
            </Button>
          </form>
        </div>
      </Card>

      {!report ? (
        <Banner tone="warning">
          No se pudo leer la estadística de uso. Si la migración 049 todavía no
          se aplicó en la base, esta pantalla queda vacía hasta entonces.
        </Banner>
      ) : (
        <>
          <p className="mb-4 text-[12px] text-muted">
            Período: {formatDate(range.from)} al {formatDate(range.to)} ·{" "}
            {report.days} {report.days === 1 ? "día" : "días"}
          </p>

          {/* Resumen */}
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Registrados" value={String(report.summary.total)} tone="dark" />
            <Stat
              label="Con la app instalada"
              value={`${report.summary.installed} de ${report.summary.total}`}
              tone="green"
              sub={pct(report.summary.installed, report.summary.total)}
            />
            <Stat
              label="Con avisos activados"
              value={`${report.summary.withPush} de ${report.summary.total}`}
              tone="gold"
              sub={pct(report.summary.withPush, report.summary.total)}
            />
            <Stat
              label="Entraron en el período"
              value={`${report.summary.active} de ${report.summary.total}`}
              tone="green"
              sub={pct(report.summary.active, report.summary.total)}
            />
            <Stat
              label="Nunca entraron"
              value={String(report.summary.never)}
              tone={report.summary.never > 0 ? "terra" : "muted"}
              sub="desde que existe la app"
            />
          </div>

          {/* Personas activas por día */}
          <Card className="mb-5">
            <h2 className="font-display text-[18px] font-semibold text-dark">
              Personas que entraron, por día
            </h2>
            <p className="mb-4 text-[11.5px] text-muted">
              Cuántas personas distintas abrieron la app cada día del período.
            </p>
            <DayChart data={report.byDay} total={report.summary.total} />
          </Card>

          <div className="mb-5 grid gap-5 lg:grid-cols-2">
            {/* Regularidad */}
            <Card>
              <h2 className="font-display text-[18px] font-semibold text-dark">
                Regularidad
              </h2>
              <p className="mb-4 text-[11.5px] text-muted">
                Con qué frecuencia entró cada persona en el período, según sus
                días con actividad.
              </p>
              <BarList
                rows={report.regularity.map((r) => ({
                  key: r.key,
                  label: r.label,
                  value: r.count,
                  detail: pct(r.count, report.summary.total),
                  tone: r.key === "nunca" ? "terra" : "green",
                }))}
                max={report.summary.total}
              />
            </Card>

            {/* Secciones */}
            <Card>
              <h2 className="font-display text-[18px] font-semibold text-dark">
                Secciones más usadas
              </h2>
              <p className="mb-4 text-[11.5px] text-muted">
                Visitas a cada zona de la app y cuántas personas distintas la
                abrieron.
              </p>
              {report.sections.length === 0 ? (
                <p className="py-6 text-center text-[12px] text-muted">
                  Sin actividad en el período.
                </p>
              ) : (
                <BarList
                  rows={report.sections.map((s) => ({
                    key: s.key,
                    label: s.label,
                    value: s.hits,
                    detail: `${s.people} ${s.people === 1 ? "persona" : "personas"}`,
                    tone: "gold",
                  }))}
                  max={report.sections[0].hits}
                />
              )}
            </Card>
          </div>

          {/* Personas */}
          <h2 className="mb-1 font-display text-[18px] font-semibold text-dark">
            Persona por persona
          </h2>
          <p className="mb-3 text-[11.5px] text-muted">
            De menos a más activa: arriba quedan quienes más ayuda pueden
            necesitar para usar la app. Los datos de contacto están en{" "}
            <Link href="/admin/miembros" className="text-terra hover:underline">
              Creyentes
            </Link>
            .
          </p>
          <DataTable
            rows={report.people}
            rowKey={(p) => p.id}
            empty="No hay personas activas en la localidad."
            columns={[
              {
                key: "person",
                label: "Persona",
                render: (p: UsagePerson) => (
                  <div className="flex items-center gap-2.5">
                    <Avatar url={p.avatar_url} name={p.full_name} size={30} />
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-dark">
                        {p.full_name}
                      </div>
                      {!p.is_bahai && (
                        <div className="text-[10px] text-muted">Amigo/a de la Fe</div>
                      )}
                    </div>
                  </div>
                ),
              },
              {
                key: "regularity",
                label: "Regularidad",
                width: "190px",
                render: (p) => (
                  <span
                    className={
                      p.regularity === "nunca"
                        ? "text-[12px] font-medium text-terra"
                        : "text-[12px] text-dark"
                    }
                  >
                    {REGULARITY_LABELS[p.regularity]}
                  </span>
                ),
              },
              {
                key: "days",
                label: "Días activos",
                width: "120px",
                render: (p) => (
                  <span className="text-[12px] text-dark">
                    {p.active_days} de {report.days}
                  </span>
                ),
              },
              {
                key: "last",
                label: "Última entrada",
                width: "150px",
                render: (p) => (
                  <span
                    className={
                      p.last_seen_at ? "text-[12px] text-muted" : "text-[12px] font-medium text-terra"
                    }
                  >
                    {formatSinceDays(p.last_seen_at)}
                  </span>
                ),
              },
              {
                key: "installed",
                label: "Instalada",
                width: "90px",
                render: (p) => <YesNo value={p.installed} />,
              },
              {
                key: "push",
                label: "Avisos",
                width: "90px",
                render: (p) => <YesNo value={p.push} />,
              },
            ]}
          />
        </>
      )}
    </>
  );
}

function pct(n: number, total: number): string {
  if (total === 0) return "—";
  return `${Math.round((n / total) * 100)} %`;
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "green" | "gold" | "terra" | "muted" | "dark";
}) {
  const color = {
    green: "text-green",
    gold: "text-gold-dark",
    terra: "text-terra",
    muted: "text-muted",
    dark: "text-dark",
  }[tone];
  return (
    <Card className="!p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[1.5px] text-muted">
        {label}
      </div>
      <div className={`mt-1 font-display text-[24px] font-bold leading-none ${color}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-muted">{sub}</div>}
    </Card>
  );
}

function YesNo({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green/15 text-green">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  ) : (
    <span className="text-[12px] text-muted">—</span>
  );
}

function BarList({
  rows,
  max,
}: {
  rows: Array<{
    key: string;
    label: string;
    value: number;
    detail: string;
    tone: "green" | "gold" | "terra";
  }>;
  max: number;
}) {
  const color = { green: "bg-green", gold: "bg-gold", terra: "bg-terra" };
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => {
        const w = max > 0 ? Math.round((r.value / max) * 100) : 0;
        return (
          <li key={r.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[12px]">
              <span className="text-dark">{r.label}</span>
              <span className="shrink-0 text-muted">
                <span className="font-semibold text-dark">{r.value}</span>
                <span className="ml-1.5 text-[11px]">{r.detail}</span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
              <div
                className={`h-full rounded-full ${color[r.tone]}`}
                style={{ width: `${w}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Barras por día, en SVG puro (sin librería): una barra por día del
 * rango y una línea punteada en el total de personas registradas, para
 * que el "cuántos entraron" se lea contra el "cuántos podrían".
 */
function DayChart({
  data,
  total,
}: {
  data: Array<{ day: string; people: number }>;
  total: number;
}) {
  const W = 720;
  const H = 160;
  const padL = 28;
  const padB = 22;
  const padT = 8;
  const innerW = W - padL - 8;
  const innerH = H - padB - padT;
  const max = Math.max(total, ...data.map((d) => d.people), 1);
  const n = data.length;
  const gap = n > 60 ? 0.5 : n > 30 ? 1 : 3;
  const barW = Math.max(1, innerW / n - gap);
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  // Etiquetas de fecha: como mucho ocho, repartidas.
  const step = Math.max(1, Math.ceil(n / 8));

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full min-w-[420px]"
        role="img"
        aria-label="Personas activas por día"
      >
        {/* Eje Y: 0 y total */}
        <text x={padL - 6} y={y(0) + 4} textAnchor="end" fontSize="10" fill="#9A9A9A">
          0
        </text>
        <text x={padL - 6} y={y(max) + 4} textAnchor="end" fontSize="10" fill="#9A9A9A">
          {max}
        </text>
        <line
          x1={padL}
          x2={W - 8}
          y1={y(0)}
          y2={y(0)}
          stroke="#00000014"
          strokeWidth="1"
        />
        {total > 0 && (
          <line
            x1={padL}
            x2={W - 8}
            y1={y(total)}
            y2={y(total)}
            stroke="#C4A235"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        )}
        {data.map((d, i) => {
          const x = padL + i * (innerW / n) + gap / 2;
          const h = Math.max(d.people > 0 ? 2 : 0, y(0) - y(d.people));
          return (
            <g key={d.day}>
              <rect
                x={x}
                y={y(0) - h}
                width={barW}
                height={h}
                rx={barW > 4 ? 2 : 0}
                fill="#2F7D5B"
              >
                <title>
                  {formatDate(d.day)}: {d.people}{" "}
                  {d.people === 1 ? "persona" : "personas"}
                </title>
              </rect>
              {i % step === 0 && (
                <text
                  x={x + barW / 2}
                  y={H - 6}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#9A9A9A"
                >
                  {formatDayMonth(d.day)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
