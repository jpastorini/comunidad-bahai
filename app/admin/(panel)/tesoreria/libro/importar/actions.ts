"use server";

import { revalidatePath } from "next/cache";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { readStatementRows } from "@/lib/bank-statements-read";
import {
  isParseFailure,
  parseLedgerSheet,
  planImport,
  type ImportPlan,
  type PlanOptions,
  type SheetRow,
} from "@/lib/ledger-import";
import {
  LEDGER_IMPORTS_BUCKET,
  buildLedgerContext,
  isLedgerImportSchemaMissing,
} from "@/lib/treasury-imports";

/**
 * Importar un ejercicio anterior al libro (062).
 *
 * Dos acciones, y la misma planilla viaja en las dos: la vista previa no
 * guarda nada y confirmar vuelve a leer el archivo desde cero. Podría
 * haberse guardado el plan entre una y otra, y no se hizo a propósito —
 * `parseLedgerSheet()` + `planImport()` son puros, así que volver a
 * correrlos sobre el mismo archivo da exactamente lo mismo, y de esa
 * forma no hay ningún estado intermedio que pueda quedar viejo entre lo
 * que la persona aprobó y lo que entra al libro.
 *
 * Lo que confirmar hace, en orden: crear el catálogo que falte (cuentas,
 * fondos, categorías, subcategorías) y los contribuyentes · crear el lote
 * · insertar los asientos de a 400. Si algo falla en el medio, deshace el
 * lote entero con `undo_ledger_import()` en vez de dejar medio ejercicio
 * cargado: medio libro es peor que ninguno, porque los saldos mienten sin
 * que nada lo delate.
 *
 * El archivo viaja dentro del form: una planilla de un año pesa unos KB y
 * el techo de una función de Vercel son 4,5 MB. Si alguna pesara más, va
 * directo a Storage desde el cliente (ver CLAUDE.md, estatutos).
 */

const MAX_BYTES = 4 * 1024 * 1024;
const CHUNK = 400;
const MIGRATION_MSG = "Falta aplicar la migración 062 (importar ejercicios anteriores).";
const NO_CATEGORY = "Sin categoría";

export type PreviewResult =
  | { ok: true; plan: ImportPlan; fileName: string }
  | { ok: false; error: string };

export type ConfirmResult =
  | { ok: true; entries: number; batchId: string; warning: string | null }
  | { ok: false; error: string };

export type Result = { ok: boolean; error: string | null };

type UploadedFile = {
  name: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

function isFile(v: unknown): v is UploadedFile {
  return (
    typeof v === "object" &&
    v !== null &&
    "arrayBuffer" in v &&
    typeof (v as UploadedFile).arrayBuffer === "function"
  );
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Los mensajes de los triggers de la 054 y de la 062 vienen con el
 *  código adelante; la persona solo necesita la frase. */
function friendly(message: string): string {
  const m = message.match(/^(MES_CERRADO|RECIBO_EMITIDO|ANULADO|SIN_PERMISO|NO_EXISTE):\s*(.+)$/);
  return m ? m[2] : message;
}

async function guard() {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  return { session, supabase: createSupabaseServer() };
}

/** Año + modo de aperturas, tal como vienen del formulario. */
function readOptions(formData: FormData): { year: number; options: PlanOptions } | null {
  const year = parseInt(str(formData, "bahai_year"), 10);
  if (!Number.isFinite(year) || year < 100 || year > 300) return null;
  const openings = str(formData, "openings");
  return {
    year,
    options:
      openings === "importadas" || openings === "verificadas" ? { openings } : {},
  };
}

async function readPlan(
  formData: FormData,
  localityId: string
): Promise<{ plan: ImportPlan; fileName: string; buffer: Buffer } | { error: string }> {
  const parsedOptions = readOptions(formData);
  if (!parsedOptions) return { error: "Elegí a qué ejercicio se asignan los movimientos." };

  const file = formData.get("file");
  if (!isFile(file) || file.size === 0) return { error: "Elegí la planilla del ejercicio." };
  if (file.size > MAX_BYTES) {
    return { error: "El archivo pasa de 4 MB. Exportá solo la hoja del libro." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let rows;
  try {
    rows = readStatementRows(buffer);
  } catch {
    return { error: "No pude abrir el archivo. Tiene que ser un Excel (.xlsx / .xls) o un CSV." };
  }

  const parsed = parseLedgerSheet(rows);
  if (isParseFailure(parsed)) return { error: parsed.error };

  const supabase = createSupabaseServer();
  const ctx = await buildLedgerContext(supabase, localityId, parsedOptions.year);
  return {
    plan: planImport(parsed, ctx, parsedOptions.options),
    fileName: file.name,
    buffer,
  };
}

// ═══ Vista previa ═══════════════════════════════════════════════════

export async function previewImportAction(formData: FormData): Promise<PreviewResult> {
  const { session } = await guard();
  const read = await readPlan(formData, session.locality.id);
  if ("error" in read) return { ok: false, error: read.error };
  return { ok: true, plan: read.plan, fileName: read.fileName };
}

// ═══ Confirmar ══════════════════════════════════════════════════════

type Catalog = {
  accounts: Map<string, string>;
  funds: Map<string, string>;
  categories: Map<string, string>;
  subcategories: Map<string, string>;
  contributors: Map<string, string>;
};

const key = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

async function loadCatalog(
  supabase: ReturnType<typeof createSupabaseServer>,
  localityId: string
): Promise<Catalog> {
  const tables = [
    "treasury_accounts",
    "treasury_funds",
    "treasury_categories",
    "treasury_subcategories",
    "treasury_contributors",
  ] as const;
  const [accounts, funds, categories, subcategories, contributors] = await Promise.all(
    tables.map((t) =>
      supabase.from(t).select("id, name").eq("locality_id", localityId)
    )
  );
  const toMap = (res: { data: unknown }) =>
    new Map(
      ((res.data ?? []) as Array<{ id: string; name: string }>).map(
        (r) => [key(r.name), r.id] as const
      )
    );
  return {
    accounts: toMap(accounts),
    funds: toMap(funds),
    categories: toMap(categories),
    subcategories: toMap(subcategories),
    contributors: toMap(contributors),
  };
}

/** Siguiente `sort_order` libre de una tabla del catálogo. */
async function nextSort(
  supabase: ReturnType<typeof createSupabaseServer>,
  table: string
): Promise<number> {
  const { data } = await supabase
    .from(table)
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data as { sort_order: number } | null)?.sort_order ?? 0) + 1;
}

export async function confirmImportAction(formData: FormData): Promise<ConfirmResult> {
  const { session, supabase } = await guard();
  const read = await readPlan(formData, session.locality.id);
  if ("error" in read) return { ok: false, error: read.error };
  const { plan, fileName, buffer } = read;

  if (plan.entries.length === 0) {
    return { ok: false, error: "No hay ningún movimiento para importar." };
  }

  // ─── 1. El catálogo que falta ──────────────────────────────────
  // Se crean ACTIVOS: en una comunidad que arranca vacía —la Nacional—
  // esto ES el catálogo, y crearlo dado de baja dejaría al tesorero con
  // los desplegables del libro en blanco. Lo que ya no se use se da de
  // baja después desde Catálogo, que es donde eso se decide.
  const needCategories = [...plan.newCategories];
  if (plan.newSubcategories.some((s) => !s.category)) needCategories.push(NO_CATEGORY);

  const creations: Array<{ table: string; names: string[] }> = [
    { table: "treasury_accounts", names: plan.newAccounts },
    { table: "treasury_funds", names: plan.newFunds },
    { table: "treasury_categories", names: [...new Set(needCategories)] },
  ];
  for (const { table, names } of creations) {
    if (names.length === 0) continue;
    const start = await nextSort(supabase, table);
    const { error } = await supabase
      .from(table)
      .insert(names.map((name, i) => ({ name, sort_order: start + i })));
    if (error) {
      if (isLedgerImportSchemaMissing(error)) return { ok: false, error: MIGRATION_MSG };
      return { ok: false, error: `No pude crear el catálogo: ${friendly(error.message)}` };
    }
  }

  // Las subcategorías necesitan los ids de las categorías recién creadas.
  let catalog = await loadCatalog(supabase, session.locality.id);
  if (plan.newSubcategories.length > 0) {
    const start = await nextSort(supabase, "treasury_subcategories");
    const { error } = await supabase.from("treasury_subcategories").insert(
      plan.newSubcategories.map((s, i) => ({
        name: s.name,
        category_id:
          catalog.categories.get(key(s.category || NO_CATEGORY)) ??
          catalog.categories.get(key(NO_CATEGORY)),
        default_fund_id: s.fund ? catalog.funds.get(key(s.fund)) ?? null : null,
        sort_order: start + i,
      }))
    );
    if (error) {
      return { ok: false, error: `No pude crear los rubros: ${friendly(error.message)}` };
    }
  }

  if (plan.newContributors.length > 0) {
    // Sin `profile_id`: vincular un nombre de hace cinco años con un
    // creyente de la app es una decisión de persona, no de string. Se
    // hace después desde el libro, que ya tiene el desplegable.
    const { error } = await supabase
      .from("treasury_contributors")
      .insert(plan.newContributors.map((name) => ({ name, kind: kindOf(name) })));
    if (error) {
      return { ok: false, error: `No pude crear los contribuyentes: ${friendly(error.message)}` };
    }
  }

  catalog = await loadCatalog(supabase, session.locality.id);

  // ─── 2. La planilla original, al bucket privado ────────────────
  // Si el bucket falla no se aborta: la evidencia es deseable, el libro
  // es lo que se vino a cargar. Se avisa al final.
  const ext = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "xlsx";
  const storagePath = `${session.locality.id}/${plan.bahaiYear}/${crypto.randomUUID()}.${ext}`;
  const upload = await supabase.storage
    .from(LEDGER_IMPORTS_BUCKET)
    .upload(storagePath, buffer, { contentType: "application/octet-stream", upsert: false });
  const stored = !upload.error;
  if (upload.error) console.error("[confirmImportAction] upload", upload.error);

  // ─── 3. El lote ────────────────────────────────────────────────
  const { data: batch, error: batchError } = await supabase
    .from("treasury_ledger_imports")
    .insert({
      bahai_year: plan.bahaiYear,
      file_name: fileName,
      storage_path: stored ? storagePath : null,
      entries_count: plan.entries.length,
      openings_mode: plan.openingsMode,
      openings: plan.openings,
      warnings: plan.warnings,
      note: str(formData, "note") || null,
      imported_by: session.user.id,
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    if (isLedgerImportSchemaMissing(batchError)) return { ok: false, error: MIGRATION_MSG };
    return {
      ok: false,
      error: `No pude registrar la importación: ${friendly(batchError?.message ?? "")}`,
    };
  }
  const batchId = (batch as { id: string }).id;

  // ─── 4. Los asientos ───────────────────────────────────────────
  const missing: string[] = [];
  const rows = plan.entries.map((e) => toEntryRow(e, plan.bahaiYear, batchId, catalog, missing));
  if (missing.length > 0) {
    await rollback(supabase, batchId);
    return {
      ok: false,
      error: `Quedaron nombres sin lugar en el catálogo (${[...new Set(missing)]
        .slice(0, 3)
        .join(", ")}). No se importó nada.`,
    };
  }

  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from("treasury_entries").insert(rows.slice(i, i + CHUNK));
    if (error) {
      await rollback(supabase, batchId);
      return {
        ok: false,
        error: `${friendly(error.message)} No se importó nada: el libro quedó como estaba.`,
      };
    }
  }

  revalidatePath("/admin/tesoreria/libro");
  revalidatePath("/admin/tesoreria/libro/importar");
  revalidatePath("/admin/tesoreria/auditoria");
  revalidatePath("/admin/tesoreria/libro/cierres");

  return {
    ok: true,
    entries: rows.length,
    batchId,
    warning: stored
      ? null
      : "Los movimientos entraron, pero no pude guardar el archivo original en la app.",
  };
}

/** Deshacer lo que se alcanzó a escribir. El catálogo creado se deja: es
 *  inofensivo, no altera ningún saldo, y borrarlo podría llevarse algo
 *  que el tesorero ya usó en otro lado mientras tanto. */
async function rollback(
  supabase: ReturnType<typeof createSupabaseServer>,
  batchId: string
): Promise<void> {
  const { error } = await supabase.rpc("undo_ledger_import", { p_batch: batchId });
  if (error) console.error("[confirmImportAction] rollback", error);
}

function kindOf(name: string): "persona" | "familia" | "colecta" {
  if (/^familia\b/i.test(name)) return "familia";
  if (/fiesta|colecta|canasta|an[oó]nim/i.test(name)) return "colecta";
  return "persona";
}

function toEntryRow(
  e: SheetRow,
  declaredYear: number,
  batchId: string,
  catalog: Catalog,
  missing: string[]
): Record<string, unknown> {
  const need = (map: Map<string, string>, name: string) => {
    const id = map.get(key(name));
    if (!id) missing.push(name);
    return id ?? null;
  };

  const subcategoryId = need(catalog.subcategories, e.subcategory);
  const accountId = need(catalog.accounts, e.account);
  const categoryId = e.category
    ? need(catalog.categories, e.category)
    : catalog.categories.get(key(NO_CATEGORY)) ?? need(catalog.categories, NO_CATEGORY);

  return {
    entry_date: e.date,
    // El ejercicio lo declara la persona, no la fecha: es para lo que
    // existe la columna (ver 040). Las filas cuya fecha cae en otro
    // ejercicio ya salieron avisadas en la vista previa.
    bahai_year: declaredYear,
    account_id: accountId,
    subcategory_id: subcategoryId,
    category_id: categoryId,
    fund_id: e.fund ? catalog.funds.get(key(e.fund)) ?? null : null,
    currency: e.currency,
    amount: e.amount,
    description: e.description || null,
    receipt_number: e.receiptNumber,
    contributions_count: e.contributionsCount,
    contributor_id: e.contributor ? catalog.contributors.get(key(e.contributor)) ?? null : null,
    receipt_issued: e.receiptIssued,
    is_opening_balance: e.isOpening,
    transfer_group_id: e.transferGroup,
    import_batch_id: batchId,
    import_ref: `${declaredYear}:${batchId.slice(0, 8)}:${e.row}`,
  };
}

// ═══ Deshacer ═══════════════════════════════════════════════════════

export async function undoImportAction(formData: FormData): Promise<Result> {
  const { supabase } = await guard();
  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Falta la importación." };

  const { error } = await supabase.rpc("undo_ledger_import", { p_batch: id });
  if (error) {
    if (isLedgerImportSchemaMissing(error)) return { ok: false, error: MIGRATION_MSG };
    return { ok: false, error: friendly(error.message) };
  }

  revalidatePath("/admin/tesoreria/libro");
  revalidatePath("/admin/tesoreria/libro/importar");
  revalidatePath("/admin/tesoreria/auditoria");
  revalidatePath("/admin/tesoreria/libro/cierres");
  return { ok: true, error: null };
}
