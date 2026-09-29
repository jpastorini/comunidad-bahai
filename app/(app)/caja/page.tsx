import Link from "next/link";
import { GoldHeader } from "@/components/GoldHeader";
import { requireBahai } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  CASH_REPORT_STATUS_LABEL,
  cashDifferences,
  expectedCash,
  fixedOf,
  getCashBoxBalance,
  getCashBoxes,
  getCashLines,
  getCashReports,
  linesTotal,
  signCashLines,
} from "@/lib/treasury-cash";
import { formatMoney } from "@/lib/treasury-format";
import { todayISO } from "@/lib/treasury-ledger";
import { CashLineForm, RemoveLineButton, SubmitReportForm } from "./line-form";

export const dynamic = "force-dynamic";

/**
 * Mi caja chica (074): lo que ve el responsable de una caja. Su saldo, los
 * gastos que va cargando con el comprobante, y el botón para rendir.
 * No ve el libro ni otras cajas: la RLS le devuelve solo lo suyo.
 */
export default async function MiCajaPage() {
  const session = await requireBahai("/caja");
  const supabase = createSupabaseServer();
  const today = todayISO();

  const { boxes: all, missing } = await getCashBoxes(supabase, { includeInactive: true });
  const boxes = all.filter((b) => b.holder_profile_id === session.user.id);

  // Nombres de cuentas y rubros: la RLS los deja leer por localidad.
  const [accountsRes, subsRes, catsRes] = await Promise.all([
    supabase.from("treasury_accounts").select("id, name"),
    supabase.from("treasury_subcategories").select("id, name, category_id, is_active").eq("is_active", true).order("sort_order"),
    supabase.from("treasury_categories").select("id, name").order("sort_order"),
  ]);
  const accountName = new Map(((accountsRes.data ?? []) as { id: string; name: string }[]).map((a) => [a.id, a.name]));
  const catName = new Map(((catsRes.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const rubros = ((subsRes.data ?? []) as { id: string; name: string; category_id: string }[]).map((s) => ({
    id: s.id,
    name: s.name,
    category: catName.get(s.category_id) ?? "Otros",
  }));
  const subName = new Map(rubros.map((r) => [r.id, r.name]));

  return (
    <>
      <GoldHeader title="Mi caja chica" subtitle={session.locality.name} backHref="/perfil" backLabel="Mi perfil" />
      <main className="scroll-area flex-1 px-4 pb-8 pt-4">
        {missing && (
          <p className="rounded-2xl bg-amber/10 px-4 py-3 text-[13px] text-dark">
            Esta función todavía no está habilitada en la base (falta la migración 074).
          </p>
        )}
        {!missing && boxes.length === 0 && (
          <div className="rounded-2xl bg-card p-5 text-center shadow-card">
            <p className="text-[14px] font-semibold text-dark">No tenés una caja chica a tu cargo.</p>
            <p className="mt-1 text-[12.5px] text-muted">
              Si la Asamblea te asigna una, te llega un aviso y aparece acá.
            </p>
          </div>
        )}

        {await Promise.all(
          boxes.map(async (box) => {
            const [balance, reports] = await Promise.all([
              getCashBoxBalance(supabase, box.id),
              getCashReports(supabase, { boxId: box.id, limit: 12 }),
            ]);
            const open = reports.find((r) => r.status === "borrador" || r.status === "devuelta") ?? null;
            const openLines = open ? await signCashLines(supabase, await getCashLines(supabase, [open.id])) : [];
            const expected = expectedCash(balance, openLines);
            const fixed = fixedOf(box);
            const currencies = fixed.length > 0 ? fixed.map((f) => f.currency) : ["UYU"];
            const totals = linesTotal(openLines);
            const past = reports.filter((r) => r.id !== open?.id);

            return (
              <section key={box.id} className="mb-6 flex flex-col gap-4">
                {/* Estado */}
                <div className="rounded-[20px] bg-card p-4 shadow-card-elevated">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-dark">
                    {accountName.get(box.account_id) ?? "Caja chica"}
                    {!box.is_active && " · desactivada"}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Figure
                      label="Debería haber"
                      value={expected.length ? expected.map((e) => formatMoney(e.amount, e.currency)).join(" · ") : "—"}
                    />
                    <Figure
                      label="Fondo fijo"
                      value={fixed.length ? fixed.map((f) => formatMoney(f.amount, f.currency)).join(" · ") : "—"}
                    />
                  </div>
                  <p className="mt-2 text-[11.5px] text-muted">
                    «Debería haber» es lo que el libro dice que tenés, ya descontados los gastos que cargaste
                    y todavía no rendiste. Cuando rindas, la caja vuelve al fondo fijo.
                  </p>
                </div>

                {/* Rendición abierta */}
                <div className="rounded-[20px] bg-card p-4 shadow-card">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="font-display text-[19px] font-semibold text-dark">
                      {open?.status === "devuelta" ? "Rendición devuelta: corregí y volvé a enviar" : "Gastos para rendir"}
                    </h2>
                    {openLines.length > 0 && (
                      <span className="text-[12px] tabular-nums text-muted">
                        {openLines.length} · {totals.map((t) => formatMoney(t.amount, t.currency)).join(" · ")}
                      </span>
                    )}
                  </div>
                  {open?.status === "devuelta" && open.review_note && (
                    <p className="mt-2 rounded-xl bg-amber/10 px-3 py-2 text-[12.5px] text-dark">
                      <strong>El tesorero dice:</strong> {open.review_note}
                    </p>
                  )}
                  {openLines.length > 0 && (
                    <ul className="mt-3 divide-y divide-black/[0.05]">
                      {openLines.map((l) => (
                        <li key={l.id} className="flex items-center gap-3 py-2.5">
                          {l.url && l.mime_type?.startsWith("image/") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={l.url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-black/10" />
                          ) : (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-bg text-[10px] font-bold uppercase text-muted">
                              {l.storage_path ? "PDF" : "sin"}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-[13.5px] font-semibold text-dark">{l.description}</span>
                              <span className="shrink-0 tabular-nums text-[13.5px] font-semibold text-dark">
                                {formatMoney(l.amount, l.currency)}
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between gap-2 text-[11.5px] text-muted">
                              <span className="truncate">
                                {formatDate(l.line_date)} · {l.subcategory_id ? subName.get(l.subcategory_id) ?? "" : "sin rubro"}
                                {!l.storage_path && " · sin comprobante"}
                              </span>
                              <RemoveLineButton lineId={l.id} />
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {box.is_active && (
                    <div className="mt-4 border-t border-black/[0.06] pt-4">
                      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Agregar un gasto</h3>
                      <CashLineForm boxId={box.id} rubros={rubros} today={today} currencies={currencies} />
                    </div>
                  )}
                </div>

                {open && openLines.length > 0 && (
                  <div className="rounded-[20px] bg-gold/10 p-4 ring-1 ring-gold/25">
                    <h2 className="font-display text-[19px] font-semibold text-dark">Rendir</h2>
                    <div className="mt-2">
                      <SubmitReportForm
                        reportId={open.id}
                        currencies={currencies}
                        expected={currencies.map((c) => ({
                          currency: c,
                          label: formatMoney(expected.find((e) => e.currency === c)?.amount ?? 0, c),
                        }))}
                      />
                    </div>
                  </div>
                )}

                {/* Historial */}
                {past.length > 0 && (
                  <div className="rounded-[20px] bg-card p-4 shadow-card">
                    <h2 className="font-display text-[17px] font-semibold text-dark">Rendiciones anteriores</h2>
                    <ul className="mt-2 divide-y divide-black/[0.05] text-[12.5px]">
                      {past.map((r) => {
                        const diffs = cashDifferences(
                          [
                            { currency: "UYU", amount: r.counted_uyu ?? 0 },
                            { currency: "USD", amount: r.counted_usd ?? 0 },
                          ],
                          [
                            { currency: "UYU", amount: r.expected_uyu ?? 0 },
                            { currency: "USD", amount: r.expected_usd ?? 0 },
                          ]
                        );
                        return (
                          <li key={r.id} className="py-2">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="font-semibold text-dark">
                                {r.submitted_at ? formatDateTime(r.submitted_at) : formatDate(r.created_at)}
                              </span>
                              <span
                                className={`text-[11px] font-bold uppercase tracking-wide ${
                                  r.status === "aprobada" ? "text-green" : r.status === "enviada" ? "text-amber" : "text-rose-700"
                                }`}
                              >
                                {CASH_REPORT_STATUS_LABEL[r.status]}
                              </span>
                            </div>
                            {r.submitted_at && (
                              <div className="text-muted">
                                Arqueo: {diffs.length === 0 ? "cuadró" : diffs.map((d) => `${d.amount > 0 ? "sobraban" : "faltaban"} ${formatMoney(Math.abs(d.amount), d.currency)}`).join(", ")}
                              </div>
                            )}
                            {r.review_note && <div className="text-muted">Tesorero: {r.review_note}</div>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </section>
            );
          })
        )}

        <p className="mt-2 px-1 text-[11.5px] text-muted">
          La caja chica gasta solo lo que se le repone: la plata que recibís como aporte se entrega al
          tesorero íntegra, no se usa para pagar gastos.{" "}
          <Link href="/tesoreria" className="font-semibold text-terra">
            Ver la Tesorería
          </Link>
        </p>
      </main>
    </>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-bg/40 px-3 py-2.5">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="tabular-nums text-[16px] font-semibold text-dark">{value}</div>
    </div>
  );
}
