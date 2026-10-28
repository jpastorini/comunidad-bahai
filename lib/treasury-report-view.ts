import "server-only";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { approverTitle, institutionLine } from "@/lib/institution";
import { getReceiptLegal } from "@/lib/treasury-ledger";
import { getReport } from "@/lib/treasury-reports";

/**
 * Un informe de Tesorería tal como lo abre la Asamblea: la página
 * (/admin/informe/[id]) y su PDF (/admin/informe/[id]/pdf) pasan por acá
 * para que el archivo que viaja por WhatsApp no pueda abrirse en un caso
 * en que la página no.
 *
 * NO exige el tag de Tesorería: un informe interno lo tiene que poder
 * abrir cualquier miembro de la Asamblea para aprobarlo. Quién ve qué lo
 * decide la RLS (043): si la fila no es visible, `null`.
 */
export async function loadViewableReport(id: string) {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();

  const report = await getReport(supabase, id);
  if (!report) return null;
  // El de otra localidad solo si una estructura se lo presentó a esta
  // Asamblea (084); la RLS ya no lo devolvería en otro caso, pero el admin
  // nacional lo lee todo y no tiene por qué abrirlo desde acá.
  const own = report.locality_id === session.locality.id;
  if (!own) {
    const { data: presented } = await supabase
      .from("structure_reports")
      .select("id")
      .eq("treasury_report_id", report.id)
      .eq("parent_id", session.locality.id)
      .eq("status", "presentado")
      .maybeSingle();
    if (!presented) return null;
  }

  // Quién emite y quién aprueba: la Asamblea con su nombre registrado, o
  // la estructura (082) y la Asamblea de la que depende. Es la de QUIEN
  // EMITIÓ el informe, que en uno presentado no es la que mira.
  const emitter = own
    ? session.locality
    : ((await supabase.from("localities").select("*").eq("id", report.locality_id).maybeSingle())
        .data as typeof session.locality | null) ?? session.locality;
  const legal = await getReceiptLegal(supabase, report.locality_id);

  return {
    session,
    report,
    own,
    emitter,
    legal,
    institution: institutionLine(legal, emitter),
    approvedBy: approverTitle(legal, emitter),
    shared: {
      title: report.title,
      subtitle: report.subtitle,
      periodFrom: report.period_from,
      periodTo: report.period_to,
      snapshot: report.snapshot,
      editorial: report.editorial,
    },
  };
}
