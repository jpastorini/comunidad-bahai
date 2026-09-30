import Link from "next/link";
import { TREASURY_HELP } from "@/lib/treasury-help";
import { Banner, Card, PageHeader } from "@/components/admin/ui";
import { HelpTip } from "@/components/HelpTip";
import { IconArrowRight } from "@/components/Icons";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  cashDifferences,
  fixedOf,
  getCashBoxBalance,
  getCashBoxes,
  getCashReports,
  getLastCounts,
  daysSince,
} from "@/lib/treasury-cash";
import { formatMoney } from "@/lib/treasury-format";
import { getLedgerCatalog, todayISO } from "@/lib/treasury-ledger";
import { isNationalLocality } from "@/lib/types";
import { BoxForm } from "./box-form";

export const dynamic = "force-dynamic";

/**
 * Tesorería → Cajas chicas (074): las cajas con su responsable, fondo
 * fijo, saldo del libro, último arqueo y rendiciones por revisar; y el
 * alta de una caja nueva.
 */
export default async function CajasPage() {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();
  const today = todayISO();

  const [catalog, boxesRes, lastCounts, pending] = await Promise.all([
    getLedgerCatalog(supabase, session.locality.id, { nationwide: isNationalLocality(session.locality) }),
    getCashBoxes(supabase, { includeInactive: true }),
    getLastCounts(supabase),
    getCashReports(supabase, { statuses: ["enviada"] }),
  ]);
  const boxes = boxesRes.boxes;
  const balances = new Map(
    await Promise.all(boxes.map(async (b) => [b.id, await getCashBoxBalance(supabase, b.id)] as const))
  );
  const holderIds = boxes.map((b) => b.holder_profile_id).filter((x): x is string => !!x);
  const { data: holders } = holderIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", holderIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const holderName = new Map(
    ((holders ?? []) as { id: string; full_name: string | null }[]).map((h) => [h.id, h.full_name ?? "Sin nombre"])
  );
  const accountName = new Map(catalog.accounts.map((a) => [a.id, a.name]));
  const pendingByBox = new Map<string, number>();
  for (const r of pending) pendingByBox.set(r.box_id, (pendingByBox.get(r.box_id) ?? 0) + 1);
  const taken = new Set(boxes.map((b) => b.account_id));

  return (
    <>
      <PageHeader
        eyebrow="Tesorería"
        help={TREASURY_HELP.screens.cajas}
        title="Cajas chicas"
        description="El efectivo que manejan el tesorero, la Secretaría o un coordinador: cada caja con su responsable, su fondo fijo, su rendición y su arqueo."
      />

      {boxesRes.missing && (
        <div className="mb-4">
          <Banner tone="warning">
            <strong>Falta aplicar la migración 074.</strong> Hasta entonces acá no se puede crear
            ni ver ninguna caja.
          </Banner>
        </div>
      )}

      <Card className="mb-5">
        <h2 className="flex items-center gap-2 font-display text-[18px] font-semibold text-dark">
          Cómo funciona
          <HelpTip
            title="Fondo fijo"
            text="Es el esquema estándar para el efectivo: cada caja tiene un monto asignado, una persona responsable, y se repone contra rendición con comprobantes. Un auditor lo reconoce de inmediato."
          />
        </h2>
        <ol className="mt-2 grid gap-2 text-[13px] text-dark/85 md:grid-cols-2">
          <li className="flex gap-2">
            <span className="font-display font-bold text-gold-dark">1</span>
            <span>
              <strong>La caja tiene un fondo fijo</strong> (por ejemplo $ 5.000) y un responsable.
              Se la repone desde Prex o el BROU hasta ese monto.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-display font-bold text-gold-dark">2</span>
            <span>
              <strong>El responsable carga cada gasto</strong> con la foto del comprobante desde
              «Mi caja chica» en la app. No ve el libro.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-display font-bold text-gold-dark">3</span>
            <span>
              <strong>Rinde</strong> cada mes, o antes si la caja baja: cuenta la plata, la declara
              y envía. Vos la revisás; al aprobarla, los gastos entran al libro y la reposición
              queda cargada.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-display font-bold text-gold-dark">4</span>
            <span>
              <strong>Consejo: depositar el efectivo en Prex.</strong> Hoy la colecta de la Fiesta
              entra a la caja del tesorero y se gasta desde ahí, que es lo más sencillo. Pero lo que
              entra y sale en efectivo no lo verifica ningún extracto, solo el arqueo. Cuando puedas,
              depositalo y pagá desde la cuenta.{" "}
              <HelpTip
                title="Por qué conviene"
                text="Si la Fiesta recauda $ 4.000 y se paga la merienda de $ 1.500 con esa misma plata, el libro dice que entraron $ 4.000 y salieron $ 1.500, pero ningún extracto lo confirma: el auditor tiene que creerle al libro. Depositando los $ 4.000 en Prex y pagando los $ 1.500 desde la cuenta (o desde una caja que se repone), cada peso queda verificado por el banco. La auditoría lo marca como hallazgo leve, no como error."
              />
            </span>
          </li>
        </ol>
      </Card>

      {boxes.length > 0 && (
        <div className="mb-5 flex flex-col gap-3">
          {boxes.map((box) => {
            const balance = balances.get(box.id) ?? [];
            const fixed = fixedOf(box);
            const last = lastCounts.get(box.id) ?? null;
            const lastOk = last
              ? cashDifferences(
                  [
                    { currency: "UYU", amount: last.counted_uyu },
                    { currency: "USD", amount: last.counted_usd },
                  ],
                  [
                    { currency: "UYU", amount: last.expected_uyu },
                    { currency: "USD", amount: last.expected_usd },
                  ]
                ).length === 0
              : null;
            const pendingN = pendingByBox.get(box.id) ?? 0;
            const stale = !last || daysSince(last.counted_on, today) > 35;
            return (
              <Link
                key={box.id}
                href={`/admin/tesoreria/cajas/${box.id}`}
                className={`tap group rounded-2xl border border-black/[0.04] bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-elevated ${
                  box.is_active ? "" : "opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-[18px] font-semibold text-dark">
                        {accountName.get(box.account_id) ?? "Caja chica"}
                      </span>
                      {!box.is_active && (
                        <span className="rounded bg-bg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                          Inactiva
                        </span>
                      )}
                      {pendingN > 0 && (
                        <span className="rounded bg-amber/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber">
                          {pendingN === 1 ? "1 rendición por revisar" : `${pendingN} rendiciones por revisar`}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[12.5px] text-muted">
                      {box.holder_profile_id
                        ? `Responsable: ${holderName.get(box.holder_profile_id) ?? "—"}`
                        : "La maneja el tesorero"}
                      {fixed.length > 0 && ` · Fondo fijo ${fixed.map((f) => formatMoney(f.amount, f.currency)).join(" y ")}`}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                      <span>
                        <span className="text-muted">Saldo en el libro: </span>
                        <span className="font-semibold tabular-nums text-dark">
                          {balance.length > 0 ? balance.map((b) => formatMoney(b.amount, b.currency)).join(" · ") : "—"}
                        </span>
                      </span>
                      <span>
                        <span className="text-muted">Último arqueo: </span>
                        <span className={`font-semibold ${stale ? "text-amber" : lastOk === false ? "text-rose-700" : "text-green"}`}>
                          {last
                            ? `${formatDate(last.counted_on)} · ${lastOk ? "cuadró" : "con diferencia"}`
                            : "nunca"}
                        </span>
                      </span>
                    </div>
                  </div>
                  <IconArrowRight size={16} className="shrink-0 text-muted transition group-hover:text-terra" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {!boxesRes.missing && (
        <Card>
          <h2 className="font-display text-[20px] font-semibold text-dark">Nueva caja chica</h2>
          <p className="mb-4 mt-1 text-[12.5px] text-muted">
            Tu «Caja Chica Tesorero» de siempre también va acá: elegila como cuenta y ponele su
            fondo fijo, así tiene arqueo como las demás.
          </p>
          <BoxForm catalog={catalog} takenAccountIds={taken} />
        </Card>
      )}
    </>
  );
}
