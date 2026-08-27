import Link from "next/link";
import { Banner, Card, PageHeader } from "@/components/admin/ui";
import { ShareReportButton } from "@/components/treasury/ShareReportButton";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { fmtAmount, fmtDayMonth, primaryCurrency } from "@/lib/treasury-report-content";
import { getAdminReports, type TreasuryReport } from "@/lib/treasury-reports";
import { ConfirmSubmit } from "../../miembros/confirm-submit";
import { deleteReportAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function InformesTesoreriaPage() {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const reports = await getAdminReports(supabase, session.locality.id);
  const drafts = reports.filter((r) => r.status === "draft");
  const published = reports.filter((r) => r.status === "published");

  return (
    <>
      <PageHeader
        eyebrow="Tesorería"
        title="Informes"
        description="El informe que se presenta en la Fiesta: elegís el período y las cifras salen del libro."
        actions={
          <Link
            href="/admin/tesoreria/informes/nuevo"
            className="tap rounded-xl bg-terra px-4 py-2 text-[13px] font-semibold text-white shadow-card-soft"
          >
            + Nuevo informe
          </Link>
        }
      />

      {reports.length === 0 && (
        <Card>
          <p className="py-6 text-center text-[13px] text-muted">
            Todavía no hay informes. Creá el primero: elegís desde y hasta qué
            fecha, y la app arma las contribuciones, los egresos, los saldos por
            fondo y por cuenta con los movimientos del libro.
          </p>
        </Card>
      )}

      {drafts.length > 0 && <Group title="Borradores" reports={drafts} />}
      {published.length > 0 && <Group title="Publicados" reports={published} />}

      {published.length > 0 && (
        <Banner tone="info">
          El link de un informe publicado se abre sin login y no lleva nombres
          de contribuyentes: solo número de recibo, fecha y monto. Si lo
          despublicás, el link deja de funcionar.
        </Banner>
      )}
    </>
  );
}

function Group({ title, reports }: { title: string; reports: TreasuryReport[] }) {
  return (
    <div className="mb-6">
      <h2 className="mb-2.5 flex items-center gap-2 font-display text-[18px] font-semibold text-dark">
        {title}
        <span className="rounded-full bg-black/10 px-2 py-0.5 text-[11px] font-bold text-muted">
          {reports.length}
        </span>
      </h2>
      <div className="grid gap-3">
        {reports.map((r) => (
          <ReportCard key={r.id} report={r} />
        ))}
      </div>
    </div>
  );
}

function ReportCard({ report: r }: { report: TreasuryReport }) {
  const s = r.snapshot;
  const main = primaryCurrency([...s.income, ...s.expenses]);
  const income = s.income.find((m) => m.currency === main);
  const expense = s.expenses.find((m) => m.currency === main);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-display text-[16px] font-semibold text-dark">
              {r.title}
            </div>
            {r.status === "published" ? (
              <span className="rounded bg-terra/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-terra">
                Publicado
              </span>
            ) : (
              <span className="rounded bg-black/[0.07] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted">
                Borrador
              </span>
            )}
          </div>
          <div className="mt-1 text-[11.5px] text-muted">
            {fmtDayMonth(r.period_from)} al {fmtDayMonth(r.period_to)}
            {r.bahai_year && ` · ${r.bahai_year} E.B.`}
            {" · "}
            {income ? `+${fmtAmount(income.amount, main)}` : "sin ingresos"}
            {expense ? ` / −${fmtAmount(expense.amount, main)}` : ""}
          </div>
          <div className="mt-0.5 text-[11px] text-muted">
            {r.status === "published" && r.published_at
              ? `Publicado el ${formatDate(r.published_at)}`
              : `Actualizado el ${formatDate(r.updated_at)}`}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {r.status === "published" && (
            <ShareReportButton token={r.share_token} title={r.title} />
          )}
          <Link
            href={`/admin/informe/${r.id}`}
            target="_blank"
            className="tap rounded-xl border border-black/10 bg-card px-3.5 py-2 text-[12.5px] font-semibold text-dark hover:bg-bg"
          >
            Ver
          </Link>
          <Link
            href={`/admin/tesoreria/informes/${r.id}`}
            className="tap rounded-xl border border-black/10 bg-card px-3.5 py-2 text-[12.5px] font-semibold text-dark hover:bg-bg"
          >
            Editar
          </Link>
          <form action={deleteReportAction}>
            <input type="hidden" name="id" value={r.id} />
            <ConfirmSubmit
              message={`¿Borrar el informe "${r.title}"? Esta acción no se puede deshacer.`}
              className="tap rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-[12.5px] font-semibold text-rose-600 hover:bg-rose-100"
            >
              Borrar
            </ConfirmSubmit>
          </form>
        </div>
      </div>
    </Card>
  );
}
