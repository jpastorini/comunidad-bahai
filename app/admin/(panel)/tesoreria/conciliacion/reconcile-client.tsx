"use client";

import Link from "next/link";
import { TREASURY_HELP } from "@/lib/treasury-help";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Banner, Button, Card, Field, Select } from "@/components/admin/ui";
import { PLATFORM_LABELS } from "@/lib/bank-statements";
import { formatMoney, formatReceiptDate } from "@/lib/treasury-format";
import type { ReconcileEntry } from "@/lib/treasury-reconcile";
import type {
  AccountReconciliation,
  CandidateEntry,
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
          <Field label="Cuenta del libro" name="account_id" required help={TREASURY_HELP.fields.cuentaExtracto}>
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
          hint="Lo que la plataforma registró y el libro todavía no: un giro sin cargar, una comisión. Cargalo en el libro y volvé a importar, o vinculalo a mano si ya está con otra fecha o importe. Si está cargado en otra cuenta, el buscador te lo dice."
        />
        {pendingCount === 0 ? (
          <Empty>Todo lo que movió la plataforma está en el libro.</Empty>
        ) : (
          <ul className="mt-3 divide-y divide-black/5">
            {d.pending.map((l) => (
              <PendingLineRow
                key={l.id}
                line={l}
                candidates={d.candidates}
                elsewhere={d.elsewhere}
                onChanged={() => router.refresh()}
              />
            ))}
            {feeGaps.map((m) => (
              <FeeGapRow
                key={`gap-${m.line.id}`}
                view={m}
                candidates={d.candidates}
                elsewhere={d.elsewhere}
                onChanged={() => router.refresh()}
              />
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
  elsewhere,
  onChanged,
}: {
  line: StoredLine;
  candidates: CandidateEntry[];
  elsewhere: CandidateEntry[];
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<null | "link" | "dismiss">(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

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
        <EntryPicker
          currency={line.currency}
          target={line.amount}
          date={line.line_date}
          candidates={candidates}
          elsewhere={elsewhere}
          busy={busy}
          onPick={link}
        />
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
  elsewhere,
  onChanged,
}: {
  view: LineView;
  candidates: CandidateEntry[];
  elsewhere: CandidateEntry[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

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
        <EntryPicker
          currency={m.line.currency}
          target={m.diff}
          date={m.line.line_date}
          candidates={candidates}
          elsewhere={elsewhere}
          busy={busy}
          onPick={link}
        />
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
// ─── El buscador de movimientos del libro ──────────────────────────────

/** Cuántos se muestran antes de pedir "mostrar más": la lista entera de
 *  una cuenta con mucho movimiento no cabe, y lo que se busca suele estar
 *  arriba (ordenado por parecido) o se escribe. */
const PICKER_PAGE = 12;

/**
 * Para vincular una línea a mano: un cuadro de búsqueda sobre los
 * movimientos sin par de la cuenta, ordenados por parecido (importe y
 * fecha), más un grupo aparte con los de OTRAS cuentas que coinciden —esos
 * no se vinculan: la línea es de esta cuenta, así que lo que corresponde
 * es corregir la cuenta del movimiento en el Libro, y el grupo lleva a eso.
 * Reemplazó a un `<select>` sin búsqueda, donde un movimiento cargado en
 * otra cuenta sencillamente no aparecía y no había cómo saber por qué.
 *
 * Se busca también por nombre de contribuyente, pero el nombre no se
 * imprime: los nombres del libro arrancan ocultos y acá no hay botón para
 * mostrarlos. El recibo y el importe identifican al movimiento igual.
 */
function EntryPicker({
  currency,
  target,
  date,
  candidates,
  elsewhere,
  busy,
  onPick,
}: {
  currency: string;
  /** El importe que se busca cerrar (el de la línea, o lo que falta). */
  target: number;
  date: string;
  candidates: CandidateEntry[];
  elsewhere: CandidateEntry[];
  busy: boolean;
  onPick: (entryId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const terms = useMemo(() => fold(query).split(/\s+/).filter(Boolean), [query]);

  const own = useMemo(
    () =>
      candidates
        .filter((e) => e.currency === currency && matchesTerms(e, terms))
        .sort((a, b) => score(a, target, date) - score(b, target, date)),
    [candidates, currency, terms, target, date]
  );
  // Sin búsqueda, de las otras cuentas se muestra solo lo que tiene el
  // importe exacto: es el diagnóstico ("está cargado en otra cuenta") sin
  // llenar la lista de ruido. Con búsqueda, lo que coincida.
  const others = useMemo(
    () =>
      elsewhere
        .filter((e) => e.currency === currency)
        .filter((e) =>
          terms.length > 0 ? matchesTerms(e, terms) : Math.abs(Math.abs(e.amount) - Math.abs(target)) < 0.005
        )
        .sort((a, b) => score(a, target, date) - score(b, target, date)),
    [elsewhere, currency, terms, target, date]
  );

  const visible = showAll || terms.length > 0 ? own : own.slice(0, PICKER_PAGE);
  const hidden = own.length - visible.length;
  const nothingAtAll = candidates.filter((e) => e.currency === currency).length === 0;

  return (
    <div className="mt-2 rounded-xl border border-black/10 bg-bg/40 p-2.5">
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShowAll(false);
        }}
        className={inputClass}
        placeholder="Buscar por recibo, importe, detalle, rubro o nombre…"
        autoFocus
        disabled={busy}
      />
      {nothingAtAll ? (
        <p className="mt-2 text-[12px] text-muted">
          No hay movimientos sin par en {currency} cerca de esta fecha. Cargalo en el libro y volvé a importar.
        </p>
      ) : own.length === 0 ? (
        <p className="mt-2 text-[12px] text-muted">
          Ningún movimiento sin par de esta cuenta coincide con &ldquo;{query.trim()}&rdquo;.
        </p>
      ) : (
        <ul className="mt-2 max-h-72 divide-y divide-black/5 overflow-y-auto rounded-lg border border-black/5 bg-card">
          {visible.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onPick(e.id)}
                className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left transition hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="min-w-0 text-[12.5px] text-dark">
                  <span className="tabular-nums">{formatReceiptDate(e.entry_date)}</span> · {e.rubro ?? "sin rubro"}
                  {e.receipt_number != null ? ` · recibo ${e.receipt_number}` : ""}
                  {e.description ? <span className="text-muted"> · {e.description}</span> : null}
                </span>
                <span className={`shrink-0 font-semibold tabular-nums ${e.amount < 0 ? "text-rose-700" : "text-green"}`}>
                  {signed(e.amount)}
                </span>
              </button>
            </li>
          ))}
          {hidden > 0 && (
            <li>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-[12px] font-semibold text-terra hover:bg-bg"
                onClick={() => setShowAll(true)}
              >
                Mostrar {hidden} más…
              </button>
            </li>
          )}
        </ul>
      )}
      {others.length > 0 && (
        <div className="mt-2.5">
          <div className="text-[11.5px] font-semibold uppercase tracking-wide text-amber-800">
            En otra cuenta del libro
          </div>
          <p className="mt-0.5 text-[11.5px] text-muted">
            {terms.length > 0 ? "Coincide" : "El mismo importe está"} cargado en otra cuenta. No se puede vincular desde
            acá: corregí la cuenta del movimiento en el Libro y volvé a vincular (o a importar).
          </p>
          <ul className="mt-1.5 divide-y divide-amber-200/60 rounded-lg border border-amber-200/80 bg-amber-50/60">
            {others.slice(0, PICKER_PAGE).map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-3 py-2">
                <span className="min-w-0 text-[12.5px] text-dark">
                  <span className="tabular-nums">{formatReceiptDate(e.entry_date)}</span> · {e.rubro ?? "sin rubro"}
                  {e.receipt_number != null ? ` · recibo ${e.receipt_number}` : ""}
                  {e.description ? <span className="text-muted"> · {e.description}</span> : null}
                  <span className="text-amber-800"> · en {e.account_name}</span>
                </span>
                <span className="flex shrink-0 items-baseline gap-3">
                  <span className={`font-semibold tabular-nums ${e.amount < 0 ? "text-rose-700" : "text-green"}`}>
                    {signed(e.amount)}
                  </span>
                  <Link
                    href={`/admin/tesoreria/libro?ids=${e.id}`}
                    className="text-[12px] font-semibold text-terra hover:underline"
                  >
                    Corregir en el Libro →
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Minúsculas y sin acentos: en el celular se escribe sin acentos. */
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Todas las palabras tienen que estar en algún campo: fecha, recibo,
 *  rubro, detalle, nombre del contribuyente o importe (en cualquiera de
 *  las formas en que se escribe: 2000, 2000,00, 2.000,00). */
function matchesTerms(e: CandidateEntry, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const abs = Math.abs(e.amount);
  const haystack = fold(
    [
      formatReceiptDate(e.entry_date),
      e.receipt_number != null ? `recibo ${e.receipt_number}` : "",
      e.rubro ?? "",
      e.description ?? "",
      e.contributor_name ?? "",
      String(abs),
      abs.toFixed(2).replace(".", ","),
      formatMoney(abs),
      formatMoney(abs).replace(/,00$/, ""),
    ].join(" | ")
  );
  return terms.every((t) => haystack.includes(t));
}

/** Parecido con lo que se busca cerrar: primero el importe, después la
 *  distancia en días. Menor es mejor. */
function score(e: CandidateEntry, target: number, date: string): number {
  const amountGap = Math.abs(Math.abs(e.amount) - Math.abs(target));
  const [ly, lm, ld] = date.split("-").map(Number);
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
