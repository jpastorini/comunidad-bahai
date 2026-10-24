import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { INSTITUTION_DOCS_BUCKET } from "./institution";
import type { StructureType } from "./types";

/**
 * Informes que una estructura (082) le presenta a la Asamblea que la creó
 * (084). Dos clases: de actividad (texto y un archivo) y de Tesorería
 * (apunta a la hoja que ya arma el tesorero, no la copia). La Asamblea
 * los ve en su Registro de informes y registra en qué reunión los aprobó.
 *
 * Quién ve qué lo decide la RLS: la estructura, los suyos; la Asamblea
 * madre, solo los presentados.
 */

export type StructureReportKind = "actividad" | "tesoreria";

export type StructureReport = {
  id: string;
  structure_id: string;
  parent_id: string;
  kind: StructureReportKind;
  treasury_report_id: string | null;
  title: string;
  period_from: string | null;
  period_to: string | null;
  body: string | null;
  file_path: string | null;
  file_name: string | null;
  status: "borrador" | "presentado";
  presented_at: string | null;
  approved_on: string | null;
  approval_note: string | null;
  created_at: string;
  /** Con el embed de la estructura, para la Asamblea madre. */
  structure?: { name: string; structure_type: StructureType | null } | null;
};

const SELECT =
  "*, structure:localities!structure_reports_structure_id_fkey(name, structure_type)";

/** Falta la 084: tabla, columna o caché de PostgREST. */
export function isStructureReportsSchemaMissing(code: string | null | undefined): boolean {
  return code === "42P01" || code === "PGRST205" || code === "42703" || code === "PGRST200";
}

/** Los informes de la estructura puesta, borradores incluidos. */
export async function getOwnStructureReports(
  supabase: SupabaseClient,
  structureId: string
): Promise<{ reports: StructureReport[]; schemaMissing: boolean }> {
  const { data, error } = await supabase
    .from("structure_reports")
    .select(SELECT)
    .eq("structure_id", structureId)
    .order("created_at", { ascending: false });
  if (error) {
    if (isStructureReportsSchemaMissing(error.code)) return { reports: [], schemaMissing: true };
    console.error("[structure-reports] propios:", error.message);
    return { reports: [], schemaMissing: false };
  }
  return { reports: (data ?? []) as StructureReport[], schemaMissing: false };
}

/** Lo que las estructuras le presentaron a esta Asamblea. */
export async function getReportsPresentedTo(
  supabase: SupabaseClient,
  parentId: string
): Promise<StructureReport[]> {
  const { data, error } = await supabase
    .from("structure_reports")
    .select(SELECT)
    .eq("parent_id", parentId)
    .eq("status", "presentado")
    .order("presented_at", { ascending: false });
  if (error) {
    if (!isStructureReportsSchemaMissing(error.code)) {
      console.error("[structure-reports] presentados:", error.message);
    }
    return [];
  }
  return (data ?? []) as StructureReport[];
}

export async function getStructureReport(
  supabase: SupabaseClient,
  id: string
): Promise<StructureReport | null> {
  const { data } = await supabase.from("structure_reports").select(SELECT).eq("id", id).maybeSingle();
  return (data as StructureReport | null) ?? null;
}

/** URL firmada de una hora para un archivo del bucket privado. */
export async function signInstitutionFile(
  supabase: SupabaseClient,
  path: string | null
): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage
    .from(INSTITUTION_DOCS_BUCKET)
    .createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
