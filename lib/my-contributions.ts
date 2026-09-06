import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { treasuryYearForDate } from "./treasury-year";

/**
 * Mis aportes — lo que un creyente ve de sus propias contribuciones.
 *
 * El libro es exclusivo del tesorero y la RLS de `treasury_entries` no
 * cambia por esto: las filas salen por las funciones security definer
 * `my_contributions()` y `my_receipt()` (migración 046), que devuelven
 * SOLO los aportes cuyo contribuyente está vinculado al perfil de quien
 * pregunta, y solo las columnas de la lista y del recibo. Un aporte en
 * la canasta de la Fiesta no tiene perfil y nunca aparece.
 */

export type MyContribution = {
  id: string;
  entry_date: string;
  currency: string;
  amount: number;
  receipt_number: number | null;
  /** Cómo figuró en el recibo, si el tesorero puso un seudónimo. */
  receipt_name: string | null;
  contributor_name: string | null;
  fund_name: string | null;
  subcategory_name: string | null;
  locality_id: string | null;
  locality_name: string | null;
  /** Ejercicio contable (Riḍván a Riḍván) al que pertenece. */
  treasuryYear: number | null;
};

type Row = Omit<MyContribution, "amount" | "treasuryYear"> & {
  amount: number | string;
};

export async function getMyContributions(
  supabase: SupabaseClient
): Promise<MyContribution[]> {
  const { data, error } = await supabase.rpc("my_contributions");
  if (error) {
    // Antes de correr la 046 la función no existe. Se loguea con contexto
    // y la pantalla muestra la lista vacía en vez de romperse.
    console.error("[getMyContributions]", error);
    return [];
  }
  return ((data ?? []) as Row[]).map((r) => ({
    ...r,
    amount: Number(r.amount),
    treasuryYear: treasuryYearForDate(r.entry_date),
  }));
}

export type MyReceipt = {
  id: string;
  entry_date: string;
  currency: string;
  amount: number;
  receipt_number: number | null;
  receipt_name: string | null;
  contributor_name: string | null;
  fund_name: string | null;
  subcategory_name: string | null;
  locality_name: string | null;
  treasurer_name: string | null;
};

export async function getMyReceipt(
  supabase: SupabaseClient,
  entryId: string
): Promise<MyReceipt | null> {
  const { data, error } = await supabase.rpc("my_receipt", { entry_id: entryId });
  if (error) {
    console.error("[getMyReceipt]", error);
    return null;
  }
  if (!data) return null;
  const row = data as Omit<MyReceipt, "amount"> & { amount: number | string };
  return { ...row, amount: Number(row.amount) };
}
