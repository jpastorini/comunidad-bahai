import Link from "next/link";
import { PageHeader } from "@/components/admin/ui";
import { ReportRegistry } from "@/components/treasury/ReportRegistry";
import { requireAdmin } from "@/lib/auth";
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

  const all = await getAdminReports(supabase, session.locality.id);
  const published = all.filter((r) => r.status === "published");
  const esTesorero = session.profile.can_manage_treasury;

  return (
    <>
      <PageHeader
        eyebrow="Tesorería"
        title="Informes de Tesorería"
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
        internos={published.filter((r) => r.audience === "internos")}
        comunidad={published.filter((r) => r.audience === "comunidad")}
        esTesorero={esTesorero}
        borradores={all.filter((r) => r.status === "draft").length}
      />
    </>
  );
}
