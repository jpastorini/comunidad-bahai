import Link from "next/link";
import { notFound } from "next/navigation";
import { GoldHeader } from "@/components/GoldHeader";
import { requireBahai } from "@/lib/auth";
import { formatMoney } from "@/lib/treasury-format";
import { syncContribution } from "@/lib/treasury-online";

export const dynamic = "force-dynamic";

/**
 * La vuelta desde Mercado Pago (079). No confía en los parámetros que
 * agrega Mercado Pago a la URL: consulta el pago con `syncContribution()`
 * y, si está aprobado y el aviso todavía no lo había registrado, lo
 * registra acá. En el iPhone la vuelta puede abrir Safari en vez de la
 * app; el aporte se registra igual por el aviso.
 */
export default async function GraciasPage({ searchParams }: { searchParams: { id?: string } }) {
  const session = await requireBahai("/tesoreria");
  const id = searchParams.id ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const row = await syncContribution(id);
  if (!row || row.profile_id !== session.user.id) notFound();

  const amount = formatMoney(Number(row.amount), row.currency);

  const view = (() => {
    switch (row.status) {
      case "aprobado":
        return {
          title: "¡Gracias!",
          body: `Tu aporte de ${amount} está registrado en el libro de la Tesorería.`,
          tone: "ok" as const,
        };
      case "pendiente":
        return {
          title: "Pago en proceso",
          body: `Mercado Pago todavía no acreditó tu aporte de ${amount}. Si pagaste en Abitab o RedPagos puede tardar unas horas; cuando se acredite, se registra solo y te llega el recibo.`,
          tone: "wait" as const,
        };
      case "rechazado":
        return {
          title: "El pago no se completó",
          body: "Mercado Pago no aprobó el pago y no se te cobró nada. Podés intentar de nuevo, con otro medio si querés.",
          tone: "fail" as const,
        };
      case "devuelto":
        return {
          title: "Pago devuelto",
          body: `Mercado Pago devolvió tu aporte de ${amount}. El tesorero ya está avisado.`,
          tone: "fail" as const,
        };
      default:
        return {
          title: "Esperando a Mercado Pago",
          body: "Todavía no tenemos noticias de tu pago. Si lo completaste, en unos minutos se registra solo.",
          tone: "wait" as const,
        };
    }
  })();

  return (
    <>
      <GoldHeader title="Aportar al Fondo" subtitle={session.locality.name} backHref="/tesoreria" backLabel="Tesorería" />
      <main className="scroll-area flex-1 px-4 pt-4">
        <section className="rounded-[20px] bg-card p-5 text-center shadow-card-elevated">
          <div
            className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-[22px] ${
              view.tone === "ok"
                ? "bg-green/15 text-green"
                : view.tone === "fail"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-gold/15 text-gold-dark"
            }`}
            aria-hidden="true"
          >
            {view.tone === "ok" ? "✓" : view.tone === "fail" ? "!" : "…"}
          </div>
          <h1 className="mt-3 font-display text-[22px] font-semibold text-dark">{view.title}</h1>
          <p className="mt-1.5 text-[13px] leading-snug text-muted">{view.body}</p>

          <div className="mt-4 flex flex-col gap-2">
            {row.status === "aprobado" && row.entry_id && (
              <Link
                href={`/perfil/aportes/recibo/${row.entry_id}`}
                className="tap rounded-2xl bg-gold px-4 py-3 text-[14px] font-semibold text-white"
              >
                Ver mi recibo
              </Link>
            )}
            {(row.status === "pendiente" || row.status === "creado") && (
              <Link
                href={`/tesoreria/aportar/gracias?id=${row.id}`}
                className="tap rounded-2xl bg-gold/15 px-4 py-3 text-[14px] font-semibold text-gold-dark"
              >
                Volver a consultar
              </Link>
            )}
            {row.status === "rechazado" && (
              <Link
                href="/tesoreria/aportar"
                className="tap rounded-2xl bg-gold px-4 py-3 text-[14px] font-semibold text-white"
              >
                Intentar de nuevo
              </Link>
            )}
            <Link href="/tesoreria" className="tap px-4 py-2 text-[13px] font-semibold text-gold-dark">
              Volver a Tesorería
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
