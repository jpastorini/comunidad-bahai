import { redirect } from "next/navigation";
import { GoldHeader } from "@/components/GoldHeader";
import { requireBahai } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { MIN_AMOUNT, getOnlineOffer } from "@/lib/treasury-online";
import { AporteForm } from "./aporte-form";

export const dynamic = "force-dynamic";

/**
 * Aportar al Fondo con Mercado Pago (079). La persona pone el monto que
 * desea —con su compromiso mensual a un toque, si lo tiene— y elige el
 * fondo solo si la Tesorería habilitó más de uno en el Catálogo.
 */
export default async function AportarPage() {
  const session = await requireBahai("/tesoreria/aportar");
  const offer = await getOnlineOffer(session.locality.id);
  if (!offer.available) redirect("/tesoreria");

  const supabase = createSupabaseServer();
  const { data: commitment } = await supabase
    .from("treasury_commitments")
    .select("amount, currency")
    .eq("user_id", session.user.id)
    .eq("locality_id", session.locality.id)
    .maybeSingle();
  const c = commitment as { amount: number; currency: string | null } | null;
  // Mercado Pago cobra en pesos: un compromiso en dólares no se propone.
  const commitmentAmount =
    c && (c.currency ?? "UYU") === "UYU" && Number(c.amount) >= MIN_AMOUNT
      ? Number(c.amount)
      : null;

  return (
    <>
      <GoldHeader
        title="Aportar al Fondo"
        subtitle={session.locality.name}
        backHref="/tesoreria"
        backLabel="Tesorería"
      />
      <main className="scroll-area flex-1 px-4 pt-4">
        <AporteForm
          funds={offer.funds}
          commitmentAmount={commitmentAmount}
          minAmount={MIN_AMOUNT}
        />
      </main>
    </>
  );
}
