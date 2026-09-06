import Link from "next/link";
import { GoldHeader } from "@/components/GoldHeader";
import { IconChevronRight } from "@/components/Icons";
import { requireMember } from "@/lib/auth";
import { getMyContributions, type MyContribution } from "@/lib/my-contributions";
import { createSupabaseServer } from "@/lib/supabase/server";
import { addMoney, formatMoney } from "@/lib/treasury-format";
import { todayISO } from "@/lib/treasury-ledger";
import { treasuryYearEnd, treasuryYearForDate, treasuryYearStart } from "@/lib/treasury-year";

export const dynamic = "force-dynamic";

/**
 * Mis aportes: las contribuciones del creyente, con su recibo.
 *
 * Por defecto se muestra el ejercicio corriente (Riḍván a Riḍván, el
 * mismo corte de los informes que se presentan en la Fiesta); los
 * anteriores se eligen arriba. Las filas salen de `my_contributions()`
 * (migración 046): solo las propias, y sin abrir el libro.
 */
export default async function MisAportesPage({
  searchParams,
}: {
  searchParams: { year?: string };
}) {
  const session = await requireMember("/perfil/aportes");
  const supabase = createSupabaseServer();

  const all = await getMyContributions(supabase);
  const today = todayISO();
  const currentYear = treasuryYearForDate(today);

  const yearsWithData = [...new Set(all.map((c) => c.treasuryYear).filter(Boolean))] as number[];
  const years = [...new Set([currentYear, ...yearsWithData].filter(Boolean))] as number[];
  years.sort((a, b) => b - a);

  const requested = parseInt(searchParams.year ?? "", 10);
  const year = years.includes(requested) ? requested : (currentYear ?? years[0] ?? null);

  const rows = all.filter((c) => c.treasuryYear === year);
  const totals = totalsByCurrency(rows);
  const from = year ? treasuryYearStart(year) : null;
  const to = year ? treasuryYearEnd(year) : null;

  return (
    <>
      <GoldHeader title="Mis aportes" subtitle={session.locality.name} backHref="/perfil" backLabel="Mi perfil" />
      <main className="scroll-area flex-1 px-4 pb-6 pt-4">
        {/* Ejercicio */}
        {years.length > 1 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {years.map((y) => (
              <Link
                key={y}
                href={y === currentYear ? "/perfil/aportes" : `/perfil/aportes?year=${y}`}
                className={`tap rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                  y === year
                    ? "bg-terra text-white"
                    : "bg-card text-muted shadow-card-soft"
                }`}
              >
                {y} E.B.
              </Link>
            ))}
          </div>
        )}

        {/* Resumen del ejercicio */}
        <div className="mb-4 rounded-2xl bg-card p-4 shadow-card-elevated">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Ejercicio {year ?? "—"} E.B.
          </div>
          {from && to && (
            <div className="mt-0.5 text-[11px] text-muted">
              Del {formatDate(from)} al {formatDate(to)}
            </div>
          )}
          {totals.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
              {totals.map((t) => (
                <div key={t.currency}>
                  <div className="font-display text-[22px] font-semibold leading-tight text-dark tabular-nums">
                    {formatMoney(t.amount)}
                    <span className="ml-1 text-[12px] font-normal text-muted">
                      {t.currency}
                    </span>
                  </div>
                </div>
              ))}
              <div className="self-end text-[11.5px] text-muted">
                {rows.length} {rows.length === 1 ? "aporte" : "aportes"}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-[12.5px] text-muted">
              Sin aportes registrados a tu nombre en este ejercicio.
            </p>
          )}
        </div>

        {/* Lista */}
        {rows.length > 0 ? (
          <ul className="space-y-2">
            {rows.map((c) => (
              <li key={c.id} className="rounded-2xl bg-card p-3.5 shadow-card-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] text-muted">
                      {formatDate(c.entry_date)}
                      {c.receipt_number ? ` · Recibo N.° ${c.receipt_number}` : ""}
                    </div>
                    <div className="mt-0.5 font-display text-[17px] font-semibold text-dark tabular-nums">
                      {formatMoney(c.amount)}{" "}
                      <span className="text-[12px] font-normal text-muted">{c.currency}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[11.5px] text-muted">
                      {[c.fund_name, c.subcategory_name].filter(Boolean).join(" · ") || "Fondo local"}
                    </div>
                    {c.receipt_name && (
                      <div className="mt-0.5 text-[11.5px] text-muted">
                        A nombre de <span className="font-semibold text-dark">{c.receipt_name}</span>
                      </div>
                    )}
                  </div>
                  {c.receipt_number ? (
                    <Link
                      href={`/perfil/aportes/recibo/${c.id}`}
                      className="tap flex shrink-0 items-center gap-1 rounded-xl border border-terra/25 bg-terra/[0.06] px-3 py-2 text-[12px] font-semibold text-terra"
                    >
                      Recibo
                      <IconChevronRight size={12} />
                    </Link>
                  ) : (
                    <span className="shrink-0 text-[11px] text-muted">Sin recibo</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-black/10 bg-card/50 px-4 py-6 text-center text-[12.5px] text-muted">
            {all.length === 0 ? (
              <>
                Todavía no hay aportes vinculados a tu perfil. Cuando la
                Tesorería registre uno a tu nombre, va a aparecer acá con su
                recibo.
              </>
            ) : (
              <>No hay aportes en este ejercicio.</>
            )}
          </div>
        )}

        <p className="mt-5 px-1 text-center text-[10.5px] italic leading-relaxed text-muted">
          Las contribuciones a los fondos bahá'ís son voluntarias y
          estrictamente confidenciales. Solo vos y la Tesorería ven esta
          lista.
        </p>
      </main>
    </>
  );
}

function totalsByCurrency(rows: MyContribution[]) {
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.currency, addMoney(map.get(r.currency) ?? 0, r.amount));
  return [...map.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

/** "2026-08-22" → "22/08/2026", sin pasar por Date. */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
