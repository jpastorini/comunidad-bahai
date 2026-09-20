import { PageHeader } from "@/components/admin/ui";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getTreasuryCatalog } from "@/lib/treasury-catalog";
import { CatalogClient } from "./catalog-client";

export const dynamic = "force-dynamic";

/**
 * Tesorería → Catálogo: las cuentas, los fondos, las categorías y las
 * subcategorías del libro, en una sola pantalla. Cambian con las
 * necesidades y las oportunidades de la comunidad (se abre una cuenta,
 * se crea un fondo para un proyecto, un rubro deja de tener sentido),
 * así que tienen que poder mantenerse sin tocar la base.
 *
 * Las reglas de quitar, re-emparentar y desactivar están en actions.ts.
 */
export default async function CatalogoPage() {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const catalog = await getTreasuryCatalog(supabase, session.locality.id);

  return (
    <>
      <PageHeader
        eyebrow="Tesorería"
        title="Catálogo"
        description="Las cuentas, fondos, categorías y subcategorías con que se carga el libro. Lo que nunca se usó se elimina; lo que ya tiene movimientos se desactiva y queda en el historial."
      />
      <CatalogClient catalog={catalog} />
    </>
  );
}
