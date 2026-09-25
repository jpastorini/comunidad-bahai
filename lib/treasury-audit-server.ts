import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAssemblyData } from "./assembly";
import { findBudgetForYear } from "./budget-lookup";
import { activeMembers, getLocalityMembers } from "./memberships";
import { todayISO } from "./treasury-ledger";
import { treasuryYearEnd, treasuryYearForDate, treasuryYearStart } from "./treasury-year";
import type {
  AuditAttachment,
  AuditBudget,
  AuditCatalog,
  AuditClosing,
  AuditEntry,
  AuditGoal,
  AuditInput,
  AuditLegal,
  AuditReport,
  Finding,
} from "./treasury-audit";

/**
 * El cargador de la auditoría: arma el `AuditInput` que consumen las
 * reglas puras de `lib/treasury-audit.ts`.
 *
 * Toda la parte sucia vive acá —las consultas, la RLS, los defaults— para
 * que las reglas sigan siendo funciones puras que se pueden correr con
 * datos inventados. Es el mismo reparto que `buildCashbook()` contra
 * `getCashbookEntries()`.
 *
 * Dos cosas que este módulo tiene que hacer bien o las reglas mienten:
 *
 *  · Trae TODO el libro hasta la fecha de corte, no solo el rango
 *    auditado. Los saldos son acumulados y la serie de recibos no empieza
 *    donde empieza el rango: con solo el rango, la regla de huecos
 *    inventaría uno en cada borde.
 *
 *  · ⚠️ El tag de Tesorería sale de la MEMBRESÍA (`locality_members()`,
 *    055), no de `profiles`. El tesorero nacional lo tiene en la Comunidad
 *    Nacional y no en su Asamblea Local: preguntárselo al sombrero puesto
 *    haría que la auditoría lo declare sin permisos cada vez que ande con
 *    el otro. Es el mismo arrastre que la 058 corrigió en `my_receipt()`.
 */

// Literal y no un array con join: el cliente de Supabase infiere el tipo
// de la fila desde la CADENA del select, y con un join pierde el rastro.
const ENTRY_FIELDS =
  "id, entry_date, bahai_year, account_id, subcategory_id, category_id, fund_id, currency, amount, description, receipt_number, contributions_count, contributor_id, receipt_issued, receipt_issued_at, transfer_group_id, is_opening_balance, voided_at, void_reason, adjusts_entry_id, adjustment_reason, created_at, updated_at";

export type LoadAuditOptions = {
  /** Ejercicio contable a auditar. Por defecto, el que corre hoy. */
  bahaiYear?: number;
  /**
   * Verificar que cada comprobante siga existiendo en el bucket. Es la
   * única parte que sale a Storage y cuesta una consulta por movimiento
   * con adjuntos, así que va apagada salvo en la auditoría completa.
   */
  checkStorage?: boolean;
};

export type LoadedAudit = {
  input: AuditInput;
  /** Ejercicios con movimientos, para el selector. */
  years: number[];
  /** Falta correr la 059: la pantalla lo avisa y no guarda nada. */
  ready: boolean;
};

export async function loadAuditInput(
  supabase: SupabaseClient,
  locality: { id: string; name: string; kind: "ael" | "nacional" },
  options: LoadAuditOptions = {}
): Promise<LoadedAudit> {
  const today = todayISO();
  const currentYear = treasuryYearForDate(today) ?? new Date().getUTCFullYear() - 1843;
  const bahaiYear = options.bahaiYear ?? currentYear;

  const from = treasuryYearStart(bahaiYear) ?? `${bahaiYear + 1843}-04-21`;
  const yearEnd = treasuryYearEnd(bahaiYear) ?? `${bahaiYear + 1844}-04-20`;
  // Nunca se audita el futuro: el corte es hoy si el ejercicio está en
  // curso, o su último día si ya terminó.
  const to = yearEnd < today ? yearEnd : today;

  const [
    entriesRes,
    accountsRes,
    fundsRes,
    categoriesRes,
    subcategoriesRes,
    contributorsRes,
    attachmentsRes,
    closingsRes,
    reportsRes,
    goalsRes,
    legalRes,
    yearsRes,
  ] = await Promise.all([
    supabase
      .from("treasury_entries")
      .select(ENTRY_FIELDS)
      .lte("entry_date", to)
      .order("entry_date", { ascending: true }),
    supabase.from("treasury_accounts").select("id, name, is_active"),
    supabase.from("treasury_funds").select("id, name, is_active"),
    supabase.from("treasury_categories").select("id, name, is_active"),
    supabase.from("treasury_subcategories").select("id, name, category_id, is_active"),
    supabase.from("treasury_contributors").select("id, name, kind, profile_id, is_active"),
    supabase.from("treasury_attachments").select("id, entry_id, storage_path, amount"),
    supabase
      .from("treasury_closings")
      .select("id, period_month, status, closed_at, snapshot, reopened_at, reopen_reason")
      .order("period_month", { ascending: true }),
    supabase
      .from("treasury_reports")
      .select(
        "id, title, audience, status, period_from, period_to, updated_at, editorial, snapshot"
      ),
    supabase
      .from("treasury_goals")
      // "*": con o sin la 068, goalLinks() lee lo que haya.
      .select("*"),
    supabase
      .from("assembly_records")
      .select("registered_name, rut, fiscal_address, statutes_path")
      .eq("locality_id", locality.id)
      .maybeSingle(),
    supabase.from("treasury_entries").select("bahai_year").not("bahai_year", "is", null),
  ]);

  if (entriesRes.error) console.error("[loadAuditInput] entries", entriesRes.error);

  const entries: AuditEntry[] = ((entriesRes.data ?? []) as AuditEntry[]).map((e) => ({
    ...e,
    amount: Number(e.amount),
  }));

  const catalog: AuditCatalog = {
    accounts: (accountsRes.data ?? []) as AuditCatalog["accounts"],
    funds: (fundsRes.data ?? []) as AuditCatalog["funds"],
    categories: (categoriesRes.data ?? []) as AuditCatalog["categories"],
    subcategories: (subcategoriesRes.data ?? []) as AuditCatalog["subcategories"],
    contributors: (contributorsRes.data ?? []) as AuditCatalog["contributors"],
  };

  const attachments: AuditAttachment[] = (
    (attachmentsRes.data ?? []) as AuditAttachment[]
  ).map((a) => ({ ...a, amount: a.amount == null ? null : Number(a.amount) }));

  const closings = (closingsRes.data ?? []) as AuditClosing[];
  const reports = (reportsRes.data ?? []) as AuditReport[];
  const goals = ((goalsRes.data ?? []) as AuditGoal[]).map((g) => ({
    ...g,
    target_amount: g.target_amount == null ? null : Number(g.target_amount),
  }));
  const legal = (legalRes.data ?? null) as AuditLegal;

  const years = [
    ...new Set(
      ((yearsRes.data ?? []) as Array<{ bahai_year: number }>).map((r) => r.bahai_year)
    ),
  ].sort((a, b) => b - a);

  // ─── Presupuesto ───────────────────────────────────────────────
  // ⚠️ Por findBudgetForYear() y no por .eq("bahai_year", …): el año es
  // opcional en el alta y hubo presupuestos guardados con la columna en
  // NULL que el tablero daba por inexistentes.
  const header = await findBudgetForYear(supabase, locality.id, bahaiYear);
  let budget: AuditBudget = null;
  if (header) {
    const { data: items } = await supabase
      .from("treasury_budget_items")
      // "*": con o sin la 067, budgetLinks() lee lo que haya.
      .select("*")
      .eq("budget_id", header.id);
    budget = {
      id: header.id,
      period: header.period,
      items: ((items ?? []) as NonNullable<AuditBudget>["items"]).map((i) => ({
        ...i,
        planned_amount: Number(i.planned_amount),
        spent_amount: Number(i.spent_amount),
      })),
    };
  }

  // ─── Padrón, tags y composición ────────────────────────────────
  const members = activeMembers(await getLocalityMembers(supabase, locality.id));
  const treasuryTagHolders = members
    .filter((m) => m.can_manage_treasury)
    .map((m) => m.id);

  // El universo del buscador de contribuyentes, igual que el del libro:
  // el padrón de la comunidad en una AEL, todo el país en la Nacional
  // (058), porque al Fondo Nacional gira gente de cualquier localidad.
  let roster: Array<{ id: string; full_name: string | null }> = members.map((m) => ({
    id: m.id,
    full_name: m.full_name,
  }));
  if (locality.kind === "nacional") {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .is("disabled_at", null);
    roster = (data ?? []) as Array<{ id: string; full_name: string | null }>;
  }

  const assemblyData = await getAssemblyData(supabase, locality.id, bahaiYear);
  const assembly = assemblyData.term
    ? {
        bahaiYear,
        members: assemblyData.term.members.map((m) => ({
          position: m.position,
          display_name: m.display_name,
          profile_id: m.profile_id,
          office: m.office,
        })),
      }
    : null;

  const missingAttachmentPaths = options.checkStorage
    ? await findMissingAttachments(supabase, locality.id, attachments)
    : undefined;

  return {
    input: {
      locality,
      from,
      to,
      bahaiYear,
      today,
      entries,
      catalog,
      attachments,
      closings,
      reports,
      budget,
      goals,
      legal,
      assembly,
      roster,
      treasuryTagHolders,
      missingAttachmentPaths,
    },
    years: years.length > 0 ? years : [bahaiYear],
    ready: true,
  };
}

/**
 * Qué comprobantes prometen un archivo que ya no está en el bucket.
 *
 * Storage lista por carpeta y no recursivamente, así que hay una consulta
 * por movimiento con adjuntos. Por eso corre solo cuando se pide: el
 * hallazgo es de gravedad baja y no justifica el costo en cada apertura
 * de la pantalla.
 */
async function findMissingAttachments(
  supabase: SupabaseClient,
  localityId: string,
  attachments: AuditAttachment[]
): Promise<string[]> {
  const byEntry = new Map<string, AuditAttachment[]>();
  for (const a of attachments) {
    const list = byEntry.get(a.entry_id) ?? [];
    list.push(a);
    byEntry.set(a.entry_id, list);
  }

  const missing: string[] = [];
  const entryIds = [...byEntry.keys()];
  const CHUNK = 10;

  for (let i = 0; i < entryIds.length; i += CHUNK) {
    const slice = entryIds.slice(i, i + CHUNK);
    await Promise.all(
      slice.map(async (entryId) => {
        const folder = `${localityId}/${entryId}`;
        const { data, error } = await supabase.storage
          .from("treasury-receipts")
          .list(folder, { limit: 100 });
        // Si la consulta falla no se inventa un hallazgo: callar es mejor
        // que decir que falta un archivo que sí está.
        if (error) return;
        const present = new Set((data ?? []).map((f) => `${folder}/${f.name}`));
        for (const a of byEntry.get(entryId) ?? []) {
          if (!present.has(a.storage_path)) missing.push(a.storage_path);
        }
      })
    );
  }
  return missing;
}

// ─── Despacho y corridas guardadas ───────────────────────────────

export type Disposition = {
  finding_key: string;
  code: string;
  status: "pendiente" | "corregido" | "no_aplica";
  reason: string | null;
  decided_at: string;
};

/** Lo que la Asamblea ya decidió, por clave de hallazgo. */
export async function getDispositions(
  supabase: SupabaseClient
): Promise<Disposition[]> {
  const { data, error } = await supabase
    .from("treasury_audit_dispositions")
    .select("finding_key, code, status, reason, decided_at");
  if (error) {
    // Antes de la 059 la tabla no existe: la auditoría igual corre, sin
    // memoria de lo despachado.
    console.warn("[getDispositions]", error.message);
    return [];
  }
  return (data ?? []) as Disposition[];
}

export type SavedAudit = {
  id: string;
  run_at: string;
  findings_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  period_from: string;
  period_to: string;
  model: string | null;
};

/** Las últimas corridas guardadas, para el registro. */
export async function getRecentAudits(
  supabase: SupabaseClient,
  limit = 5
): Promise<SavedAudit[]> {
  const { data, error } = await supabase
    .from("treasury_audits")
    .select(
      "id, run_at, findings_count, high_count, medium_count, low_count, period_from, period_to, model"
    )
    .order("run_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[getRecentAudits]", error.message);
    return [];
  }
  return (data ?? []) as SavedAudit[];
}

/** Los hallazgos de una corrida guardada, para releerla. */
export function findingsOf(raw: unknown): Finding[] {
  return Array.isArray(raw) ? (raw as Finding[]) : [];
}
