import { PageHeader } from "@/components/admin/ui";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ReconcileClient } from "./reconcile-client";

export const dynamic = "force-dynamic";

/**
 * Tesorería → Conciliación: el extracto de una cuenta contra el libro.
 *
 * El extracto es la única fuente EXTERNA de verdad del libro: la auditoría
 * (059) compara el libro consigo mismo, y acá se compara con lo que dice
 * la plataforma donde está la plata. Primer paso, sin migración: se sube
 * el archivo, se compara y se muestra; no se guarda nada. Ver actions.ts.
 */
export default async function ConciliacionPage() {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const { data } = await supabase
    .from("treasury_accounts")
    .select("id, name")
    .eq("locality_id", session.locality.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  const accounts = (data ?? []) as Array<{ id: string; name: string }>;

  return (
    <>
      <PageHeader
        eyebrow="Tesorería"
        title="Conciliación"
        description="Compará el extracto de una cuenta con el libro. Elegís la cuenta, subís el archivo que exporta la plataforma y ves qué falta de cada lado. No se guarda nada."
      />
      <ReconcileClient accounts={accounts} />
    </>
  );
}
