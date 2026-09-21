import { PageHeader } from "@/components/admin/ui";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getAccountReconciliation, getImports } from "@/lib/treasury-statements";
import { ReconcileClient } from "./reconcile-client";

export const dynamic = "force-dynamic";

/**
 * Tesorería → Conciliación: el extracto de cada cuenta contra el libro.
 *
 * El extracto es la única fuente EXTERNA de verdad del libro: la auditoría
 * (059) compara el libro consigo mismo, y acá se compara con lo que dice
 * la plataforma donde está la plata. Desde la 061 lo importado se guarda:
 * las líneas del extracto, los pares con el libro y el archivo original.
 * La pantalla muestra el estado de UNA cuenta (`?cuenta=`): lo pendiente
 * de cada lado, y arriba el formulario para importar el archivo siguiente.
 */
export default async function ConciliacionPage({
  searchParams,
}: {
  searchParams: { cuenta?: string };
}) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const [{ data }, imports] = await Promise.all([
    supabase
      .from("treasury_accounts")
      .select("id, name")
      .eq("locality_id", session.locality.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    getImports(supabase),
  ]);
  const accounts = (data ?? []) as Array<{ id: string; name: string }>;

  // La cuenta pedida; si no, la de la importación más reciente; si no, la
  // primera del catálogo.
  const requested = accounts.find((a) => a.id === searchParams.cuenta);
  const lastImported = accounts.find((a) => a.id === imports.rows[0]?.account_id);
  const selected = requested ?? lastImported ?? accounts[0] ?? null;

  const accountsWithImports = [...new Set(imports.rows.map((i) => i.account_id))];
  const reconciliation =
    selected && !imports.missing ? await getAccountReconciliation(supabase, selected.id) : null;

  return (
    <>
      <PageHeader
        eyebrow="Tesorería"
        title="Conciliación"
        description="El extracto de cada cuenta contra el libro. Importás el archivo que exporta la plataforma y la app cruza lo que puede; lo que queda suelto de cada lado lo resolvés acá."
      />
      <ReconcileClient
        accounts={accounts}
        accountsWithImports={accountsWithImports}
        accountId={selected?.id ?? ""}
        migrationMissing={imports.missing}
        data={reconciliation}
      />
    </>
  );
}
