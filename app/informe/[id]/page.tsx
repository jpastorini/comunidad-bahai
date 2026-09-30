import Link from "next/link";
import { notFound } from "next/navigation";
import { BalanceSheet } from "@/components/treasury/BalanceSheet";
import { ReportDeck } from "@/components/treasury/ReportDeck";
import { requireBahai } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getReceiptLegal } from "@/lib/treasury-ledger";
import { getReport } from "@/lib/treasury-reports";

/**
 * Un informe de Tesorería, para el creyente. Vive fuera del grupo (app)
 * porque el deck ocupa la pantalla entera (como /programa/[id]).
 *
 * Quién lo ve lo decide la RLS (054): un creyente de la localidad lee los
 * informes PUBLICADOS para la comunidad y la Memoria y Balance anual;
 * la hoja interna de la Asamblea nunca aparece acá. Si la fila no es
 * visible, la consulta vuelve vacía y esto es un 404.
 */
export const dynamic = "force-dynamic";

export default async function InformeComunidadPage({ params }: { params: { id: string } }) {
  const session = await requireBahai(`/informe/${params.id}`);
  const supabase = createSupabaseServer();
  const report = await getReport(supabase, params.id);
  if (!report || report.locality_id !== session.locality.id || report.status !== "published") notFound();
  if (report.audience === "internos") notFound();

  const shared = {
    title: report.title,
    subtitle: report.subtitle,
    periodFrom: report.period_from,
    periodTo: report.period_to,
    snapshot: report.snapshot,
    editorial: report.editorial,
  };

  if (report.audience === "balance") {
    // La ficha legal es admin-only por RLS: para el creyente sale vacía
    // y la hoja cae al nombre de la localidad, que es lo que corresponde.
    const legal = await getReceiptLegal(supabase, session.locality.id);
    return (
      <div className="min-h-dvh bg-bg px-4 py-6 sm:px-8">
        <div className="mx-auto mb-3 max-w-[820px] cb-noprint">
          <Link href="/tesoreria" className="text-[12.5px] font-semibold text-terra hover:underline">
            ← Volver a la Tesorería
          </Link>
        </div>
        <BalanceSheet
          report={shared}
          localityName={session.locality.name}
          legal={legal}
          emittedBy={report.editorial.signature?.name ?? null}
        />
      </div>
    );
  }

  return (
    <>
      <ReportDeck report={shared} localityName={session.locality.name} />
      <Link
        href="/tesoreria"
        className="fixed bottom-5 left-5 z-40 rounded-xl border border-black/10 bg-card/90 px-3.5 py-2 text-[12px] font-semibold text-dark shadow-card-elevated backdrop-blur hover:bg-bg"
      >
        ← Tesorería
      </Link>
    </>
  );
}
