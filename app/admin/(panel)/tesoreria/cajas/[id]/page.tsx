import Link from "next/link";
import { notFound } from "next/navigation";
import { Banner, Button, Card, DateInput, Field, PageHeader, TextArea, TextInput } from "@/components/admin/ui";
import { HelpTip } from "@/components/HelpTip";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  CASH_REPORT_STATUS_LABEL,
  cashDifferences,
  expectedCash,
  fixedOf,
  getCashBox,
  getCashBoxBalance,
  getCashBoxes,
  getCashCounts,
  getCashLines,
  getCashReports,
  linesTotal,
} from "@/lib/treasury-cash";
import { formatMoney } from "@/lib/treasury-format";
import { getLedgerCatalog, todayISO } from "@/lib/treasury-ledger";
import { isNationalLocality } from "@/lib/types";
import { saveCashCountAction, setCashBoxActiveAction } from "../actions";
import { BoxForm } from "../box-form";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  borrador: "bg-bg text-muted",
  enviada: "bg-amber/15 text-amber",
  devuelta: "bg-rose-50 text-rose-700",
  aprobada: "bg-green/15 text-green",
};

export default async function CajaDetallePage({ params }: { params: { id: string } }) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();
  const today = todayISO();

  const box = await getCashBox(supabase, params.id);
  if (!box) notFound();

  const [catalog, allBoxes, balance, counts, reports] = await Promise.all([
    getLedgerCatalog(supabase, session.locality.id, { nationwide: isNationalLocality(session.locality) }),
    getCashBoxes(supabase, { includeInactive: true }),
    getCashBoxBalance(supabase, box.id),
    getCashCounts(supabase, box.id, 12),
    getCashReports(supabase, { boxId: box.id, limit: 24 }),
  ]);
  const openReports = reports.filter((r) => r.status !== "aprobada");
  const lines = await getCashLines(supabase, reports.map((r) => r.id));
  const linesByReport = new Map<string, typeof lines>();
  for (const l of lines) linesByReport.set(l.report_id, [...(linesByReport.get(l.report_id) ?? []), l]);
  const pendingLines = openReports.flatMap((r) => linesByReport.get(r.id) ?? []);
  const expected = expectedCash(balance, pendingLines);

  const accountName = new Map(catalog.accounts.map((a) => [a.id, a.name]));
  const name = accountName.get(box.account_id) ?? "Caja chica";
  const holder = box.holder_profile_id
    ? catalog.members.find((m) => m.id === box.holder_profile_id)?.full_name ??
      ((await supabase.from("profiles").select("full_name").eq("id", box.holder_profile_id).maybeSingle()).data as
        | { full_name: string | null }
        | null)?.full_name ??
      "—"
    : null;
  const fixed = fixedOf(box);
  const last = counts[0] ?? null;
  const lastDiffs = last
    ? cashDifferences(
        [
          { currency: "UYU", amount: last.counted_uyu },
          { currency: "USD", amount: last.counted_usd },
        ],
        [
          { currency: "UYU", amount: last.expected_uyu },
          { currency: "USD", amount: last.expected_usd },
        ]
      )
    : [];
  const taken = new Set(allBoxes.boxes.map((b) => b.account_id));
  const over = fixed
    .map((f) => ({ ...f, balance: balance.find((b) => b.currency === f.currency)?.amount ?? 0 }))
    .filter((f) => f.balance > f.amount + 0.005);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/tesoreria/cajas", label: "Cajas chicas" }}
        eyebrow="Tesorería · Cajas chicas"
        title={name}
        description={
          holder ? `Responsable: ${holder}.` : "La maneja el tesorero: sin responsable en la app."
        }
        actions={
          <form action={setCashBoxActiveAction}>
            <input type="hidden" name="id" value={box.id} />
            <input type="hidden" name="active" value={box.is_active ? "0" : "1"} />
            <Button type="submit" variant="secondary">
              {box.is_active ? "Desactivar la caja" : "Reactivar la caja"}
            </Button>
          </form>
        }
      />

      {over.length > 0 && (
        <div className="mb-4">
          <Banner tone="warning">
            La caja tiene más que su fondo fijo (
            {over.map((o) => `${formatMoney(o.balance, o.currency)} contra ${formatMoney(o.amount, o.currency)}`).join(", ")}
            ). Suele pasar cuando entran aportes en efectivo a la caja: conviene depositarlos íntegros en la cuenta.
          </Banner>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Estado */}
        <Card>
          <h2 className="font-display text-[18px] font-semibold text-dark">Estado</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <Stat label="Fondo fijo" value={fixed.length ? fixed.map((f) => formatMoney(f.amount, f.currency)).join(" · ") : "Sin definir"} />
            <Stat label="Saldo en el libro" value={balance.length ? balance.map((b) => formatMoney(b.amount, b.currency)).join(" · ") : "—"} />
            <Stat
              label="Debería haber en efectivo"
              value={expected.length ? expected.map((e) => formatMoney(e.amount, e.currency)).join(" · ") : "—"}
              help="El saldo del libro menos los gastos que el responsable ya cargó y todavía no entraron (su rendición abierta). Es contra esto que se compara el arqueo."
            />
            <Stat
              label="Último arqueo"
              value={last ? `${formatDate(last.counted_on)} · ${lastDiffs.length === 0 ? "cuadró" : "con diferencia"}` : "Nunca"}
              tone={!last ? "warn" : lastDiffs.length === 0 ? "ok" : "alert"}
            />
          </dl>
          {box.source_account_id && (
            <p className="mt-3 text-[12px] text-muted">
              Se repone desde {accountName.get(box.source_account_id) ?? "—"}.
            </p>
          )}
          {box.notes && <p className="mt-2 text-[12.5px] text-dark/80">{box.notes}</p>}
        </Card>

        {/* Arqueo */}
        <Card>
          <h2 className="flex items-center gap-2 font-display text-[18px] font-semibold text-dark">
            Arqueo
            <HelpTip
              title="Arqueo"
              text="Contar la plata que hay en la caja y anotarlo. La app compara con lo que debería haber y guarda el resultado con fecha. Si cuadra, queda registrado que cuadró; si no, registrás el ajuste en el libro con su motivo (faltante o sobrante). Conviene hacerlo cada mes, antes del cierre."
            />
          </h2>
          <form action={saveCashCountAction} className="mt-3 flex flex-col gap-3">
            <input type="hidden" name="box_id" value={box.id} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Fecha" name="counted_on">
                <DateInput id="counted_on" name="counted_on" defaultValue={today} />
              </Field>
              <Field label="Pesos contados" name="counted_uyu">
                <TextInput id="counted_uyu" name="counted_uyu" inputMode="decimal" placeholder="0" />
              </Field>
              <Field label="Dólares contados" name="counted_usd">
                <TextInput id="counted_usd" name="counted_usd" inputMode="decimal" placeholder="0" />
              </Field>
            </div>
            <Field label="Nota" name="note" hint="opcional">
              <TextArea id="note" name="note" rows={2} placeholder="Quién contó, dónde, algo para recordar…" />
            </Field>
            <div className="flex justify-end">
              <Button type="submit">Registrar el arqueo</Button>
            </div>
          </form>
          {lastDiffs.length > 0 && (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12.5px] text-rose-800">
              <strong>El último arqueo no cuadró:</strong>{" "}
              {lastDiffs.map((d) => `${d.amount > 0 ? "sobran" : "faltan"} ${formatMoney(Math.abs(d.amount), d.currency)}`).join(", ")}.
              <div className="mt-2 flex flex-wrap gap-2">
                {lastDiffs.map((d) => (
                  <Link
                    key={d.currency}
                    href={`/admin/tesoreria/libro?cuenta=${box.account_id}&tipo=${d.amount > 0 ? "ingreso" : "gasto"}&moneda=${d.currency}&monto=${Math.abs(d.amount).toFixed(2)}&detalle=${encodeURIComponent(
                      `Ajuste por arqueo del ${formatDate(last!.counted_on)} (${d.amount > 0 ? "sobrante" : "faltante"})`
                    )}`}
                    className="rounded-lg bg-rose-700 px-3 py-1.5 text-[12px] font-semibold text-white"
                  >
                    Registrar el ajuste de {formatMoney(Math.abs(d.amount), d.currency)}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {counts.length > 0 && (
            <ul className="mt-4 divide-y divide-black/[0.05] text-[12.5px]">
              {counts.map((c) => {
                const diffs = cashDifferences(
                  [
                    { currency: "UYU", amount: c.counted_uyu },
                    { currency: "USD", amount: c.counted_usd },
                  ],
                  [
                    { currency: "UYU", amount: c.expected_uyu },
                    { currency: "USD", amount: c.expected_usd },
                  ]
                );
                return (
                  <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
                    <span className="text-dark">
                      {formatDate(c.counted_on)} · contado {formatMoney(c.counted_uyu, "UYU")}
                      {c.counted_usd > 0 || c.expected_usd > 0 ? ` y ${formatMoney(c.counted_usd, "USD")}` : ""}
                    </span>
                    <span className={diffs.length === 0 ? "font-semibold text-green" : "font-semibold text-rose-700"}>
                      {diffs.length === 0
                        ? "cuadró"
                        : diffs.map((d) => `${d.amount > 0 ? "+" : "−"} ${formatMoney(Math.abs(d.amount), d.currency)}`).join(" · ")}
                    </span>
                    {c.note && <span className="w-full text-[11.5px] text-muted">{c.note}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Rendiciones */}
      <Card className="mt-4">
        <h2 className="flex items-center gap-2 font-display text-[18px] font-semibold text-dark">
          Rendiciones
          <HelpTip
            title="Rendición"
            text="El responsable acumula sus gastos y, cuando rinde, cuenta la plata y envía. Al aprobarla, cada gasto entra al libro como un asiento con su comprobante y se carga la reposición desde la cuenta de origen. Si algo no cierra, se devuelve con una nota y el responsable corrige."
          />
        </h2>
        {reports.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted">
            Todavía no hay rendiciones.{" "}
            {holder ? "El responsable carga sus gastos desde «Mi caja chica» en la app." : "Sin responsable en la app, los gastos de esta caja se cargan en el Libro como siempre."}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-black/[0.05]">
            {reports.map((r) => {
              const rl = linesByReport.get(r.id) ?? [];
              const totals = linesTotal(rl);
              return (
                <li key={r.id}>
                  <Link
                    href={`/admin/tesoreria/cajas/${box.id}/rendicion/${r.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 hover:text-terra"
                  >
                    <span className="flex items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_TONE[r.status]}`}>
                        {CASH_REPORT_STATUS_LABEL[r.status]}
                      </span>
                      <span className="text-[13px] font-medium text-dark">
                        {r.submitted_at ? `Enviada el ${formatDateTime(r.submitted_at)}` : `Abierta el ${formatDate(r.created_at)}`}
                      </span>
                    </span>
                    <span className="text-[12.5px] tabular-nums text-muted">
                      {rl.length} {rl.length === 1 ? "gasto" : "gastos"}
                      {totals.length > 0 && ` · ${totals.map((t) => formatMoney(t.amount, t.currency)).join(" · ")}`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="mt-4">
        <h2 className="font-display text-[18px] font-semibold text-dark">Ajustes de la caja</h2>
        <div className="mt-3">
          <BoxForm catalog={catalog} box={box} takenAccountIds={taken} />
        </div>
      </Card>
    </>
  );
}

function Stat({
  label,
  value,
  help,
  tone,
}: {
  label: string;
  value: string;
  help?: string;
  tone?: "ok" | "warn" | "alert";
}) {
  const color = tone === "ok" ? "text-green" : tone === "warn" ? "text-amber" : tone === "alert" ? "text-rose-700" : "text-dark";
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted">
        {label}
        {help && <HelpTip text={help} />}
      </dt>
      <dd className={`mt-0.5 text-[14px] font-semibold tabular-nums ${color}`}>{value}</dd>
    </div>
  );
}
