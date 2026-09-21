"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Banner, Button, Card, Field, Select } from "@/components/admin/ui";
import { PLATFORM_LABELS, type StatementLine } from "@/lib/bank-statements";
import { formatMoney, formatReceiptDate } from "@/lib/treasury-format";
import type { ReconcileEntry, ReconcileMatch } from "@/lib/treasury-reconcile";
import { reconcileAction, type ReconcileActionResult } from "./actions";

/**
 * El formulario (cuenta + archivo) y el resultado de la comparación.
 *
 * El resultado vive en el estado del componente y nada más: la acción no
 * escribe, así que no hay nada que revalidar. Volver a "Comparar" con
 * otro archivo reemplaza lo que había.
 */

const ACCEPT = ".xlsx,.xls,.csv";

type Account = { id: string; name: string };

export function ReconcileClient({ accounts }: { accounts: Account[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<ReconcileActionResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  // La cuenta que se llama como la plataforma que ya se lee: un toque menos.
  const defaultAccount =
    accounts.find((a) => /prex/i.test(a.name))?.id ?? accounts[0]?.id ?? "";

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await reconcileAction(fd);
      setOutcome(res);
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <form ref={formRef} onSubmit={submit} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <Field label="Cuenta del libro" name="account_id" required>
            <Select id="account_id" name="account_id" defaultValue={defaultAccount} required>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Extracto de la plataforma"
            name="file"
            required
            hint="Por ahora, Prex (Estado de cuenta → Excel)"
          >
            <input
              id="file"
              name="file"
              type="file"
              accept={ACCEPT}
              required
              onChange={(e) => setFileName(e.currentTarget.files?.[0]?.name ?? null)}
              className="block w-full text-[13px] text-dark file:mr-3 file:rounded-xl file:border-0 file:bg-bg file:px-3.5 file:py-2.5 file:text-[13px] file:font-semibold file:text-dark hover:file:bg-black/5"
            />
          </Field>
          <Button type="submit" disabled={pending || accounts.length === 0}>
            {pending ? "Comparando…" : "Comparar"}
          </Button>
        </form>
        {accounts.length === 0 && (
          <p className="mt-3 text-[12.5px] text-muted">
            No hay cuentas activas en el catálogo del libro.
          </p>
        )}
        {fileName && !outcome && (
          <p className="mt-3 text-[12px] text-muted">{fileName}</p>
        )}
      </Card>

      {outcome && !outcome.ok && <Banner tone="danger">{outcome.error}</Banner>}
      {outcome && outcome.ok && <Outcome data={outcome} />}
    </div>
  );
}

// ─── Resultado ─────────────────────────────────────────────────────────

function Outcome({ data }: { data: Extract<ReconcileActionResult, { ok: true }> }) {
  const { result: r, statement } = data;
  const missingFees = r.matched.filter((m) => m.missingFee != null);
  const pendingCount = r.unmatchedLines.length + missingFees.length;

  return (
    <>
      <Card className={r.clean ? "border-green/40" : "border-amber-300/60"}>
        <div className="text-[10px] font-semibold uppercase tracking-[2px] text-gold-dark">
          {PLATFORM_LABELS[data.platform]} · {data.account.name}
        </div>
        <h2 className="mt-1 font-display text-[22px] font-bold leading-tight text-dark">
          {r.clean ? "El período cierra" : "Hay diferencias"}
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          {data.fileName} · del {formatReceiptDate(r.from)} al {formatReceiptDate(r.to)} ·{" "}
          {statement.lineCount} {statement.lineCount === 1 ? "movimiento" : "movimientos"}
          {statement.skipped.length > 0 && ` (${statement.skipped.length} sin contar)`}
          {r.reversed.length > 0 &&
            ` · ${r.reversed.length} ${r.reversed.length === 1 ? "devuelto por la plataforma" : "devueltos por la plataforma"}`}
        </p>

        <div className="cb-wide mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="py-1.5 pr-3 font-semibold">Moneda</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Movimiento en {PLATFORM_LABELS[data.platform]}</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Movimiento en el libro</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Diferencia</th>
                <th className="py-1.5 text-right font-semibold">Saldo del libro al {formatReceiptDate(r.to)}</th>
              </tr>
            </thead>
            <tbody>
              {r.totals.map((t) => (
                <tr key={t.currency} className="border-t border-black/5">
                  <td className="py-2 pr-3 font-semibold text-dark">{t.currency}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{signed(t.statementNet)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{signed(t.ledgerNet)}</td>
                  <td
                    className={`py-2 pr-3 text-right font-semibold tabular-nums ${
                      Math.abs(t.diff) < 0.005 ? "text-green" : "text-rose-700"
                    }`}
                  >
                    {Math.abs(t.diff) < 0.005 ? "—" : signed(t.diff)}
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatMoney(t.ledgerBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12px] text-muted">
          El extracto de {PLATFORM_LABELS[data.platform]} no trae saldo, así que se compara el
          movimiento neto del período; el saldo es el del libro, para cotejarlo con el de la app.
        </p>

        {statement.warnings.map((w) => (
          <p key={w} className="mt-2 text-[12px] text-amber-800">
            {w}
          </p>
        ))}
        {statement.skipped.length > 0 && (
          <details className="mt-2 text-[12px] text-muted">
            <summary className="cursor-pointer">
              {statement.skipped.length} {statement.skipped.length === 1 ? "fila sin contar" : "filas sin contar"}
            </summary>
            <ul className="mt-1 list-disc pl-5">
              {statement.skipped.map((s) => (
                <li key={s.row}>
                  Fila {s.row}: {s.reason}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>

      <Card>
        <SectionTitle
          title={`En ${PLATFORM_LABELS[data.platform]} y no en el libro`}
          count={pendingCount}
          hint="Lo que la plataforma registró y el libro todavía no: un giro sin cargar, una comisión."
        />
        {pendingCount === 0 ? (
          <Empty>Todo lo que movió la plataforma está en el libro.</Empty>
        ) : (
          <ul className="mt-3 divide-y divide-black/5">
            {r.unmatchedLines.map((l) => (
              <LineRow key={l.key} line={l} hint={l.amount > 0 ? "Ingreso a registrar" : "Gasto a registrar"} />
            ))}
            {missingFees.map((m) => (
              <li key={`fee-${m.line.key}`} className="flex items-baseline justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-[13px] text-dark">
                    Comisión de la transferencia del {formatReceiptDate(m.line.date)}
                  </div>
                  <div className="text-[11.5px] text-muted">
                    La transferencia está en el libro; falta el gasto por la comisión que Prex cobró adentro del importe.
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-semibold tabular-nums text-rose-700">− {formatMoney(m.missingFee!)}</div>
                  <div className="text-[11px] text-muted">Gasto a registrar</div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {pendingCount > 0 && (
          <div className="mt-4">
            <Link
              href="/admin/tesoreria/libro"
              className="text-[13px] font-semibold text-terra hover:underline"
            >
              Abrir el libro →
            </Link>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle
          title={`En el libro y no en ${PLATFORM_LABELS[data.platform]}`}
          count={r.unmatchedEntries.length}
          hint="Movimientos del libro en esa cuenta y ese período que la plataforma no muestra: cargados dos veces, en otra cuenta, o con la fecha corrida."
        />
        {r.unmatchedEntries.length === 0 ? (
          <Empty>Todo lo del libro aparece en la plataforma.</Empty>
        ) : (
          <ul className="mt-3 divide-y divide-black/5">
            {r.unmatchedEntries.map((e) => (
              <EntryRow key={e.id} entry={e} />
            ))}
          </ul>
        )}
      </Card>

      {(r.matched.length > 0 || r.reversed.length > 0) && (
        <Card>
          <details>
            <summary className="cursor-pointer text-[14px] font-semibold text-dark">
              Coincidencias ({r.matched.length})
              {r.reversed.length > 0 && ` · devueltos por la plataforma (${r.reversed.length})`}
            </summary>
            <ul className="mt-3 divide-y divide-black/5">
              {r.matched.map((m) => (
                <MatchRow key={m.line.key} match={m} />
              ))}
              {r.reversed.map((p) => (
                <li key={p.out.key} className="py-2.5 text-[12.5px] text-muted">
                  {formatReceiptDate(p.out.date)} · {p.out.description} ({signed(p.out.amount)}) fue devuelta
                  el {formatReceiptDate(p.back.date)}: no mueve el libro.
                </li>
              ))}
            </ul>
          </details>
        </Card>
      )}
    </>
  );
}

// ─── Piezas ────────────────────────────────────────────────────────────

function signed(n: number): string {
  if (Math.abs(n) < 0.005) return formatMoney(0);
  return `${n < 0 ? "− " : "+ "}${formatMoney(Math.abs(n))}`;
}

function SectionTitle({ title, count, hint }: { title: string; count: number; hint: string }) {
  return (
    <div>
      <h3 className="font-display text-[18px] font-bold text-dark">
        {title}{" "}
        <span
          className={`ml-1 inline-block rounded-full px-2 py-0.5 align-middle text-[11px] font-semibold ${
            count === 0 ? "bg-green/15 text-green" : "bg-amber-100 text-amber-800"
          }`}
        >
          {count}
        </span>
      </h3>
      <p className="mt-1 text-[12.5px] text-muted">{hint}</p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[13px] text-green">{children}</p>;
}

function LineRow({ line, hint }: { line: StatementLine; hint?: string }) {
  return (
    <li className="flex items-baseline justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-[13px] text-dark">
          <span className="tabular-nums text-muted">{formatReceiptDate(line.date)}</span> · {line.description || "Sin descripción"}
        </div>
        <div className="text-[11.5px] text-muted">
          Fila {line.row}
          {line.reference && ` · ref. ${line.reference}`}
          {line.grossAmount != null && ` · pedido ${formatMoney(Math.abs(line.grossAmount))}`}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className={`font-semibold tabular-nums ${line.amount < 0 ? "text-rose-700" : "text-green"}`}>
          {signed(line.amount)} <span className="text-[11px] font-normal text-muted">{line.currency}</span>
        </div>
        {hint && <div className="text-[11px] text-muted">{hint}</div>}
      </div>
    </li>
  );
}

function EntryRow({ entry }: { entry: ReconcileEntry }) {
  return (
    <li className="flex items-baseline justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-[13px] text-dark">
          <span className="tabular-nums text-muted">{formatReceiptDate(entry.entry_date)}</span> ·{" "}
          {entry.rubro ?? "Sin rubro"}
          {entry.description && <span className="text-muted"> · {entry.description}</span>}
        </div>
        <div className="text-[11.5px] text-muted">
          {entry.receipt_number != null && `Recibo N.º ${entry.receipt_number}`}
          {entry.transfer_group_id && (entry.receipt_number != null ? " · " : "") + "Transferencia entre cuentas"}
        </div>
      </div>
      <div className={`shrink-0 font-semibold tabular-nums ${entry.amount < 0 ? "text-rose-700" : "text-green"}`}>
        {signed(entry.amount)} <span className="text-[11px] font-normal text-muted">{entry.currency}</span>
      </div>
    </li>
  );
}

const KIND_LABEL: Record<ReconcileMatch["kind"], string> = {
  exacto: "mismo importe",
  comision: "comisión adentro",
  suma: "dos movimientos que suman",
};

function MatchRow({ match: m }: { match: ReconcileMatch }) {
  return (
    <li className="py-2.5 text-[12.5px]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-dark">
          <span className="tabular-nums text-muted">{formatReceiptDate(m.line.date)}</span> · {m.line.description}
        </span>
        <span className="shrink-0 tabular-nums text-dark">{signed(m.line.amount)}</span>
      </div>
      <div className="text-[11.5px] text-muted">
        {KIND_LABEL[m.kind]}
        {m.dayDiff > 0 && ` · ${m.dayDiff} ${m.dayDiff === 1 ? "día" : "días"} de diferencia`} ·{" "}
        {m.entries
          .map(
            (e) =>
              `${e.rubro ?? "sin rubro"}${e.receipt_number != null ? ` (recibo ${e.receipt_number})` : ""} ${signed(e.amount)}`
          )
          .join(" + ")}
      </div>
    </li>
  );
}
