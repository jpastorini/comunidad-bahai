import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportDeck } from "@/components/treasury/ReportDeck";
import { ReportSheet } from "@/components/treasury/ReportSheet";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getReport } from "@/lib/treasury-reports";

/**
 * El informe a pantalla completa. Vive FUERA del grupo (panel) a
 * propósito: el deck ocupa toda la pantalla y la hoja interna se imprime,
 * así que el shell del admin (sidebar, header) estorbaría en los dos
 * casos.
 *
 * Dos formatos según el destinatario:
 *   'comunidad' → deck de diapositivas (se proyecta en la Fiesta).
 *   'internos'  → hoja A4 para adjuntar al acta.
 *
 * Acceso: NO exige el tag de Tesorería, porque un informe interno lo
 * tiene que poder abrir cualquier miembro de la Asamblea para aprobarlo.
 * Quién ve qué lo decide la RLS (migración 043): si la fila no es
 * visible para este usuario, la query vuelve vacía y esto es un 404.
 */
export const dynamic = "force-dynamic";

export default async function VerInformePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();

  const report = await getReport(supabase, params.id);
  if (!report || report.locality_id !== session.locality.id) notFound();

  const shared = {
    title: report.title,
    subtitle: report.subtitle,
    periodFrom: report.period_from,
    periodTo: report.period_to,
    snapshot: report.snapshot,
    editorial: report.editorial,
  };

  // Solo el tesorero puede volver al editor; para el resto de la
  // Asamblea el informe es de lectura.
  const canEdit = session.profile.can_manage_treasury;

  if (report.audience === "internos") {
    return (
      <div className="min-h-dvh bg-bg px-4 py-6 sm:px-8">
        {canEdit && (
          <div className="mx-auto mb-3 max-w-[820px] cb-noprint">
            <Link
              href={`/admin/tesoreria/informes/${report.id}`}
              className="text-[12.5px] font-semibold text-terra hover:underline"
            >
              ← Volver al editor
            </Link>
          </div>
        )}
        <ReportSheet
          report={shared}
          localityName={session.locality.name}
          emittedBy={report.editorial.signature?.name ?? null}
        />
      </div>
    );
  }

  return (
    <>
      <ReportDeck report={shared} localityName={session.locality.name} />
      {canEdit && (
        <Link
          href={`/admin/tesoreria/informes/${report.id}`}
          className="fixed bottom-5 right-5 z-40 rounded-xl border border-black/10 bg-card/90 px-3.5 py-2 text-[12px] font-semibold text-dark shadow-card-elevated backdrop-blur hover:bg-bg"
        >
          {report.status === "published" ? "Editar" : "Volver al borrador"}
        </Link>
      )}
    </>
  );
}
