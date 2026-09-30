import Link from "next/link";
import { Banner, Button, Card, DateInput, Field, PageHeader, Select, TextArea, TextInput } from "@/components/admin/ui";
import { HelpTip } from "@/components/HelpTip";
import { IconArrowRight } from "@/components/Icons";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { activeMembers, getLocalityMembers } from "@/lib/memberships";
import { createSupabaseServer } from "@/lib/supabase/server";
import { monthLabel } from "@/lib/treasury-cashbook";
import { HANDOVER_STEPS } from "@/lib/treasury-guide";
import { getHandoverData } from "@/lib/treasury-handover";
import { TREASURY_HELP } from "@/lib/treasury-help";
import { formatMoney } from "@/lib/treasury-format";
import { todayISO } from "@/lib/treasury-ledger";

export const dynamic = "force-dynamic";

/**
 * Traspaso de la Tesorería: el acta para firmar y los pasos del cambio.
 * La foto que muestra acá es la misma que va al PDF (getHandoverData al
 * día de hoy), para que quien la genera vea antes lo que va a firmar.
 */
export default async function TraspasoPage() {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();
  const today = todayISO();

  const [data, members] = await Promise.all([
    getHandoverData(supabase, { localityId: session.locality.id, asOf: today }),
    getLocalityMembers(supabase, session.locality.id),
  ]);
  const people = activeMembers(members)
    .filter((m) => m.id !== session.user.id)
    .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "", "es"));
  const open = data.closings.openMonths;
  const boxesWithoutCount = data.cashBoxes.filter((c) => !c.lastCount);

  return (
    <>
      <PageHeader
        eyebrow="Tesorería"
        help={TREASURY_HELP.screens.traspaso}
        title="Traspaso de la Tesorería"
        description="El acta que firman quien entrega y quien recibe, con la foto del libro ese día, y los pasos del cambio en la app."
      />

      {(open.length > 0 || boxesWithoutCount.length > 0 || (data.audit && data.audit.pendingHigh > 0)) && (
        <div className="mb-4">
          <Banner tone="warning">
            <strong>Antes de firmar conviene dejar esto prolijo:</strong>{" "}
            {open.length > 0 && `${open.length === 1 ? "hay un mes abierto" : `hay ${open.length} meses abiertos`} (${open.map(monthLabel).join(", ")}). `}
            {boxesWithoutCount.length > 0 && `${boxesWithoutCount.map((c) => c.name).join(", ")} sin arqueo registrado. `}
            {data.audit && data.audit.pendingHigh > 0 && `${data.audit.pendingHigh} hallazgo(s) grave(s) de auditoría sin resolver.`}
            {" "}El acta igual se puede generar: lo que quede abierto sale escrito en ella.
          </Banner>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card>
          <h2 className="flex items-center gap-2 font-display text-[18px] font-semibold text-dark">
            Lo que dice el libro hoy
            <HelpTip text="Es exactamente lo que va a imprimir el acta si la generás con la fecha de hoy: saldos por cuenta y moneda sin anulados, el efectivo de las cajas con su último arqueo, hasta qué mes está cerrado, la serie de recibos y la auditoría." />
          </h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {data.totals.map((t) => (
              <Stat key={t.currency} label={`Total en ${t.currency}`} value={formatMoney(t.amount, t.currency)} />
            ))}
            <Stat label="Meses cerrados hasta" value={data.closings.lastClosed ? monthLabel(data.closings.lastClosed) : "ninguno"} tone={open.length ? "warn" : "ok"} />
            <Stat label="Último recibo" value={data.receipts.lastNumber ? `N.º ${data.receipts.lastNumber}` : "—"} />
            <Stat label="Recibos sin emitir" value={String(data.receipts.unissued)} tone={data.receipts.unissued ? "warn" : "ok"} />
            <Stat
              label="Auditoría"
              value={
                data.audit?.runAt
                  ? `${formatDate(data.audit.runAt)} · ${data.audit.pendingHigh} graves`
                  : "nunca"
              }
              tone={!data.audit?.runAt || data.audit.pendingHigh ? "warn" : "ok"}
            />
          </dl>
          <ul className="mt-4 divide-y divide-black/[0.05] text-[13px]">
            {data.balances.map((b) => (
              <li key={`${b.account}|${b.currency}`} className="flex justify-between py-1.5">
                <span className="text-dark">
                  {b.account} <span className="text-muted">· {b.currency}</span>
                </span>
                <span className={`tabular-nums font-semibold ${b.amount < 0 ? "text-rose-700" : "text-dark"}`}>
                  {formatMoney(b.amount, b.currency)}
                </span>
              </li>
            ))}
          </ul>
          {data.cashBoxes.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5 text-[12.5px]">
              {data.cashBoxes.map((c) => (
                <li key={c.name} className="rounded-xl bg-bg/60 px-3 py-2">
                  <span className="font-semibold text-dark">{c.name}</span>
                  {c.holder && <span className="text-muted"> · {c.holder}</span>}
                  <span className={`ml-2 ${c.lastCount ? (c.lastCount.ok ? "text-green" : "text-rose-700") : "text-amber"}`}>
                    {c.lastCount ? `arqueo ${formatDate(c.lastCount.on)}: ${c.lastCount.ok ? "cuadró" : c.lastCount.diffs.join(", ")}` : "sin arqueo"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="font-display text-[18px] font-semibold text-dark">Generar el acta</h2>
          <p className="mb-3 mt-1 text-[12.5px] text-muted">
            Se abre en PDF para imprimir. Se firma en papel, con un testigo de la Asamblea, y se
            archiva con el legajo.
          </p>
          <form action="/admin/tesoreria/traspaso/pdf" method="get" target="_blank" className="flex flex-col gap-3">
            <Field label="Fecha del acta" name="fecha">
              <DateInput id="fecha" name="fecha" defaultValue={today} />
            </Field>
            <Field label="Entrega (Tesorero/a saliente)" name="entrega">
              <TextInput id="entrega" name="entrega" defaultValue={session.profile.full_name ?? ""} />
            </Field>
            <Field label="Recibe (Tesorero/a entrante)" name="recibe" required>
              <Select id="recibe" name="recibe" defaultValue="" required>
                <option value="">— Elegir —</option>
                {people.map((m) => (
                  <option key={m.id} value={m.full_name ?? ""}>
                    {m.full_name ?? "Sin nombre"}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Testigo (Secretario/a u otro miembro)" name="testigo" hint="opcional">
              <Select id="testigo" name="testigo" defaultValue="">
                <option value="">— Sin testigo —</option>
                {people.map((m) => (
                  <option key={m.id} value={m.full_name ?? ""}>
                    {m.full_name ?? "Sin nombre"}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Observaciones" name="notas" hint="opcional">
              <TextArea id="notas" name="notas" rows={3} placeholder="Diferencias de arqueo, meses que quedan abiertos, qué falta entregar…" />
            </Field>
            <Button type="submit">Generar el acta (PDF)</Button>
          </form>
        </Card>
      </div>

      <div className="mt-6">
        <h2 className="font-display text-[20px] font-semibold text-dark">Los pasos del cambio en la app</h2>
        <p className="mt-1 text-[13px] text-muted">En este orden, el día del traspaso.</p>
        <ol className="mt-3 flex flex-col gap-2">
          {HANDOVER_STEPS.map((step, i) => (
            <li key={step.title}>
              <Card>
                <div className="flex flex-col gap-3 md:flex-row md:items-start">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/15 font-display text-[16px] font-bold text-gold-dark">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-semibold text-dark">{step.title}</h3>
                    <p className="mt-0.5 text-[12.5px] text-dark/80">{step.detail}</p>
                  </div>
                  <Link
                    href={step.href}
                    className="tap inline-flex w-fit shrink-0 items-center gap-1.5 rounded-xl border border-black/10 bg-card px-3 py-1.5 text-[12.5px] font-semibold text-dark hover:bg-bg"
                  >
                    {step.cta} <IconArrowRight size={12} />
                  </Link>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div>
      <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className={`mt-0.5 text-[14px] font-semibold tabular-nums ${tone === "ok" ? "text-green" : tone === "warn" ? "text-amber" : "text-dark"}`}>
        {value}
      </dd>
    </div>
  );
}
