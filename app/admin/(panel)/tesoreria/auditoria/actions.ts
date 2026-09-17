"use server";

import { revalidatePath } from "next/cache";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { runAudit } from "@/lib/treasury-audit";
import { loadAuditInput } from "@/lib/treasury-audit-server";

/**
 * Los dos actions de la auditoría: despachar un hallazgo y guardar una
 * corrida.
 *
 * ⚠️ Ninguno recibe hallazgos del cliente. Guardar una corrida la vuelve
 * a CALCULAR en el servidor: lo que se archiva como evidencia no puede
 * depender de lo que el navegador dijo que vio.
 */

type Result = { ok: boolean; error: string | null };
const ok: Result = { ok: true, error: null };
const fail = (error: string): Result => ({ ok: false, error });

function str(formData: FormData, key: string): string {
  return ((formData.get(key) as string) || "").trim();
}

function friendly(error: { code?: string; message: string }): string {
  if (error.code === "42P01" || error.code === "42703") {
    return "Falta aplicar la migración 059 en la base.";
  }
  return error.message;
}

function revalidate() {
  revalidatePath("/admin/tesoreria/auditoria");
}

/**
 * Marca un hallazgo como corregido o como que no aplica, o lo devuelve a
 * pendiente.
 *
 * Se guarda por CLAVE de hallazgo y no por corrida: es lo que hace que un
 * hallazgo despachado no vuelva a gritar en la corrida siguiente. Volver
 * a 'pendiente' no borra la fila, así que queda el registro de quién lo
 * había marcado y cuándo.
 */
export async function dispatchFindingAction(formData: FormData): Promise<Result> {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const key = str(formData, "key");
  const code = str(formData, "code");
  const status = str(formData, "status");

  if (!key || !code) return fail("Falta identificar el hallazgo.");
  if (status !== "pendiente" && status !== "corregido" && status !== "no_aplica") {
    return fail("Estado inválido.");
  }

  const reason = str(formData, "reason");
  // Decir que algo no corresponde sin explicar por qué es exactamente lo
  // que una auditoría no acepta. La base lo exige por constraint; acá el
  // aviso llega en palabras y antes.
  if (status === "no_aplica" && reason.length < 5) {
    return fail("Escribí por qué este hallazgo no aplica.");
  }

  const { error } = await supabase.from("treasury_audit_dispositions").upsert(
    {
      locality_id: session.locality.id,
      finding_key: key,
      code,
      status,
      reason: status === "no_aplica" ? reason : reason || null,
      decided_by: session.profile.id,
      decided_at: new Date().toISOString(),
    },
    { onConflict: "locality_id,finding_key" }
  );

  if (error) return fail(friendly(error));

  revalidate();
  return ok;
}

/**
 * Archiva la corrida actual como evidencia: "el 17 de setiembre el libro
 * estaba así". No cambia nada del libro; solo deja el registro.
 */
export async function saveAuditRunAction(formData: FormData): Promise<Result> {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const rawYear = str(formData, "year");
  const bahaiYear = rawYear ? Number(rawYear) : undefined;
  if (rawYear && !Number.isFinite(bahaiYear)) return fail("Ejercicio inválido.");

  const { input } = await loadAuditInput(
    supabase,
    {
      id: session.locality.id,
      name: session.locality.name,
      kind: session.locality.kind === "nacional" ? "nacional" : "ael",
    },
    { bahaiYear }
  );
  const result = runAudit(input);

  const { error } = await supabase.from("treasury_audits").insert({
    locality_id: session.locality.id,
    period_from: input.from,
    period_to: input.to,
    bahai_year: input.bahaiYear,
    findings: result.findings,
    findings_count: result.counts.total,
    high_count: result.counts.alta,
    medium_count: result.counts.media,
    low_count: result.counts.baja,
    run_by: session.profile.id,
  });

  if (error) return fail(friendly(error));

  revalidate();
  return ok;
}
