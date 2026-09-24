import { Banner, Card, PageHeader } from "@/components/admin/ui";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  getCommitmentMonthReport,
  type CommitmentRow,
} from "@/lib/treasury-commitments";
import {
  isValidMonthKey,
  monthKeyOf,
  monthLabel,
  previousMonthKey,
} from "@/lib/treasury-cashbook";
import { formatMoney } from "@/lib/treasury-format";
import { todayISO } from "@/lib/treasury-ledger";

export const dynamic = "force-dynamic";

/**
 * Compromisos — a quién llamar para agradecer y a quién para recordar.
 *
 * La pantalla no decide nada: todo el cálculo está en
 * `lib/treasury-commitments.ts`, que es también lo que el informe usa
 * para saber a quién NO mandarle el recordatorio del 10. Las dos cosas
 * tienen que decir lo mismo.
 */
export default async function CompromisosPage({
  searchParams,
}: {
  searchParams?: { mes?: string };
}) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);

  const thisMonth = monthKeyOf(todayISO());
  const month =
    searchParams?.mes && isValidMonthKey(searchParams.mes)
      ? searchParams.mes
      : thisMonth;

  const supabase = createSupabaseServer();
  const report = await getCommitmentMonthReport(
    supabase,
    session.locality.id,
    month
  );

  // Los últimos 12 meses para elegir, del más nuevo al más viejo.
  const options: string[] = [];
  let cursor = thisMonth;
  for (let i = 0; i < 12; i++) {
    options.push(cursor);
    cursor = previousMonthKey(cursor);
  }
  if (!options.includes(month)) options.unshift(month);

  const pendientes = report.rows.filter(
    (r) => r.status === "pendiente" || r.status === "parcial"
  );
  const cumplidos = report.rows.filter((r) => r.status === "cumplido");
  const sinVinculo = report.rows.filter((r) => r.status === "sin_vinculo");

  return (
    <>
      <PageHeader
        eyebrow="Tesorería"
        title="Compromisos"
        description={`Cómo viene ${monthLabel(month)} respecto de lo que cada creyente declaró aportar. Es información reservada del tesorero.`}
      />

      {report.schemaMissing && (
        <div className="mb-4">
          <Banner tone="warning">
            Falta aplicar la migración <strong>063</strong> en Supabase. Hasta
            entonces esta pantalla no puede leer los compromisos.
          </Banner>
        </div>
      )}

      <Card className="mb-5">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-dark">
              Mes
            </span>
            <select
              name="mes"
              defaultValue={month}
              className="rounded-xl border border-black/10 bg-card px-3 py-2 text-[14px] text-dark"
            >
              {options.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-xl bg-terra px-4 py-2 text-[13px] font-semibold text-white"
          >
            Ver
          </button>
          <p className="ml-auto max-w-[36ch] text-[11.5px] leading-snug text-muted">
            El mes es civil, de la primera a la última fecha. Cuenta cualquier
            aporte de la persona a esta comunidad, sea a qué fondo sea.
          </p>
        </form>
      </Card>

      {report.totals.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-3">
          {report.totals.map((t) => {
            const pct =
              t.committed > 0 ? Math.round((t.paid / t.committed) * 100) : 0;
            return (
              <Card key={t.currency} className="min-w-[220px] flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Comprometido · {t.currency}
                </div>
                <div className="mt-1 font-display text-[26px] font-bold leading-none text-dark">
                  {formatMoney(t.committed, t.currency)}
                </div>
                <div className="mt-2 text-[13px] text-dark">
                  Aportado{" "}
                  <strong>{formatMoney(t.paid, t.currency)}</strong>{" "}
                  <span className="text-muted">({pct} %)</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10">
                  <div
                    className="h-full rounded-full bg-terra"
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {report.rows.length === 0 && !report.schemaMissing && (
        <Card className="mb-5">
          <p className="text-[13.5px] text-muted">
            Todavía nadie declaró un compromiso mensual en esta comunidad. Se
            declara desde Tesorería, en la app de la comunidad.
          </p>
        </Card>
      )}

      <Group
        title="Para llamar y recordar"
        hint="Todavía no figura su aporte del mes en el libro. Si lo cargaste y no aparece acá, fijate que el contribuyente esté vinculado a su perfil."
        rows={pendientes}
        tone="warning"
        month={month}
      />

      <Group
        title="Para llamar y agradecer"
        hint="Ya cubrieron lo que declararon este mes."
        rows={cumplidos}
        tone="ok"
        month={month}
      />

      <Group
        title="No se puede saber"
        hint="Nadie en el libro apunta a su perfil, así que sus aportes no se pueden reconocer. Se vincula desde el Libro, en el buscador de contribuyentes del movimiento."
        rows={sinVinculo}
        tone="neutral"
        month={month}
      />

      {report.others.length > 0 && (
        <Card className="mb-5">
          <h2 className="font-display text-[18px] font-semibold text-dark">
            Aportaron sin compromiso declarado
          </h2>
          <p className="mb-3 mt-1 text-[12px] text-muted">
            También hay que agradecerles. Sale del libro de este mes.
          </p>
          <ul className="divide-y divide-black/5">
            {report.others.map((o) => (
              <li
                key={o.name}
                className="flex items-baseline justify-between gap-4 py-2"
              >
                <span className="text-[14px] text-dark">{o.name}</span>
                <span className="text-[13px] font-semibold text-dark">
                  {o.totals
                    .map((t) => formatMoney(t.amount, t.currency))
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function Group({
  title,
  hint,
  rows,
  tone,
  month,
}: {
  title: string;
  hint: string;
  rows: CommitmentRow[];
  tone: "ok" | "warning" | "neutral";
  month: string;
}) {
  if (rows.length === 0) return null;
  const dot =
    tone === "ok" ? "bg-green" : tone === "warning" ? "bg-amber" : "bg-muted";

  return (
    <Card className="mb-5">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden />
        <h2 className="font-display text-[18px] font-semibold text-dark">
          {title}
        </h2>
        <span className="text-[13px] text-muted">({rows.length})</span>
      </div>
      <p className="mb-3 mt-1 max-w-[70ch] text-[12px] leading-snug text-muted">
        {hint}
      </p>

      <ul className="divide-y divide-black/5">
        {rows.map((r) => (
          <li key={r.user_id} className="py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <span className="text-[14.5px] font-semibold text-dark">
                  {r.display_name}
                </span>
                {r.profile_name && r.profile_name !== r.display_name && (
                  <span className="ml-2 text-[12px] text-muted">
                    {r.profile_name}
                  </span>
                )}
                {r.want_reminder && (
                  <span className="ml-2 rounded bg-amber/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber">
                    acepta que lo contacten
                  </span>
                )}
              </div>
              <div className="text-[13.5px] text-dark">
                <strong>{formatMoney(r.paid, r.currency)}</strong>
                <span className="text-muted">
                  {" "}
                  de {formatMoney(r.amount, r.currency)}
                </span>
              </div>
            </div>

            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11.5px] text-muted">
              {r.email && <span>{r.email}</span>}
              {r.lastPaymentDate && (
                <span>Último aporte: {r.lastPaymentDate}</span>
              )}
              {r.byFund.length > 0 && (
                <span>
                  {r.byFund
                    .map(
                      (f) => `${f.fund}: ${formatMoney(f.amount, f.currency)}`
                    )
                    .join(" · ")}
                </span>
              )}
              {r.otherCurrency.length > 0 && (
                <span>
                  Además, en otra moneda:{" "}
                  {r.otherCurrency
                    .map((c) => formatMoney(c.amount, c.currency))
                    .join(" · ")}
                </span>
              )}
              {r.payments.length === 0 && r.linked && (
                <span>Sin aportes registrados en {monthLabel(month)}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
