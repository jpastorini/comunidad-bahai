import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportDeck } from "@/components/treasury/ReportDeck";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getReport } from "@/lib/treasury-reports";

/**
 * Vista previa del informe para el tesorero, tal cual la va a ver la
 * comunidad. Vive FUERA del grupo (panel) a propósito: el deck ocupa la
 * pantalla completa y el shell del admin (sidebar, header) le comería el
 * espacio y arruinaría la proyección.
 */
export const dynamic = "force-dynamic";

export default async function PreviewInformePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const report = await getReport(supabase, params.id);
  if (!report || report.locality_id !== session.locality.id) notFound();

  return (
    <>
      <ReportDeck
        report={{
          title: report.title,
          subtitle: report.subtitle,
          periodFrom: report.period_from,
          periodTo: report.period_to,
          snapshot: report.snapshot,
          editorial: report.editorial,
        }}
        localityName={session.locality.name}
      />
      <Link
        href={`/admin/tesoreria/informes/${report.id}`}
        className="fixed bottom-5 right-5 z-40 rounded-xl border border-black/10 bg-card/90 px-3.5 py-2 text-[12px] font-semibold text-dark shadow-card-elevated backdrop-blur hover:bg-bg"
      >
        {report.status === "published" ? "Editar" : "Volver al borrador"}
      </Link>
    </>
  );
}
