"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Banner, Button, Card, Field, Select } from "@/components/admin/ui";
import { PLATFORM_LABELS } from "@/lib/bank-statements";
import { formatMoney, formatReceiptDate } from "@/lib/treasury-format";
import type { ReconcileEntry } from "@/lib/treasury-reconcile";
import type {
  AccountReconciliation,
  LineView,
  StatementImport,
  StoredLine,
} from "@/lib/treasury-statements";
import {
  deleteImportAction,
  dismissLineAction,
  importStatementAction,
  linkLineAction,
  undoLineAction,
  type ImportResult,
} from "./actions";

/**
 * La pantalla de una cuenta: el formulario para importar, el resumen, y
 * las listas de lo que quedó suelto de cada lado con sus acciones.
 *
 * El estado es de servidor: cada action revalida la página y los datos
 * llegan de nuevo por props. Acá viven solo el resultado de la última
 * importación (para mostrarlo una vez) y qué renglón está en edición.
 */

const ACCEPT = ".xlsx,.xls,.csv";

type Account = { id: string; name: string };

const smallBtn =
  "rounded-lg border border-black/10 bg-card px-2.5 py-1.5 text-[12px] font-semibold text-dark transition hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40";
const inputClass =
  "w-full rounded-xl border border-black/10 bg-bg/40 px-3 py-2 text-[13px] text-dark outline-none focus:border-terra";

export function ReconcileClient({
  accounts,
  accountsWithImports,
  accountId,
  migrationMissing,
  data,
}: {
  accounts: Account[];
  accountsWithImports: string[];
  accountId: string;
  migrationMissing: boolean;
  data: AccountReconciliation | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const account = accounts.find((a) => a.id === accountId) ?? null;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const res = await importStatementAction(fd);
      setOutcome(res);
      if (res.ok) {
        form.reset();
        setFileName(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      {accounts.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {accounts.map((a) => {
            const active = a.id === accountId;
            const has = accountsWithImports.includes(a.id);
            return (
              <Link
                key={a.id}
                href={`/admin/tesoreria/conciliacion?cuenta=${a.id}`}
                className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition ${
                  active
                    ? "bg-terra text-white"
                    : "border border-black/10 bg-card text-dark hover:bg-bg"
                }`}
              >
                {a.name}
                {has && !active && <span className="ml-1 text-[10px] text-muted">●</span>}
              </Link>
            );
          })}
        </div>
      )}

      {migrationMissing && (
        <Banner tone="warning">
          Falta aplicar la migración <strong>061</strong> en Supabase. Hasta entonces la
          conciliación no puede guardar lo importado.
        </Banner>
      )}

      <Card>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <Field label="Cuenta del libro" name="account_id" required>
            <Select
              id="account_id"
              name="account_id"
              value={accountId}
              onChange={(e) => router.push(`/admin/tesoreria/conciliacion?cuenta=${e.currentTarget.value}`)}
              required
            >
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
            hint="Prex: Estado de cuenta → Excel · BROU: Saldos y Movimientos → Excel"
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
          <Button type="submit" disabled={pending || accounts.length === 0 || migrationMissing}>
            {pending ? "Importando…" : "Importar"}
          </Button>
        </form>
        {accounts.length === 0 && (
          <p className="mt-3 text-[12.5px] text-muted">No hay cuentas activas en el catálogo del libro.</p>
        )}
        {fileName && <p className="mt-3 text-[12px] text-muted">{fileName}</p>}
        <p className="mt-3 text-[12px] text-muted">
          Volver a importar un archivo que se superpone con el anterior no duplica nada: las
          líneas ya conocidas se ignoran. El archivo original queda guardado.
        </p>
      </Card>

      {outcome && !outcome.ok && <Banner tone="danger">{outcome.error}</Banner>}
      {outcome && outcome.ok && <ImportSummary result={outcome} onClose={() => setOutcome(null)} />}

      {data && account && <AccountState data={data} account={account} />}
    </div>
  );
}

// ─── Resultado de la última importación ────────────────────────────────

function ImportSummary({ result: r, onClose }: { result: Extract<ImportResult, { ok: true }>; onClose: () => void }) {
  return (
    <div className="rounded-xl border border-green/40 bg-green/[0.06] px-4 py-3 text-[13px] text-dark">
      <div className="flex items-start justify-between gap-3">
        <div>
          <strong>{PLATFORM_LABELS[r.platform]}</strong>: {r.total} {r.total === 1 ? "movimiento leído" : "movimientos leídos"}
          {" · "}
          {r.newCount} {r.newCount === 1 ? "nuevo" : "nuevos"}
          {r.knownCount > 0 && ` · ${r.knownCount} ya ${r.knownCount === 1 ? "estaba" : "estaban"}`}
          {" · "}
          {r.matchedCount} {r.matchedCount === 1 ? "cerró" : "cerraron"} con el libro
          {r.dismissedCount > 0 && ` · ${r.dismissedCount} ${r.dismissedCount === 1 ? "descartada" : "descartadas"} en automático`}
        </div>
        <button type="button" onClick={onClose} className="shrink-0 text-[12px] text-muted hover:text-dark">
          Cerrar
        </button>
      </div>
      {r.warnings.map((w) => (
        <p key={w} className="mt-1.5 text-[12px] text-amber-800">
          {w}
        </p>
      ))}
    </div>
  );
}

// ─── Estado de la cuenta ───────────────────────────────────────────────

function AccountState({ data: d, account }: { data: AccountReconciliation; account: Account }) {
  const router = useRouter();
  const platform = d.imports[0]?.platform ?? null;
  const platformLabel = platform ? PLATFORM_LABELS[platform] : "la plataforma";
  const feeGaps = d.matched.filter((m) => Math.abs(m.diff) >= 0.005);
  const pendingCount = d.pending.length + feeGaps.length;
  const clean =
    d.coverage != null &&
    pendingCount === 0 &&
    d.pendingEntries.length === 0 &&
    d.totals.every((t) => Math.abs(t.diff) < 0.005 && (t.balanceDiff == null || Math.abs(t.balanceDiff) < 0.005));
  const hasStatementBalance = d.totals.some((t) => t.statementBalance != null);

  if (d.imports.length === 0) {
    return (
      <Card>
        <p className="py-4 text-center text-[13px] text-muted">
          Todavía no se importó ningún extracto de <strong>{account.name}</strong>.
        </p>
      </Card>
    );
  }

  return (
    <>
      <Card className={clean ? "border-green/40" : "border-amber-300/60"}>
        <div className="text-[10px] font-semibold uppercase tracking-[2px] text-gold-dark">
          {platformLabel} · {account.name}
        </div>
        <h2 className="mt-1 font-display text-[22px] font-bold leading-tight text-dark">
          {clean ? "Todo cerrado" : "Hay diferencias"}
        </h2>
        {d.coverage && (
          <p className="mt-1 text-[13px] text-muted">
            Extractos del {formatReceiptDate(d.coverage.from)} al {formatReceiptDate(d.coverage.to)} ·{" "}
            {d.imports.length} {d.imports.length === 1 ? "importación" : "importaciones"} ·{" "}
            {d.pending.length + d.matched.length + d.dismissed.length} líneas
          </p>
        )}

        {d.totals.length > 0 && (
          <div className="cb-wide mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="py-1.5 pr-3 font-semibold">Moneda</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Movimiento en {platformLabel}</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Movimiento en el libro</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Diferencia</th>
                  {hasStatementBalance && (
                    <th className="py-1.5 pr-3 text-right font-semibold">Saldo en {platformLabel}</th>
                  )}
                  <th className="py-1.5 pr-3 text-right font-semibold">
                    Saldo del libro al {d.coverage ? formatReceiptDate(d.coverage.to) : ""}
                  </th>
                  {hasStatementBalance && <th className="py-1.5 text-right font-semibold">Diferencia de saldo</th>}
                </tr>
              </thead>
              <tbody>
                {d.totals.map((t) => (
                  <tr key={t.currency} className="border-t border-black/5">
                    <td className="py-2 pr-3 font-semibold text-dark">{t.currency}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{signed(t.statementNet)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{signed(t.ledgerNet)}</td>
                    <td className={`py-2 pr-3 text-right font-semibold tabular-nums ${diffTone(t.diff)}`}>
                      {Math.abs(t.diff) < 0.005 ? "—" : signed(t.diff)}
                    </td>
                    {hasStatementBalance && (
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {t.statementBalance == null ? "—" : formatMoney(t.statementBalance)}
                      </td>
                    )}
                    <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(t.ledgerBalance)}</td>
                    {hasStatementBalance && (
                      <td className={`py-2 text-right font-semibold tabular-nums ${diffTone(t.balanceDiff ?? 0)}`}>
                        {t.balanceDiff == null || Math.abs(t.balanceDiff) < 0.005 ? "—" : signed(t.balanceDiff)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[12px] text-muted">
          {hasStatementBalance && d.latestBalance
            ? `El saldo en ${platformLabel} es el que declaró el archivo más reciente, al ${formatReceiptDate(d.latestBalance.asOf)}; el del libro, al último movimiento importado. Si hubo movimientos entre las dos fechas, difieren por eso.`
            : `El extracto de ${platformLabel} no trae saldo, así que se compara el movimiento neto del período cubierto; el saldo es el del libro, para cotejarlo con el de la app.`}
        </p>
      </Card>

      <Card>
        <SectionTitle
          title={`En ${platformLabel} y no en el libro`}
          count={pendingCount}
          hint="Lo que la plataforma registró y el libro todavía no: un giro sin cargar, una comisión. Cargalo en el libro y volvé a importar, o vinculalo a mano si ya está con otra fecha o importe."
        />
        {pendingCount === 0 ? (
          <Empty>Todo lo que movió la plataforma está en el libro.</Empty>
        ) : (
          <ul className="mt-3 divide-y divide-black/5">
            {d.pending.map((l) => (
              <PendingLineRow key={l.id} line={l} candidates={d.candidates} onChanged={() => router.refresh()} />
            ))}
            {feeGaps.map((m) => (
              <FeeGapRow key={`gap-${m.line.id}`} view={m} candidates={d.candidates} onChanged={() => router.refresh()} />
            ))}
          </ul>
        )}
        {pendingCount > 0 && (
          <div className="mt-4">
            <Link href="/admin/tesoreria/libro" className="text-[13px] font-semibold text-terra hover:underline">
              Abrir el libro →
            </Link>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle
          title={`En el libro y no en ${platformLabel}`}
          count={d.pendingEntries.length}
          hint="Movimientos del libro en esa cuenta, dentro del período cubierto, que la plataforma no muestra: cargados dos veces, en otra cuenta, o con la fecha corrida. Se resuelven desde el libro, o vinculando la línea correcta acá arriba."
        />
        {d.pendingEntries.length === 0 ? (
          <Empty>Todo lo del libro aparece en la plataforma.</Empty>
        ) : (
          <ul className="mt-3 divide-y divide-black/5">
            {d.pendingEntries.map((e) => (
              <li key={e.id} className="py-2.5">
                <EntryLine entry={e} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {(d.matched.length > 0 || d.dismissed.length > 0) && (
        <Card>
          <details>
            <summary className="cursor-pointer text-[14px] font-semibold text-dark">
              Cerradas ({d.matched.length})
              {d.dismissed.length > 0 && ` · descartadas (${d.dismissed.length})`}
            </summary>
            <ul className="mt-3 divide-y divide-black/5">
              {d.matched.map((m) => (
                <MatchedRow key={m.line.id} view={m} onChanged={() => router.refresh()} />
              ))}
              {d.dismissed.map((l) => (
                <DismissedRow key={l.id} line={l} onChanged={() => router.refresh()} />
              ))}
            </ul>
          </details>
        </Card>
      )}

      <Card>
        <details>
          <summary className="cursor-pointer text-[14px] font-semibold text-dark">
            Importaciones ({d.imports.length})
          </summary>
          <ul className="mt-3 divide-y divide-black/5">
            {d.imports.map((i) => (
              <ImportRow key={i.id} imp={i} onChanged={() => router.refresh()} />
            ))}
          </ul>
        </details>
      </Card>
    </>
  );
}

// ─── Renglones ─────────────────────────────────────────────────────────

function PendingLineRow({
  line,
  candidates,
  onChanged,
}: {
  line: StoredLine;
  candidates: ReconcileEntry[];
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<null | "link" | "dismiss">(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const options = candidates
    .filter((e) => e.currency === line.currency)
    .sort((a, b) => score(a, line) - score(b, line));

  function link(entryId: string) {
    if (!entryId) return;
    setError(null);
    startTransition(async () => {
      const r = await linkLineAction(line.id, entryId);
      if (!r.ok) setError(r.error);
      else {
        setMode(null);
        onChanged();
      }
    });
  }

  function dismiss(reason: string) {
    setError(null);
    startTransition(async () => {
      const r = await dismissLineAction(line.id, reason);
      if (!r.ok) setError(r.error);
      else {
        setMode(null);
        onChanged();
      }
    });
  }

  return (
    <li className="py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <LineText line={line} />
        <div className="shrink-0 text-right">
          <Amount amount={line.amount} currency={line.currency} />
          <div className="text-[11px] text-muted">{line.amount > 0 ? "Ingreso a registrar" : "Gasto a registrar"}</div>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <button type="button" className={smallBtn} disabled={busy} onClick={() => setMode(mode === "link" ? null : "link")}>
          Vincular a un movimiento…
        </button>
        <button
          type="button"
          className={smallBtn}
          disabled={busy}
          onClick={() => setMode(mode === "dismiss" ? null : "dismiss")}
        >
          No corresponde al libro…
        </button>
      </div>
      {mode === "link" && (
        <div className="mt-2">
          {options.length === 0 ? (
            <p className="text-[12px] text-muted">
              No hay movimientos sin par en {line.currency} cerca de esta fecha. Cargalo en el libro y volvé a importar.
            </p>
          ) : (
            <Select defaultValue="" onChange={(e) => link(e.currentTarget.value)} disabled={busy}>
              <option value="">Elegí el movimiento del libro…</option>
              {options.map((e) => (
                <option key={e.id} value={e.id}>
                  {formatReceiptDate(e.entry_date)} · {e.rubro ?? "sin rubro"}
                  {e.receipt_number != null ? ` · recibo ${e.receipt_number}` : ""}
                  {e.description ? ` · ${e.description}` : ""} · {signed(e.amount)}
                </option>
              ))}
            </Select>
          )}
        </div>
      )}
      {mode === "dismiss" && (
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            dismiss(String(new FormData(e.currentTarget).get("reason") || ""));
          }}
        >
          <input
            name="reason"
            className={`${inputClass} flex-1 min-w-[220px]`}
            placeholder="Por qué no va al libro (ej.: es de otra cuenta, el banco lo revirtió)"
            maxLength={300}
            autoFocus
          />
          <Button type="submit" variant="secondary" disabled={busy}>
            Descartar
          </Button>
        </form>
      )}
      {error && <p className="mt-1.5 text-[12px] text-rose-700">{error}</p>}
    </li>
  );
}

/** La línea cerró contra la transferencia pero el libro no tiene la
 *  comisión que la plataforma cobró adentro (o el vínculo a mano quedó
 *  incompleto): se ofrece completar con otro movimiento. */
function FeeGapRow({
  view: m,
  candidates,
  onChanged,
}: {
  view: LineView;
  candidates: ReconcileEntry[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const options = candidates
    .filter((e) => e.currency === m.line.currency)
    .sort((a, b) => Math.abs(a.amount - m.diff) - Math.abs(b.amount - m.diff));

  function link(entryId: string) {
    if (!entryId) return;
    setError(null);
    startTransition(async () => {
      const r = await linkLineAction(m.line.id, entryId);
      if (!r.ok) setError(r.error);
      else {
        setOpen(false);
        onChanged();
      }
    });
  }

  return (
    <li className="py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] text-dark">
            {m.kinds.includes("comision") ? "Comisión de la transferencia" : "Falta completar la línea"} del{" "}
            {formatReceiptDate(m.line.line_date)}
          </div>
          <div className="text-[11.5px] text-muted">
            {m.kinds.includes("comision")
              ? `La transferencia está en el libro; falta el gasto por la comisión que ${PLATFORM_LABELS[m.line.platform]} cobró adentro del importe.`
              : "Los movimientos vinculados no suman el importe de la línea."}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className={`font-semibold tabular-nums ${m.diff < 0 ? "text-rose-700" : "text-green"}`}>
            {signed(m.diff)} <span className="text-[11px] font-normal text-muted">{m.line.currency}</span>
          </div>
          <div className="text-[11px] text-muted">{m.diff < 0 ? "Gasto a registrar" : "Ingreso a registrar"}</div>
        </div>
      </div>
      <div className="mt-1.5">
        <button type="button" className={smallBtn} disabled={busy} onClick={() => setOpen(!open)}>
          Ya está en el libro: vincular…
        </button>
      </div>
      {open && (
        <div className="mt-2">
          <Select defaultValue="" onChange={(e) => link(e.currentTarget.value)} disabled={busy}>
            <option value="">Elegí el movimiento del libro…</option>
            {options.map((e) => (
              <option key={e.id} value={e.id}>
                {formatReceiptDate(e.entry_date)} · {e.rubro ?? "sin rubro"}
                {e.description ? ` · ${e.description}` : ""} · {signed(e.amount)}
              </option>
            ))}
          </Select>
        </div>
      )}
      {error && <p className="mt-1.5 text-[12px] text-rose-700">{error}</p>}
    </li>
  );
}

function MatchedRow({ view: m, onChanged }: { view: LineView; onChanged: () => void }) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <li className="py-2.5 text-[12.5px]">
      <div className="flex items-baseline justify-between gap-3">
        <LineText line={m.line} compact />
        <span className="shrink-0 tabular-nums text-dark">{signed(m.line.amount)}</span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-2 text-[11.5px] text-muted">
        <span>
          {m.manual ? "vinculada a mano" : "cerró sola"} ·{" "}
          {m.entries
            .map(
              (e) =>
                `${e.rubro ?? "sin rubro"}${e.receipt_number != null ? ` (recibo ${e.receipt_number})` : ""} ${signed(e.amount)}`
            )
            .join(" + ")}
        </span>
        <button
          type="button"
          className="text-[11.5px] font-semibold text-terra hover:underline disabled:opacity-40"
          disabled={busy}
          onClick={() =>
            startTransition(async () => {
              const r = await undoLineAction(m.line.id);
              if (!r.ok) setError(r.error);
              else onChanged();
            })
          }
        >
          Deshacer
        </button>
      </div>
      {error && <p className="mt-1 text-[12px] text-rose-700">{error}</p>}
    </li>
  );
}

function DismissedRow({ line, onChanged }: { line: StoredLine; onChanged: () => void }) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <li className="py-2.5 text-[12.5px]">
      <div className="flex items-baseline justify-between gap-3">
        <LineText line={line} compact />
        <span className="shrink-0 tabular-nums text-muted line-through">{signed(line.amount)}</span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-2 text-[11.5px] text-muted">
        <span>
          Descartada{line.dismissed_auto ? " en automático" : ""}: <span className="italic">{line.dismiss_reason}</span>
        </span>
        <button
          type="button"
          className="text-[11.5px] font-semibold text-terra hover:underline disabled:opacity-40"
          disabled={busy}
          onClick={() =>
            startTransition(async () => {
              const r = await undoLineAction(line.id);
              if (!r.ok) setError(r.error);
              else onChanged();
            })
          }
        >
          Deshacer
        </button>
      </div>
      {error && <p className="mt-1 text-[12px] text-rose-700">{error}</p>}
    </li>
  );
}

function ImportRow({ imp, onChanged }: { imp: StatementImport; onChanged: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const when = new Date(imp.created_at).toLocaleString("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <li className="py-2.5 text-[12.5px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <span className="text-dark">{imp.file_name}</span>
          <span className="text-muted">
            {" "}· {PLATFORM_LABELS[imp.platform]} · del {formatReceiptDate(imp.period_from)} al{" "}
            {formatReceiptDate(imp.period_to)} · {imp.lines_count} líneas ({imp.new_lines_count} nuevas)
            {imp.closing_balance != null && ` · saldo ${formatMoney(imp.closing_balance)} ${imp.currency}`}
            {" "}· {when}
          </span>
        </div>
        {confirming ? (
          <span className="flex items-center gap-2">
            <span className="text-[11.5px] text-muted">¿Borrar con sus líneas y sus pares?</span>
            <button
              type="button"
              className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11.5px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-40"
              disabled={busy}
              onClick={() =>
                startTransition(async () => {
                  const r = await deleteImportAction(imp.id);
                  if (!r.ok) setError(r.error);
                  else onChanged();
                })
              }
            >
              Sí, borrar
            </button>
            <button type="button" className={smallBtn} onClick={() => setConfirming(false)}>
              No
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="text-[11.5px] font-semibold text-muted hover:text-rose-700"
            onClick={() => setConfirming(true)}
          >
            Borrar importación
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-[12px] text-rose-700">{error}</p>}
    </li>
  );
}

// ─── Piezas ────────────────────────────────────────────────────────────

/** Cuánto se parece un movimiento a la línea, para ordenar el
 *  desplegable: primero el importe, después la fecha. */
function score(e: ReconcileEntry, line: StoredLine): number {
  const amountGap = Math.abs(Math.abs(e.amount) - Math.abs(line.amount));
  const [ly, lm, ld] = line.line_date.split("-").map(Number);
  const [ey, em, ed] = e.entry_date.split("-").map(Number);
  const days = Math.abs((Date.UTC(ey, em - 1, ed) - Date.UTC(ly, lm - 1, ld)) / 86400000);
  return amountGap * 1000 + days;
}

function signed(n: number): string {
  if (Math.abs(n) < 0.005) return formatMoney(0);
  return `${n < 0 ? "− " : "+ "}${formatMoney(Math.abs(n))}`;
}

function diffTone(n: number): string {
  return Math.abs(n) < 0.005 ? "text-green" : "text-rose-700";
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

function Amount({ amount, currency }: { amount: number; currency: string }) {
  return (
    <div className={`font-semibold tabular-nums ${amount < 0 ? "text-rose-700" : "text-green"}`}>
      {signed(amount)} <span className="text-[11px] font-normal text-muted">{currency}</span>
    </div>
  );
}

function LineText({ line, compact }: { line: StoredLine; compact?: boolean }) {
  return (
    <div className="min-w-0">
      <div className={`truncate ${compact ? "text-[12.5px]" : "text-[13px]"} text-dark`}>
        <span className="tabular-nums text-muted">{formatReceiptDate(line.line_date)}</span> ·{" "}
        {line.description || "Sin descripción"}
      </div>
      {line.memo && <div className="truncate text-[12px] text-dark/80">{line.memo}</div>}
      {!compact && (
        <div className="text-[11.5px] text-muted">
          {PLATFORM_LABELS[line.platform]}
          {line.reference && ` · ref. ${line.reference}`}
          {line.gross_amount != null && ` · pedido ${formatMoney(Math.abs(line.gross_amount))}`}
        </div>
      )}
    </div>
  );
}

function EntryLine({ entry }: { entry: ReconcileEntry }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
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
      <Amount amount={entry.amount} currency={entry.currency} />
    </div>
  );
}
