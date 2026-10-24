import Link from "next/link";
import { TREASURY_HELP } from "@/lib/treasury-help";
import { Card, PageHeader } from "@/components/admin/ui";
import { StatusChip } from "@/components/admin/StructureReportView";
import { ReportRegistry } from "@/components/treasury/ReportRegistry";
import { requireAdmin } from "@/lib/auth";
import { getReportsPresentedTo } from "@/lib/structure-reports";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getAdminReports } from "@/lib/treasury-reports";

/**
 * Registro de informes de Tesorería para la Asamblea. SOLO LECTURA.
 *
 * Es la contracara de `/admin/tesoreria/informes`: ahí el tesorero crea,
 * edita, publica y borra; acá cualquier miembro de la Asamblea consulta
 * qué informes existen, cuándo se emitieron y cuáles están aprobados. Por
 * eso esta pantalla NO exige el tag `can_manage_treasury`.
 *
 * Qué informes ve cada uno lo decide la RLS (migración 044), no este
 * archivo: un miembro sin el tag ve los internos emitidos y los de
 * comunidad publicados, nunca un borrador.
 *
 * Solo se listan los EMITIDOS: un borrador todavía no es un documento de
 * la Asamblea, y quien lo puede ver (el tesorero) lo tiene en su propia
 * pantalla.
 */
export const dynamic = "force-dynamic";

export default async function RegistroInformesPage() {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();

  const [all, presented] = await Promise.all([
    getAdminReports(supabase, session.locality.id),
    // Lo que le presentaron sus estructuras (084): su única ventana a ellas.
    getReportsPresentedTo(supabase, session.locality.id),
  ]);
  const published = all.filter((r) => r.status === "published");
  const esTesorero = session.profile.can_manage_treasury;

  return (
    <>
      <PageHeader
        eyebrow="Asamblea"
        help={TREASURY_HELP.screens.registroInformes}
        title="Registro de informes"
        description="Registro de los informes emitidos por la Tesorería. Solo consulta: se editan desde la sección Tesorería."
        actions={
          esTesorero ? (
            <Link
              href="/admin/tesoreria/informes"
              className="tap rounded-xl border border-black/10 bg-card px-4 py-2 text-[13px] font-semibold text-dark hover:bg-bg"
            >
              Editar informes
            </Link>
          ) : undefined
        }
      />

      <ReportRegistry
        // El balance anual también se aprueba en reunión: va con las hojas
        // de la Asamblea, no con el deck de la Fiesta.
        internos={published.filter((r) => r.audience !== "comunidad")}
        comunidad={published.filter((r) => r.audience === "comunidad")}
        esTesorero={esTesorero}
        borradores={all.filter((r) => r.status === "draft").length}
      />

      {presented.length > 0 && (
        <Card className="mt-6">
          <h2 className="font-display text-[18px] font-semibold text-dark">
            Presentados por las estructuras
          </h2>
          <p className="mt-1 text-[13px] text-muted">
            Los informes de actividad y de Tesorería de los Comités, Departamentos e
            Instituto. Abrí cada uno para registrar en qué reunión se aprobó.
          </p>
          <ul className="mt-3 divide-y divide-black/[0.05]">
            {presented.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/informes/presentados/${r.id}`}
                  className="flex flex-wrap items-center gap-3 py-3 hover:text-terra"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">
                      {r.structure?.name ?? "Estructura"} ·{" "}
                      {r.kind === "tesoreria" ? "Tesorería" : "Actividad"}
                    </span>
                    <span className="block font-display text-[16px] font-semibold text-dark">
                      {r.title}
                    </span>
                  </span>
                  <StatusChip report={r} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
