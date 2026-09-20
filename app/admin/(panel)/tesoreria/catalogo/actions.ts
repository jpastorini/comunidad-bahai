"use server";

import { revalidatePath } from "next/cache";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { isSchemaMissing } from "@/lib/polls-shared";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  CATALOG_LABEL,
  CATALOG_TABLE,
  canDelete,
  getCatalogUsage,
  isCatalogKind,
  type CatalogKind,
} from "@/lib/treasury-catalog";

/**
 * El mantenimiento del catálogo del libro: cuentas, fondos, categorías y
 * subcategorías. Detrás del tag `can_manage_treasury`, como el libro; la
 * RLS de las cuatro tablas (040) ya acota la escritura a la localidad
 * del sombrero puesto, así que acá no se filtra por `locality_id` más
 * que para leer a los hermanos al reordenar (el admin nacional lee todas
 * las localidades y mezclaría catálogos).
 *
 * Tres reglas que la UI refleja pero que se deciden acá:
 *
 *  · Quitar = eliminar si nunca se usó, desactivar si sí. El conteo se
 *    rehace en el servidor antes de borrar; la FK `restrict` de los
 *    movimientos es la red de abajo.
 *  · La categoría de una subcategoría CON movimientos no se cambia:
 *    `treasury_entries.category_id` se copia al guardar cada movimiento
 *    y los meses cerrados están congelados por trigger, así que
 *    re-emparentar dejaría los informes por categoría a medio camino.
 *    Con cero movimientos se cambia libremente.
 *  · Desactivar una categoría desactiva sus subcategorías (el formulario
 *    del libro filtra por la subcategoría, no por la categoría).
 *    Reactivarla no las reactiva: eso se elige una por una.
 */

type Result = { ok: boolean; error: string | null };

const ok: Result = { ok: true, error: null };
const fail = (error: string): Result => ({ ok: false, error });

const MAX_NAME = 80;

function str(formData: FormData, key: string): string {
  return ((formData.get(key) as string) || "").trim();
}

async function guard() {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  return { session, supabase: createSupabaseServer() };
}

function kindOf(formData: FormData): CatalogKind | null {
  const k = str(formData, "kind");
  return isCatalogKind(k) ? k : null;
}

function dbError(
  error: { code?: string; message: string },
  kind: CatalogKind
): string {
  const label = CATALOG_LABEL[kind];
  if (error.code === "23505") return `Ya hay ${label.una} ${label.one} con ese nombre.`;
  if (error.code === "23503")
    return `No se puede eliminar: hay movimientos u otras cosas que ${
      kind === "fund" ? "lo" : "la"
    } usan. Desactivá ${kind === "fund" ? "el" : "la"} ${label.one} en su lugar.`;
  if (isSchemaMissing(error.code) || error.code === "42703")
    return "Falta una actualización de la base de datos.";
  return error.message;
}

function revalidate() {
  revalidatePath("/admin/tesoreria/catalogo");
  // El libro arma sus desplegables con este catálogo y las pantallas
  // visitadas viven en el caché del router: sin esto, agregás una cuenta
  // y el formulario del movimiento sigue sin mostrarla.
  revalidatePath("/admin/tesoreria/libro");
}

/** Agregar. Va al final del orden. */
export async function addCatalogItemAction(formData: FormData): Promise<Result> {
  const { supabase } = await guard();
  const kind = kindOf(formData);
  if (!kind) return fail("Tipo desconocido.");
  const label = CATALOG_LABEL[kind];

  const name = str(formData, "name");
  if (!name) return fail(`Escribí el nombre de ${label.una === "una" ? "la" : "el"} ${label.one}.`);
  if (name.length > MAX_NAME) return fail(`El nombre no puede pasar de ${MAX_NAME} caracteres.`);

  const table = CATALOG_TABLE[kind];
  const { data: last } = await supabase
    .from(table)
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = ((last as { sort_order: number } | null)?.sort_order ?? 0) + 1;

  const row: Record<string, unknown> = { name, sort_order: sortOrder };
  if (kind === "subcategory") {
    const categoryId = str(formData, "category_id");
    if (!categoryId) return fail("Elegí la categoría a la que pertenece.");
    row.category_id = categoryId;
    row.default_fund_id = str(formData, "default_fund_id") || null;
  }

  const { error } = await supabase.from(table).insert(row);
  if (error) return fail(dbError(error, kind));
  revalidate();
  return ok;
}

/** Renombrar; en una subcategoría, también su categoría y fondo sugerido. */
export async function updateCatalogItemAction(formData: FormData): Promise<Result> {
  const { supabase } = await guard();
  const kind = kindOf(formData);
  if (!kind) return fail("Tipo desconocido.");
  const id = str(formData, "id");
  if (!id) return fail("Falta el id.");

  const name = str(formData, "name");
  if (!name) return fail("El nombre no puede quedar vacío.");
  if (name.length > MAX_NAME) return fail(`El nombre no puede pasar de ${MAX_NAME} caracteres.`);

  const table = CATALOG_TABLE[kind];
  const patch: Record<string, unknown> = { name };

  if (kind === "subcategory") {
    patch.default_fund_id = str(formData, "default_fund_id") || null;

    const categoryId = str(formData, "category_id");
    if (categoryId) {
      const { data: current } = await supabase
        .from(table)
        .select("category_id")
        .eq("id", id)
        .maybeSingle();
      const before = (current as { category_id: string } | null)?.category_id;
      if (before && before !== categoryId) {
        const { count } = await supabase
          .from("treasury_entries")
          .select("id", { count: "exact", head: true })
          .eq("subcategory_id", id);
        if ((count ?? 0) > 0)
          return fail(
            "Esta subcategoría ya tiene movimientos: su categoría no se cambia. Creá una subcategoría nueva en la categoría correcta y desactivá esta."
          );
        patch.category_id = categoryId;
      }
    }
  }

  const { error } = await supabase.from(table).update(patch).eq("id", id);
  if (error) return fail(dbError(error, kind));
  revalidate();
  return ok;
}

/** Desactivar (deja de ofrecerse al cargar) o reactivar. */
export async function setCatalogItemActiveAction(formData: FormData): Promise<Result> {
  const { supabase } = await guard();
  const kind = kindOf(formData);
  if (!kind) return fail("Tipo desconocido.");
  const id = str(formData, "id");
  if (!id) return fail("Falta el id.");
  const active = str(formData, "active") === "1";

  const table = CATALOG_TABLE[kind];
  const { error } = await supabase.from(table).update({ is_active: active }).eq("id", id);
  if (error) return fail(dbError(error, kind));

  if (kind === "category" && !active) {
    const { error: subError } = await supabase
      .from(CATALOG_TABLE.subcategory)
      .update({ is_active: false })
      .eq("category_id", id);
    if (subError) return fail(dbError(subError, "subcategory"));
  }

  revalidate();
  return ok;
}

/** Eliminar. Solo lo que no se usó en ningún lado; si no, desactivar. */
export async function deleteCatalogItemAction(formData: FormData): Promise<Result> {
  const { supabase, session } = await guard();
  const kind = kindOf(formData);
  if (!kind) return fail("Tipo desconocido.");
  const id = str(formData, "id");
  if (!id) return fail("Falta el id.");
  const label = CATALOG_LABEL[kind];

  const usage = await getCatalogUsage(supabase, session.locality.id);
  if (!canDelete(usage[id]))
    return fail(
      `Esta ${label.one} ya se usó: no se elimina, se desactiva. Así el historial sigue completo.`
    );

  const { error } = await supabase.from(CATALOG_TABLE[kind]).delete().eq("id", id);
  if (error) return fail(dbError(error, kind));
  revalidate();
  return ok;
}

type OrderRow = { id: string; sort_order: number; category_id?: string };

/**
 * Subir o bajar un puesto. Reescribe `sort_order` como 1..n sobre la lista
 * completa de ese tipo, así los huecos y empates de la carga inicial
 * desaparecen la primera vez que alguien ordena. Las subcategorías se
 * muestran agrupadas por categoría, así que el vecino es el más cercano
 * DE LA MISMA categoría.
 */
export async function moveCatalogItemAction(formData: FormData): Promise<Result> {
  const { supabase, session } = await guard();
  const kind = kindOf(formData);
  if (!kind) return fail("Tipo desconocido.");
  const id = str(formData, "id");
  if (!id) return fail("Falta el id.");
  const dir = str(formData, "dir") === "up" ? -1 : 1;

  const table = CATALOG_TABLE[kind];
  const columns = kind === "subcategory" ? "id, sort_order, category_id" : "id, sort_order";
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .eq("locality_id", session.locality.id)
    .order("sort_order")
    .order("name");
  if (error) return fail(dbError(error, kind));

  const rows = (data ?? []) as unknown as OrderRow[];
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return fail("No se encontró.");

  let other = -1;
  for (let i = idx + dir; i >= 0 && i < rows.length; i += dir) {
    if (kind !== "subcategory" || rows[i].category_id === rows[idx].category_id) {
      other = i;
      break;
    }
  }
  if (other < 0) return ok; // ya está en la punta

  [rows[idx], rows[other]] = [rows[other], rows[idx]];

  const updates = rows
    .map((r, i) => ({ id: r.id, sort_order: i + 1, changed: r.sort_order !== i + 1 }))
    .filter((r) => r.changed)
    .map((r) => supabase.from(table).update({ sort_order: r.sort_order }).eq("id", r.id));
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return fail(dbError(failed.error, kind));

  revalidate();
  return ok;
}
