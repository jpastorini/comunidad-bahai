import Link from "next/link";
import { notFound } from "next/navigation";
import { BalanceSheet } from "@/components/treasury/BalanceSheet";
import { ReportDeck } from "@/components/treasury/ReportDeck";
import { ReportSheet } from "@/components/treasury/ReportSheet";
import { loadViewableReport } from "@/lib/treasury-report-view";

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
 * La regla vive en loadViewableReport(), que comparte con el PDF de la
 * hoja interna.
 */
export const dynamic = "force-dynamic";

export default async function VerInformePage({
  params,
}: {
  params: { id: string };
}) {
  const view = await loadViewableReport(params.id);
  if (!view) notFound();
  const { session, report, own, emitter, legal, institution, approvedBy, shared } = view;

  // Solo el tesorero puede volver al editor; para el resto de la
  // Asamblea el informe es de lectura.
  const canEdit = own && session.profile.can_manage_treasury;
  // La salida, para TODOS: esta pantalla no tiene el menú del panel y en
  // la PWA instalada no hay botón atrás. El tesorero vuelve a su taller;
  // el resto de la Asamblea, al Registro de informes.
  const back = canEdit
    ? { href: "/admin/tesoreria/informes", label: "Informes" }
    : { href: "/admin/informes", label: "Informes" };

  const topBar = (
    <div className="mx-auto mb-3 flex max-w-[820px] items-center justify-between gap-3 text-[12.5px] font-semibold cb-noprint">
      <Link href={back.href} className="text-terra hover:underline">
        ← {back.label}
      </Link>
      {canEdit && (
        <Link
          href={`/admin/tesoreria/informes/${report.id}`}
          className="text-terra hover:underline"
        >
          Volver al editor
        </Link>
      )}
    </div>
  );

  if (report.audience === "balance") {
    // Los datos fiscales del encabezado (nombre registrado, RUT,
    // domicilio). La ficha legal la lee cualquier admin de la localidad.
    return (
      <div
        className="min-h-dvh bg-bg px-4 pb-6 sm:px-8"
        style={{ paddingTop: "calc(var(--safe-top) + 24px)" }}
      >
        {topBar}
        <BalanceSheet
          report={shared}
          localityName={emitter.name}
          legal={legal}
          emittedBy={report.editorial.signature?.name ?? null}
        />
      </div>
    );
  }

  if (report.audience === "internos") {
    return (
      <div
        className="min-h-dvh bg-bg px-4 pb-6 sm:px-8"
        style={{ paddingTop: "calc(var(--safe-top) + 24px)" }}
      >
        {topBar}
        <ReportSheet
          report={shared}
          localityName={emitter.name}
          institution={institution}
          approvedBy={approvedBy}
          emittedBy={report.editorial.signature?.name ?? null}
          reportId={report.id}
        />
      </div>
    );
  }

  return (
    <>
      <ReportDeck
        report={shared}
        localityName={emitter.name}
        institution={institution}
        back={back}
      />
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
