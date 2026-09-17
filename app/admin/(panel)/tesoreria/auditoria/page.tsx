import { Banner, Card, PageHeader } from "@/components/admin/ui";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { createSupabaseServer } from "@/lib/supabase/server";
import { RULES, ruleApplies, runAudit } from "@/lib/treasury-audit";
import {
  getDispositions,
  getRecentAudits,
  loadAuditInput,
} from "@/lib/treasury-audit-server";
import { AuditoriaClient, type FindingRow } from "./auditoria-client";

export const dynamic = "force-dynamic";

/**
 * Auditoría de Tesorería (059).
 *
 * La pantalla corre las reglas EN CADA APERTURA, porque son funciones
 * puras sobre datos ya cargados: no cuesta nada y siempre dice la verdad
 * de hoy. Guardar una corrida es un acto aparte y explícito, para dejar
 * la evidencia de cómo estaba el libro en una fecha.
 *
 * El modelo todavía no entra. Con esto solo ya es una herramienta: el
 * paso siguiente es pasarle estos mismos hallazgos para que los agrupe,
 * los priorice y los redacte.
 */
export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams?: { year?: string };
}) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const kind = session.locality.kind === "nacional" ? "nacional" : "ael";
  const asked = Number(searchParams?.year);
  const { input, years } = await loadAuditInput(
    supabase,
    { id: session.locality.id, name: session.locality.name, kind },
    { bahaiYear: Number.isFinite(asked) && asked > 0 ? asked : undefined }
  );

  const result = runAudit(input);
  const [dispositions, recent] = await Promise.all([
    getDispositions(supabase),
    getRecentAudits(supabase),
  ]);

  const byKey = new Map(dispositions.map((d) => [d.finding_key, d]));
  const pending: FindingRow[] = [];
  const dispatched: FindingRow[] = [];

  for (const f of result.findings) {
    const d = byKey.get(f.key);
    const row: FindingRow = {
      ...f,
      status: d?.status ?? "pendiente",
      reason: d?.reason ?? null,
      decidedAt: d?.decided_at ? formatDateTime(d.decided_at) : null,
    };
    if (row.status === "pendiente") pending.push(row);
    else dispatched.push(row);
  }

  const active = RULES.filter((r) => ruleApplies(r, kind)).length;
  const counts = {
    alta: pending.filter((f) => f.severity === "alta").length,
    media: pending.filter((f) => f.severity === "media").length,
    baja: pending.filter((f) => f.severity === "baja").length,
  };

  return (
    <>
      <PageHeader
        eyebrow="Tesorería"
        title="Auditoría"
        description={`${active} comprobaciones sobre el libro, los cierres y los informes, contra lo que piden el MEC, la DGI y los estatutos.`}
      />

      <div className="mb-4 space-y-3">
        <Banner tone="info">
          Todo lo que ves acá lo calcularon <strong>reglas deterministas</strong>,
          no un modelo: cada hallazgo sale de una consulta sobre el libro y
          apunta a los movimientos que lo motivan. Un hallazgo despachado no
          vuelve a aparecer en la próxima corrida.
        </Banner>
        {result.failed.length > 0 && (
          <Banner tone="warning">
            {result.failed.length} regla{result.failed.length === 1 ? "" : "s"} no
            pudo correr ({result.failed.map((f) => f.code).join(", ")}). Las demás
            sí: la auditoría no se detiene por una regla rota.
          </Banner>
        )}
        {kind === "nacional" && (
          <Banner tone="info">
            Estás auditando la <strong>Comunidad Nacional</strong>. Las reglas que
            salen del estatuto de una Asamblea Local o de la Fiesta de los 19 Días
            quedan apagadas: el estatuto de la AEN es otro y todavía no lo leímos.
          </Banner>
        )}
      </div>

      {input.entries.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-[13px] text-muted">
            El libro está vacío para este ejercicio. La auditoría igual revisa la
            ficha legal y la composición de la Asamblea.
          </p>
        </Card>
      ) : null}

      <AuditoriaClient
        pending={pending}
        dispatched={dispatched}
        counts={counts}
        year={input.bahaiYear}
        years={years}
        period={{ from: input.from, to: input.to }}
        recent={recent.map((r) => ({
          id: r.id,
          at: formatDateTime(r.run_at),
          total: r.findings_count,
          alta: r.high_count,
        }))}
      />
    </>
  );
}
