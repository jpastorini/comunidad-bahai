"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Banner, Button, Card, Field, Select, TextArea, TextInput } from "@/components/admin/ui";
import { formatMoney } from "@/lib/treasury-format";
import type { ImportPlan, ImportWarning, OpeningCheck } from "@/lib/ledger-import";
import type { LedgerImport } from "@/lib/treasury-imports";
import {
  confirmImportAction,
  previewImportAction,
  undoImportAction,
  type ConfirmResult,
} from "./actions";

/**
 * Un solo formulario y dos pasos sobre él: "Ver qué entra" arma el plan
 * sin guardar nada, y "Importar" vuelve a mandar el MISMO archivo para
 * que el servidor lo lea de nuevo. No se guarda el plan entre los dos
 * pasos a propósito (ver el comentario de actions.ts): el parser es puro,
 * así que releer da lo mismo, y de esa forma no existe un estado
 * intermedio que pueda quedar viejo entre lo que se aprobó y lo que
 * entra al libro.
 *
 * Cualquier cambio en el año, el archivo o el tratamiento de las
 * aperturas tira el plan: un resumen que describe otra cosa que la que
 * está cargada es peor que no tener resumen.
 */

const ACCEPT = ".xlsx,.xls,.csv";

const FIELD_LABELS: Record<string, string> = {
  date: "Fecha",
  account: "Cuenta",
  subcategory: "Rubro",
  category: "Categoría",
  fund: "Fondo",
  currency: "Moneda",
  income: "Ingreso",
  expense: "Gasto",
  amount: "Importe",
  receipt: "Recibo",
  count: "Cantidad de aportes",
  description: "Descripción",
  contributor: "Contribuyente",
  receiptIssued: "Recibo emitido",
};

export function ImportClient({
  suggestedYear,
  ledgerYears,
  imports,
  migrationMissing,
}: {
  suggestedYear: number;
  ledgerYears: number[];
  imports: LedgerImport[];
  migrationMissing: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [done, setDone] = useState<Extract<ConfirmResult, { ok: true }> | null>(null);

  function reset() {
    setPlan(null);
    setError(null);
    setDone(null);
  }

  function preview() {
    const form = formRef.current;
    if (!form) return;
    setDone(null);
    startTransition(async () => {
      const res = await previewImportAction(new FormData(form));
      if (res.ok) {
        setPlan(res.plan);
        setError(null);
      } else {
        setPlan(null);
        setError(res.error);
      }
    });
  }

  function confirm() {
    const form = formRef.current;
    if (!form) return;
    startTransition(async () => {
      const res = await confirmImportAction(new FormData(form));
      if (res.ok) {
        setDone(res);
        setPlan(null);
        setError(null);
        form.reset();
        setFileName(null);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      {migrationMissing && (
        <Banner tone="warning">
          Falta aplicar la migración <strong>062</strong> en Supabase. Hasta entonces se puede
          ver qué entraría, pero no importar.
        </Banner>
      )}

      <Card>
        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            preview();
          }}
          className="grid gap-4 md:grid-cols-[180px_1fr_auto] md:items-end"
        >
          <Field
            label="Ejercicio"
            name="bahai_year"
            required
            hint="Año bahá'í al que se asignan"
          >
            <TextInput
              id="bahai_year"
              name="bahai_year"
              type="number"
              min={100}
              max={300}
              defaultValue={suggestedYear}
              required
              onChange={reset}
            />
          </Field>
          <Field
            label="Planilla del ejercicio"
            name="file"
            required
            hint="El Excel con que se llevaba el libro ese año (.xlsx, .xls o .csv)"
          >
            <input
              id="file"
              name="file"
              type="file"
              accept={ACCEPT}
              required
              onChange={(e) => {
                setFileName(e.currentTarget.files?.[0]?.name ?? null);
                reset();
              }}
              className="block w-full text-[13px] text-dark file:mr-3 file:rounded-xl file:border-0 file:bg-bg file:px-3.5 file:py-2.5 file:text-[13px] file:font-semibold file:text-dark hover:file:bg-black/5"
            />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? "Leyendo…" : "Ver qué entra"}
          </Button>

          {/* Viajan en el mismo form, así que el plan que se ve y el que
              se importa salen de exactamente los mismos datos. */}
          {plan && plan.openingsMode !== "sin_apertura" && (
            <div className="md:col-span-3">
              <Field
                label="Saldos de apertura de la planilla"
                name="openings"
                hint="La apertura la trae un solo ejercicio, el más viejo: los movimientos del año anterior YA SON la apertura del siguiente."
              >
                <Select
                  id="openings"
                  name="openings"
                  defaultValue={plan.openingsMode}
                  onChange={preview}
                >
                  <option value="verificadas">
                    Solo verificarlas contra el cierre del ejercicio anterior
                  </option>
                  <option value="importadas">
                    Importarlas como asientos (el libro arranca en este ejercicio)
                  </option>
                </Select>
              </Field>
            </div>
          )}
          {plan && (
            <div className="md:col-span-3">
              <Field
                label="Nota de esta importación"
                name="note"
                hint="Opcional. Queda guardada con el lote: dentro de un año nadie se acuerda de qué se dejó pasar."
              >
                <TextArea id="note" name="note" rows={2} />
              </Field>
            </div>
          )}
        </form>

        {fileName && <p className="mt-3 text-[12px] text-muted">{fileName}</p>}
        <p className="mt-3 text-[12px] text-muted">
          Importá del ejercicio más viejo al más nuevo. Nada se guarda hasta que confirmes, y una
          importación se puede deshacer entera mientras no haya un mes cerrado.
        </p>
      </Card>

      {error && <Banner tone="danger">{error}</Banner>}

      {done && (
        <div className="rounded-xl border border-green/40 bg-green/[0.06] px-4 py-3 text-[13px] text-dark">
          Entraron <strong>{done.entries}</strong>{" "}
          {done.entries === 1 ? "movimiento" : "movimientos"}.{" "}
          <Link href="/admin/tesoreria/libro" className="font-semibold underline">
            Ver el libro
          </Link>{" "}
          o{" "}
          <Link href="/admin/tesoreria/auditoria" className="font-semibold underline">
            correr la auditoría
          </Link>
          .
          {done.warning && <p className="mt-1.5 text-[12px] text-amber-800">{done.warning}</p>}
        </div>
      )}

      {plan && (
        <PlanView
          plan={plan}
          ledgerYears={ledgerYears}
          disabled={pending || migrationMissing}
          onConfirm={confirm}
        />
      )}

      <History imports={imports} pending={pending} />
    </div>
  );
}

// ─── El plan ───────────────────────────────────────────────────────────

function PlanView({
  plan,
  ledgerYears,
  disabled,
  onConfirm,
}: {
  plan: ImportPlan;
  ledgerYears: number[];
  disabled: boolean;
  onConfirm: () => void;
}) {
  const alerts = plan.warnings.filter((w) => w.level === "alto");
  const notes = plan.warnings.filter((w) => w.level === "aviso");
  const alreadyImported = ledgerYears.includes(plan.bahaiYear);

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-dark">
          Ejercicio {plan.bahaiYear} · {plan.entries.length}{" "}
          {plan.entries.length === 1 ? "movimiento" : "movimientos"}
        </h2>
        <Button type="button" onClick={onConfirm} disabled={disabled || plan.blockers.length > 0}>
          Importar {plan.entries.length}{" "}
          {plan.entries.length === 1 ? "movimiento" : "movimientos"}
        </Button>
      </div>

      {plan.blockers.length > 0 && (
        <div className="mt-3 rounded-xl border border-red-300 bg-red-50 px-3.5 py-3">
          <h3 className="text-[13px] font-semibold text-red-800">
            Hay que corregir la planilla antes de importar
          </h3>
          <p className="mt-1 text-[12px] text-red-900/80">
            Los números de recibo son únicos por comunidad, así que esto la base no lo aceptaría.
            Corregí el archivo y volvé a subirlo.
          </p>
          <ul className="mt-2 space-y-1">
            {plan.blockers.map((b) => (
              <li key={b} className="text-[12.5px] text-red-900">
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}

      {alreadyImported && (
        <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
          El libro ya tiene movimientos del ejercicio {plan.bahaiYear}. Esto los SUMA, no los
          reemplaza: si estás corrigiendo una importación anterior, deshacela primero abajo.
        </p>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Section title="Totales del archivo">
          {plan.totals.length === 0 && <Empty>Sin movimiento (solo aperturas).</Empty>}
          {plan.totals.map((t) => (
            <Line
              key={t.currency}
              label={t.currency}
              value={`+${formatMoney(t.income, t.currency)} · −${formatMoney(t.expense, t.currency)} · neto ${formatMoney(t.net, t.currency)}`}
            />
          ))}
          {plan.transfersPaired > 0 && (
            <p className="mt-2 text-[12px] text-muted">
              {plan.transfersPaired}{" "}
              {plan.transfersPaired === 1 ? "transferencia atada" : "transferencias atadas"} (las
              dos patas viajan juntas y no cuentan como movimiento del Fondo).
            </p>
          )}
        </Section>

        <Section title="Movimiento por cuenta">
          {plan.balances.map((b) => (
            <Line
              key={`${b.account}|${b.currency}`}
              label={`${b.account} · ${b.currency}`}
              value={formatMoney(b.amount, b.currency)}
            />
          ))}
        </Section>

        <Section title="Catálogo">
          <Line
            label="Se crearían"
            value={`${plan.newAccounts.length} cuentas · ${plan.newFunds.length} fondos · ${plan.newCategories.length} categorías · ${plan.newSubcategories.length} rubros`}
          />
          <NameList label="Cuentas nuevas" names={plan.newAccounts} />
          <NameList label="Fondos nuevos" names={plan.newFunds} />
          <NameList label="Categorías nuevas" names={plan.newCategories} />
          <NameList label="Rubros nuevos" names={plan.newSubcategories.map((s) => s.name)} />
          {plan.newSubcategories.length > 0 && (
            <p className="mt-2 text-[12px] text-muted">
              Mirá los rubros nuevos con atención: si la planilla escribe distinto uno que ya
              existe, el historial de ese rubro queda partido en dos. Se arregla renombrando en
              Catálogo antes de importar.
            </p>
          )}
        </Section>

        <Section title="Contribuyentes">
          <Line label="Ya están en el libro" value={String(plan.knownContributors)} />
          <Line label="Se crearían" value={String(plan.newContributors.length)} />
          <NameList label="Nuevos" names={plan.newContributors} />
        </Section>
      </div>

      {/* Antes que cualquier cifra: qué columna de la planilla se leyó
          como qué. Una columna mal ubicada se ve acá de un vistazo y no
          revisando trescientos importes. */}
      <div className="mt-4">
        <Section title="Cómo se leyó la planilla">
          <p className="text-[12px] text-muted">
            {plan.columns.map((c) => `${FIELD_LABELS[c.field] ?? c.field} ← “${c.header}”`).join(" · ")}
          </p>
          {!plan.columns.some((c) => c.field === "contributor") && (
            <p className="mt-1.5 text-[12px] text-amber-900">
              No encontré una columna de contribuyente: los aportes van a entrar sin nombre.
            </p>
          )}
        </Section>
      </div>

      {plan.openings.length > 0 && (
        <div className="mt-4">
          <Openings plan={plan} />
        </div>
      )}

      {alerts.length > 0 && (
        <div className="mt-4">
          <h3 className="text-[13px] font-semibold text-dark">
            Para mirar antes de confirmar ({alerts.length})
          </h3>
          <WarningList items={alerts} tone="alto" />
        </div>
      )}
      {notes.length > 0 && (
        <div className="mt-4">
          <h3 className="text-[13px] font-semibold text-muted">Avisos ({notes.length})</h3>
          <WarningList items={notes} tone="aviso" />
        </div>
      )}
      {plan.warnings.length === 0 && (
        <p className="mt-4 text-[12.5px] text-green">Sin avisos: el archivo se leyó entero.</p>
      )}
    </Card>
  );
}

function Openings({ plan }: { plan: ImportPlan }) {
  const off = plan.openings.filter((o) => Math.abs(o.diff) >= 0.005);
  const verifying = plan.openingsMode === "verificadas";

  return (
    <div className="rounded-xl border border-black/10 bg-bg/40 px-3.5 py-3">
      <h3 className="text-[13px] font-semibold text-dark">
        {verifying ? "Saldos de apertura: verificación" : "Saldos de apertura: entran al libro"}
      </h3>
      <p className="mt-1 text-[12px] text-muted">
        {verifying
          ? "No entran como asientos: el saldo se arrastra solo desde el ejercicio anterior. Lo que declara la planilla se compara con el cierre calculado."
          : "El libro arranca en este ejercicio, así que la apertura de la planilla entra como asiento."}
      </p>
      <div className="mt-2.5 space-y-1">
        {plan.openings.map((o) => (
          <OpeningRow key={`${o.account}|${o.currency}`} o={o} />
        ))}
      </div>
      {verifying && off.length === 0 && plan.openings.length > 0 && (
        <p className="mt-2 text-[12.5px] text-green">
          Cierra con el ejercicio anterior, cuenta por cuenta.
        </p>
      )}
    </div>
  );
}

function OpeningRow({ o }: { o: OpeningCheck }) {
  const off = Math.abs(o.diff) >= 0.005;
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 text-[12.5px]">
      <span className="text-muted">
        {o.account} · {o.currency}
      </span>
      <span className={off ? "font-semibold text-red-700" : "text-dark"}>
        planilla {formatMoney(o.declared, o.currency)} · libro{" "}
        {formatMoney(o.computed, o.currency)}
        {off && ` · difiere en ${formatMoney(o.diff, o.currency)}`}
      </span>
    </div>
  );
}

function WarningList({ items, tone }: { items: ImportWarning[]; tone: "alto" | "aviso" }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 12);
  return (
    <>
      <ul className="mt-1.5 space-y-1">
        {shown.map((w, i) => (
          <li
            key={`${w.row ?? "x"}-${i}`}
            className={`text-[12.5px] ${tone === "alto" ? "text-amber-900" : "text-muted"}`}
          >
            {w.row != null && <span className="font-semibold">Fila {w.row}: </span>}
            {w.text}
          </li>
        ))}
      </ul>
      {items.length > shown.length && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="mt-1.5 text-[12px] font-semibold text-terra hover:underline"
        >
          Ver los {items.length}
        </button>
      )}
    </>
  );
}

// ─── Lo ya importado ───────────────────────────────────────────────────

function History({ imports, pending }: { imports: LedgerImport[]; pending: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (imports.length === 0) return null;

  async function undo(id: string, year: number, count: number) {
    if (
      !window.confirm(
        `Borrar los ${count} movimientos que trajo esta importación del ejercicio ${year}. El catálogo y los contribuyentes que creó se quedan. ¿Seguimos?`
      )
    )
      return;
    setBusy(id);
    setError(null);
    const fd = new FormData();
    fd.set("id", id);
    const res = await undoImportAction(fd);
    setBusy(null);
    if (res.ok) router.refresh();
    else setError(res.error);
  }

  return (
    <Card>
      <h2 className="text-[15px] font-semibold text-dark">Importaciones hechas</h2>
      {error && <p className="mt-2 text-[12.5px] text-red-700">{error}</p>}
      <div className="mt-3 divide-y divide-black/5">
        {imports.map((i) => {
          const off = (i.openings ?? []).filter((o) => Math.abs(o.diff) >= 0.005).length;
          return (
            <div key={i.id} className="flex flex-wrap items-baseline justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-dark">
                  Ejercicio {i.bahai_year} · {i.entries_count}{" "}
                  {i.entries_count === 1 ? "movimiento" : "movimientos"}
                </p>
                <p className="truncate text-[12px] text-muted">
                  {i.file_name} · {new Date(i.created_at).toLocaleDateString("es-UY")}
                  {i.openings_mode === "verificadas" &&
                    (off === 0
                      ? " · apertura verificada"
                      : ` · apertura con ${off} ${off === 1 ? "diferencia" : "diferencias"}`)}
                  {(i.warnings ?? []).length > 0 && ` · ${i.warnings.length} avisos`}
                </p>
                {i.note && <p className="mt-0.5 text-[12px] text-dark/70">{i.note}</p>}
              </div>
              <button
                type="button"
                onClick={() => undo(i.id, i.bahai_year, i.entries_count)}
                disabled={pending || busy === i.id}
                className="shrink-0 rounded-lg border border-black/10 bg-card px-2.5 py-1.5 text-[12px] font-semibold text-dark transition hover:bg-bg disabled:opacity-40"
              >
                {busy === i.id ? "Deshaciendo…" : "Deshacer"}
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Piezas chicas ─────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-black/10 bg-bg/40 px-3.5 py-3">
      <h3 className="text-[13px] font-semibold text-dark">{title}</h3>
      <div className="mt-2 space-y-1">{children}</div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 text-[12.5px]">
      <span className="text-muted">{label}</span>
      <span className="text-dark">{value}</span>
    </div>
  );
}

function NameList({ label, names }: { label: string; names: string[] }) {
  if (names.length === 0) return null;
  return (
    <p className="text-[12px] text-muted">
      <span className="font-semibold text-dark/70">{label}:</span>{" "}
      {names.slice(0, 8).join(" · ")}
      {names.length > 8 && ` … y ${names.length - 8} más`}
    </p>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[12.5px] text-muted">{children}</p>;
}
