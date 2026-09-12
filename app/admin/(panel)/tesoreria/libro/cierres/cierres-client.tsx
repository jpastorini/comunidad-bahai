"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { monthLabel } from "@/lib/treasury-cashbook";
import { formatMoney } from "@/lib/treasury-format";
import { closeMonthAction, reopenMonthAction } from "../cierre-actions";

export type MonthRow = {
  month: string;
  current: boolean;
  entriesCount: number;
  voidedCount: number;
  totals: Array<{ currency: string; income: number; expense: number; closing: number }>;
  closing: { at: string; by: string | null } | null;
  reopenings: Array<{ at: string; by: string | null; reason: string }>;
  canClose: boolean;
  canReopen: boolean;
};

/**
 * La lista de meses con su estado y sus acciones. Cerrar pide
 * confirmación mostrando los saldos que van a quedar congelados; reabrir
 * pide el motivo. Las dos corren el server action y refrescan.
 */
export function CierresClient({ rows }: { rows: MonthRow[] }) {
  const router = useRouter();
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <MonthCard key={r.month} row={r} onChanged={() => router.refresh()} />
      ))}
    </div>
  );
}

function MonthCard({ row: r, onChanged }: { row: MonthRow; onChanged: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function close() {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("month", r.month);
    const res = await closeMonthAction(fd);
    setBusy(false);
    if (res.ok) {
      setConfirming(false);
      onChanged();
    } else setError(res.error);
  }

  async function reopen() {
    if (reason.trim().length < 5) {
      setError("Escribí el motivo de la reapertura.");
      return;
    }
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("month", r.month);
    fd.set("reason", reason.trim());
    const res = await reopenMonthAction(fd);
    setBusy(false);
    if (res.ok) {
      setReopening(false);
      setReason("");
      onChanged();
    } else setError(res.error);
  }

  const state = r.closing ? "cerrado" : r.current ? "en curso" : "abierto";

  return (
    <div className="rounded-2xl bg-card p-4 shadow-card-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-[17px] font-semibold text-dark">
              {monthLabel(r.month)}
            </h3>
            <span
              className={`rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${
                r.closing
                  ? "bg-emerald-50 text-emerald-700"
                  : r.current
                    ? "bg-black/[0.06] text-muted"
                    : "bg-amber-50 text-amber-800"
              }`}
            >
              {state}
            </span>
          </div>
          <div className="mt-1 text-[11.5px] text-muted">
            {r.entriesCount} {r.entriesCount === 1 ? "movimiento" : "movimientos"}
            {r.voidedCount > 0 && ` · ${r.voidedCount} anulado${r.voidedCount === 1 ? "" : "s"}`}
            {r.closing && (
              <>
                {" · "}Cerrado el {r.closing.at}
                {r.closing.by ? ` por ${r.closing.by}` : ""}
              </>
            )}
          </div>
          {r.totals.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px] tabular-nums">
              {r.totals.map((t) => (
                <div key={t.currency} className="text-muted">
                  <span className="font-semibold text-dark">{t.currency}</span>{" "}
                  <span className="text-emerald-700">+{formatMoney(t.income)}</span>{" "}
                  <span className="text-rose-700">−{formatMoney(t.expense)}</span>{" "}
                  · saldo <span className="font-semibold text-dark">{formatMoney(t.closing)}</span>
                </div>
              ))}
            </div>
          )}
          {r.reopenings.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[11px] text-muted">
              {r.reopenings.map((h, i) => (
                <li key={i}>
                  Reabierto el {h.at}
                  {h.by ? ` por ${h.by}` : ""}: <span className="italic">{h.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/libro-caja/${r.month}`}
            target="_blank"
            className="tap rounded-xl border border-black/10 bg-card px-3.5 py-2 text-[12.5px] font-semibold text-dark hover:bg-bg"
          >
            {r.closing ? "Libro de Caja" : "Libro de Caja (borrador)"}
          </Link>
          {r.canClose && !confirming && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="tap rounded-xl bg-terra px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-card-soft"
            >
              Cerrar mes
            </button>
          )}
          {r.canReopen && !reopening && (
            <button
              type="button"
              onClick={() => setReopening(true)}
              className="tap rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-[12.5px] font-semibold text-rose-700 hover:bg-rose-100"
            >
              Reabrir
            </button>
          )}
        </div>
      </div>

      {confirming && (
        <div className="mt-3 rounded-xl border border-terra/25 bg-terra/[0.05] p-3 text-[12.5px]">
          <p className="text-dark">
            Se cierra <strong>{monthLabel(r.month)}</strong> con los saldos de arriba.
            Después no se podrá cargar, modificar ni borrar ningún movimiento de
            ese mes: las correcciones serán contra-asientos en el mes siguiente.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className="tap rounded-xl bg-terra px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Cerrando…" : "Sí, cerrar el mes"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-[12px] font-medium text-muted underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {reopening && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12.5px]">
          <p className="text-dark">
            Reabrir <strong>{monthLabel(r.month)}</strong> vuelve a permitir cambios
            en sus movimientos. El cierre anterior queda registrado como
            reabierto, con tu nombre y el motivo. Si la hoja ya está pegada en el
            libro, no reabras: corregí con un contra-asiento.
          </p>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo de la reapertura"
            maxLength={500}
            autoFocus
            className="mt-2 w-full rounded-xl border border-black/10 bg-card px-3 py-2 text-[12.5px] text-dark outline-none focus:border-terra"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={reopen}
              disabled={busy}
              className="tap rounded-xl bg-rose-600 px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Reabriendo…" : "Sí, reabrir"}
            </button>
            <button
              type="button"
              onClick={() => {
                setReopening(false);
                setError(null);
              }}
              className="text-[12px] font-medium text-muted underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-[12px] text-rose-600">{error}</p>}
    </div>
  );
}
