import { ContactButtons } from "@/components/admin/chat/ContactButtons";
import { TREASURY_HELP } from "@/lib/treasury-help";
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
import { formatDate } from "@/lib/format";
import { PrintButton } from "@/components/admin/PrintButton";
import { getLedgerCatalog, todayISO } from "@/lib/treasury-ledger";
import { isNationalLocality } from "@/lib/types";
import { commitmentQuoteOfMonth } from "@/lib/reminders";
import { reminderText, thanksText, whatsappLink } from "@/lib/commitment-whatsapp";
import { CommitmentRowActions, NewCommitment } from "./commitment-editor";

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
  const [report, catalog, probe] = await Promise.all([
    getCommitmentMonthReport(supabase, session.locality.id, month),
    getLedgerCatalog(supabase, session.locality.id, {
      nationwide: isNationalLocality(session.locality),
    }),
    // ¿Corrió la 077? Sin ella no hay columna id ni se puede registrar.
    supabase.from("treasury_commitments").select("id").limit(1),
  ]);
  const canRegister = !report.schemaMissing && !probe.error;
  // La misma cita que el push del 10 de ESTE mes.
  const quote = commitmentQuoteOfMonth();

  // Los últimos 12 meses para elegir, del más nuevo al más viejo.
  const options: string[] = [];
  let cursor = thisMonth;
  for (let i = 0; i < 12; i++) {
    options.push(cursor);
    cursor = previousMonthKey(cursor);
  }
  if (!options.includes(month)) options.unshift(month);

  const noAportaron = report.rows.filter((r) => r.status === "pendiente");
  const parciales = report.rows.filter((r) => r.status === "parcial");
  const cumplidos = report.rows.filter((r) => r.status === "cumplido");
  const sinVinculo = report.rows.filter((r) => r.status === "sin_vinculo");

  return (
    <div className="cb-compromisos">
      <style>{PRINT_CSS}</style>
      <PageHeader
        eyebrow="Tesorería"
        help={TREASURY_HELP.screens.compromisos}
        title="Compromisos"
        description={`Cómo viene ${monthLabel(month)} respecto de lo que cada creyente declaró aportar. Es información reservada del tesorero.`}
        actions={<PrintButton label="Imprimir / PDF" />}
      />

      {report.schemaMissing && (
        <div className="mb-4">
          <Banner tone="warning">
            Falta aplicar la migración <strong>063</strong> en Supabase. Hasta
            entonces esta pantalla no puede leer los compromisos.
          </Banner>
        </div>
      )}

      <Card className="cb-noprint mb-5">
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

      {!report.schemaMissing && !canRegister && (
        <div className="mb-4">
          <Banner tone="warning">
            Falta aplicar la migración <strong>077</strong> en Supabase para
            registrar compromisos desde acá.
          </Banner>
        </div>
      )}

      {canRegister && (
        <Card className="cb-noprint mb-5">
          <NewCommitment contributors={catalog.contributors} members={catalog.members} />
          <p className="mt-2 max-w-[70ch] text-[11.5px] leading-snug text-muted">
            Para quien te lo pidió de palabra. Si la persona usa la app, el
            compromiso es suyo igual que si lo hubiera declarado ella; si no, lo
            ves acá cada mes y le recordás vos.
          </p>
        </Card>
      )}

      {report.rows.length === 0 && !report.schemaMissing && (
        <Card className="mb-5">
          <p className="text-[13.5px] text-muted">
            Todavía no hay compromisos mensuales en esta comunidad. Los
            creyentes los declaran desde Tesorería, en la app, y vos podés
            registrar los que te dicen de palabra.
          </p>
        </Card>
      )}

      <Group
        title="No aportaron"
        hint={`No figura ningún aporte suyo en ${monthLabel(month)}. Al lado, el último que hay en el libro, de cualquier mes. Si lo cargaste y no aparece acá, fijate que el aporte esté a nombre de la misma ficha.`}
        rows={noAportaron}
        tone="danger"
        month={month}
        viewerId={session.user.id}
        quote={quote}
      />

      <Group
        title="Aportaron menos de lo que se propusieron"
        hint={`Aportaron en ${monthLabel(month)}, pero todavía no llegan a lo que declararon. Al lado, cuánto falta y el último aporte.`}
        rows={parciales}
        tone="warning"
        month={month}
        viewerId={session.user.id}
        quote={quote}
      />

      <Group
        title="Para llamar y agradecer"
        hint="Ya cubrieron lo que declararon este mes."
        rows={cumplidos}
        tone="ok"
        month={month}
        viewerId={session.user.id}
        quote={quote}
      />

      <Group
        title="No se puede saber"
        hint="Lo declararon desde la app y nadie en el libro apunta a su perfil, así que sus aportes no se pueden reconocer. Se vincula en Tesorería → Contribuyentes (filtro «Sin vincular»)."
        rows={sinVinculo}
        tone="neutral"
        month={month}
        viewerId={session.user.id}
        quote={quote}
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
    </div>
  );
}

/** Al imprimir sale solo el reporte: sin el menú del panel, el selector
 *  de mes, el alta ni los botones de cada fila. */
const PRINT_CSS = `
@media print {
  @page { size: A4 portrait; margin: 14mm; }
  body * { visibility: hidden; }
  .cb-compromisos, .cb-compromisos * { visibility: visible; }
  .cb-compromisos { position: absolute; left: 0; top: 0; width: 100%; }
  .cb-compromisos .cb-noprint { display: none !important; }
  .cb-compromisos li { break-inside: avoid; }
  .cb-compromisos a { color: inherit; text-decoration: none; }
}
`;

function Group({
  title,
  hint,
  rows,
  tone,
  month,
  viewerId,
  quote,
}: {
  title: string;
  hint: string;
  rows: CommitmentRow[];
  tone: "ok" | "warning" | "danger" | "neutral";
  month: string;
  viewerId: string;
  quote: string;
}) {
  if (rows.length === 0) return null;
  const dot =
    tone === "ok"
      ? "bg-green"
      : tone === "warning"
        ? "bg-amber"
        : tone === "danger"
          ? "bg-rose-500"
          : "bg-muted";

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
          <li key={r.key} className="py-3">
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
                {!r.user_id && (
                  <span className="ml-2 rounded bg-black/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                    no está en la app
                  </span>
                )}
                {r.by_treasurer && (
                  <span className="ml-2 text-[10.5px] text-muted">
                    registrado por Tesorería
                  </span>
                )}
              </div>
              <div className="text-right text-[13.5px] text-dark">
                <strong>{formatMoney(r.paid, r.currency)}</strong>
                <span className="text-muted">
                  {" "}
                  de {formatMoney(r.amount, r.currency)}
                </span>
                {r.status === "parcial" && (
                  <div className="text-[12px] font-semibold text-amber">
                    Falta {formatMoney(r.amount - r.paid, r.currency)}
                  </div>
                )}
              </div>
            </div>

            {r.linked && r.status !== "cumplido" && (
              <div className="mt-1 text-[12.5px] text-dark">
                {r.lastEver ? (
                  <>
                    Último aporte:{" "}
                    <strong>{formatDate(r.lastEver.entry_date)}</strong> ·{" "}
                    <strong>
                      {formatMoney(r.lastEver.amount, r.lastEver.currency)}
                    </strong>
                    <span className="text-muted">
                      {" "}
                      ({sinceLabel(r.lastEver.entry_date, todayISO())})
                    </span>
                  </>
                ) : (
                  <span className="text-rose-700">
                    No hay ningún aporte suyo en el libro.
                  </span>
                )}
              </div>
            )}

            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11.5px] text-muted">
              {r.email && <span>{r.email}</span>}
              {r.phone && <span>{r.phone}</span>}
              {r.status === "cumplido" && r.lastPaymentDate && (
                <span>Último aporte: {formatDate(r.lastPaymentDate)}</span>
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
            </div>
            {/* Recordar o agradecer por el chat de Tesorería, sin esperar
                a que la persona escriba (lib/chat-contact.ts). */}
            <div className="cb-noprint mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              {r.user_id && r.user_id !== viewerId && (
                <ContactButtons
                  memberId={r.user_id}
                  topics={["tesoreria"]}
                  size="sm"
                  labels={{ tesoreria: "Escribirle" }}
                />
              )}
              <WhatsAppButton row={r} month={month} quote={quote} />
              {r.id && (
                <CommitmentRowActions
                  initial={{
                    id: r.id,
                    display_name: r.display_name,
                    amount: String(r.amount).replace(".", ","),
                    currency: r.currency === "USD" ? "USD" : "UYU",
                    phone: r.phone ?? "",
                    want_reminder: r.want_reminder,
                  }}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** "hace 12 días", "hace 3 meses": cuánto hace del último aporte, para
 *  distinguir de un vistazo al que se atrasó del que dejó de aportar. */
function sinceLabel(dateISO: string, todayIso: string): string {
  const days = Math.round(
    (Date.parse(todayIso) - Date.parse(dateISO)) / 86_400_000
  );
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 45) return `hace ${days} días`;
  const months = Math.round(days / 30.44);
  if (months < 18) return `hace ${months} meses`;
  const years = Math.floor(months / 12);
  return years === 1 ? "hace más de un año" : `hace más de ${years} años`;
}

/**
 * Recordar o agradecer por WhatsApp con el mensaje escrito (077). Recordar
 * solo a quien pidió que se le recuerde —es el mismo permiso que el push
 * del 10—; agradecer, a todos. Sin teléfono no se ofrece.
 */
function WhatsAppButton({
  row,
  month,
  quote,
}: {
  row: CommitmentRow;
  month: string;
  quote: string;
}) {
  const remind = row.status === "pendiente" || row.status === "parcial";
  const thank = row.status === "cumplido";
  if (!remind && !thank) return null;
  if (remind && !row.want_reminder) return null;
  const href = whatsappLink(
    row.phone,
    remind ? reminderText(row.display_name, quote) : thanksText(row.display_name, monthLabel(month))
  );
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366]/15 px-2.5 py-1 text-[12px] font-semibold text-[#128C7E] hover:bg-[#25D366]/25"
    >
      {remind ? "Recordar por WhatsApp" : "Agradecer por WhatsApp"}
    </a>
  );
}
