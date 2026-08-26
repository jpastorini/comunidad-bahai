"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LedgerCatalog, TreasuryEntry } from "@/lib/treasury-ledger";
import { formatMoney } from "@/lib/treasury-format";
import { deleteEntryAction, saveTransferAction } from "./actions";
import { EntryForm } from "./entry-form";

type Props = {
  catalog: LedgerCatalog;
  entries: TreasuryEntry[];
  year: number;
  years: number[];
  today: string;
  nextReceipt: number;
};

/**
 * El libro: alta rápida arriba y movimientos abajo.
 *
 * En PC el formulario está siempre a la vista, como la fila vacía de una
 * planilla. En el teléfono aparece con un botón, para que la lista no
 * quede sepultada bajo el formulario.
 *
 * No hay columna de saldo acumulado a propósito: con varias cuentas y dos
 * monedas mezcladas en la misma lista, un saldo corrido por fila sería
 * un número sin significado. Los saldos van arriba, separados.
 */
export function LedgerClient({
  catalog,
  entries,
  year,
  years,
  today,
  nextReceipt,
}: Props) {
  const router = useRouter();
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<TreasuryEntry | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [fundFilter, setFundFilter] = useState("");
  // Los nombres de quienes aportan son confidenciales y la pantalla del
  // tesorero no siempre está sola. Arrancan ocultos en cada carga; el
  // estado sobrevive a los router.refresh() de la propia sesión de carga.
  const [showNames, setShowNames] = useState(false);

  const names = useMemo(() => {
    const accounts = new Map(catalog.accounts.map((a) => [a.id, a.name]));
    const funds = new Map(catalog.funds.map((f) => [f.id, f.name]));
    const subcategories = new Map(
      catalog.subcategories.map((s) => [s.id, s.name])
    );
    const contributors = new Map(
      catalog.contributors.map((c) => [c.id, c.name])
    );
    return { accounts, funds, subcategories, contributors };
  }, [catalog]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (fundFilter && e.fund_id !== fundFilter) return false;
      if (!q) return true;
      const haystack = [
        e.description ?? "",
        names.subcategories.get(e.subcategory_id) ?? "",
        names.accounts.get(e.account_id) ?? "",
        e.contributor_id ? names.contributors.get(e.contributor_id) ?? "" : "",
        e.receipt_number ? String(e.receipt_number) : "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [entries, search, fundFilter, names]);

  function refresh() {
    router.refresh();
  }

  /** Nombre del contribuyente, o el antifaz si están ocultos. La cantidad
   *  de aportes sí se muestra siempre: es anónima por definición. */
  function contributorLabel(e: TreasuryEntry) {
    if (!e.contributor_id) {
      return e.contributions_count > 1 ? `${e.contributions_count} aportes` : "—";
    }
    if (!showNames) return null; // lo pinta el componente Masked
    return names.contributors.get(e.contributor_id) ?? "—";
  }

  return (
    <>
      {/* Barra de herramientas */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {years.length > 1 && (
          <select
            value={year}
            onChange={(e) => router.push(`/admin/tesoreria/libro?year=${e.target.value}`)}
            className={controlClass}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                Año {y} E.B.
              </option>
            ))}
          </select>
        )}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por rubro, descripción, recibo…"
          className={`${controlClass} min-w-[200px] flex-1`}
        />
        <select
          value={fundFilter}
          onChange={(e) => setFundFilter(e.target.value)}
          className={controlClass}
        >
          <option value="">Todos los fondos</option>
          {catalog.funds.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowNames((v) => !v)}
          aria-pressed={showNames}
          className="tap inline-flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 text-[12.5px] font-semibold text-dark hover:bg-bg"
          title={
            showNames
              ? "Ocultar los nombres de los contribuyentes"
              : "Mostrar los nombres de los contribuyentes"
          }
        >
          <EyeIcon off={!showNames} />
          {showNames ? "Ocultar nombres" : "Mostrar nombres"}
        </button>
        <button
          type="button"
          onClick={() => setTransferOpen(true)}
          className="tap rounded-xl border border-black/10 px-3 py-2 text-[12.5px] font-semibold text-dark hover:bg-bg"
        >
          Transferencia
        </button>
        <button
          type="button"
          onClick={() => setOpenForm((v) => !v)}
          className="tap rounded-xl bg-terra px-3 py-2 text-[12.5px] font-semibold text-white sm:hidden"
        >
          {openForm ? "Cerrar" : "+ Movimiento"}
        </button>
      </div>

      {/* Alta rápida: siempre visible en PC, con botón en el teléfono */}
      <div
        className={`mb-4 rounded-2xl bg-card p-4 shadow-card-soft ${
          openForm ? "block" : "hidden sm:block"
        }`}
      >
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted">
          Nuevo movimiento
        </h3>
        <EntryForm
          catalog={catalog}
          year={year}
          today={today}
          nextReceipt={nextReceipt}
          onSaved={refresh}
        />
      </div>

      <div className="mb-2 flex items-baseline justify-between px-1">
        <h3 className="text-[13px] font-semibold text-dark">
          Movimientos
          <span className="ml-1.5 text-[11.5px] font-normal text-muted">
            {filtered.length === entries.length
              ? `${entries.length}`
              : `${filtered.length} de ${entries.length}`}
          </span>
        </h3>
      </div>

      {/* PC: tabla */}
      <div className="hidden overflow-x-auto rounded-2xl bg-card shadow-card-soft sm:block">
        <table className="w-full min-w-[820px] text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-black/[0.06] text-[10.5px] uppercase tracking-wide text-muted">
              <Th>Fecha</Th>
              <Th>Cuenta</Th>
              <Th>Subcategoría</Th>
              <Th>Descripción</Th>
              <Th>Contribuyente</Th>
              <Th className="text-right">Recibo</Th>
              <Th className="text-right">Ingreso</Th>
              <Th className="text-right">Gasto</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr
                key={e.id}
                onClick={() => setEditing(e)}
                className="cursor-pointer border-b border-black/[0.04] last:border-0 hover:bg-bg/60"
              >
                <Td className="whitespace-nowrap">{formatDate(e.entry_date)}</Td>
                <Td>{names.accounts.get(e.account_id) ?? "—"}</Td>
                <Td>
                  {names.subcategories.get(e.subcategory_id) ?? "—"}
                  {e.fund_id && (
                    <span className="ml-1.5 rounded-full bg-bg px-1.5 py-0.5 text-[10px] text-muted">
                      {names.funds.get(e.fund_id)}
                    </span>
                  )}
                </Td>
                <Td className="text-muted">{e.description ?? "—"}</Td>
                <Td>{contributorLabel(e) ?? <Masked />}</Td>
                <Td className="text-right tabular-nums text-muted">
                  {e.receipt_number ? (
                    <Link
                      href={"/admin/tesoreria/recibo/" + e.id}
                      onClick={(ev) => ev.stopPropagation()}
                      className="font-semibold text-terra hover:underline"
                      title="Ver el recibo"
                    >
                      {e.receipt_number}
                      {e.receipt_issued && (
                        <span className="ml-1 text-emerald-700" title="Ya emitido">
                          ✓
                        </span>
                      )}
                    </Link>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td className="text-right tabular-nums font-semibold text-emerald-700">
                  {e.amount > 0 ? `${formatMoney(e.amount)} ${e.currency}` : ""}
                </Td>
                <Td className="text-right tabular-nums font-semibold text-rose-700">
                  {e.amount < 0 ? `${formatMoney(-e.amount)} ${e.currency}` : ""}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <Empty />}
      </div>

      {/* Teléfono: tarjetas */}
      <div className="space-y-2 sm:hidden">
        {filtered.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setEditing(e)}
            className="tap block w-full rounded-2xl bg-card p-3 text-left shadow-card-soft"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12.5px] font-semibold text-dark">
                {names.subcategories.get(e.subcategory_id) ?? "—"}
              </span>
              <span
                className={`shrink-0 tabular-nums text-[13px] font-semibold ${
                  e.amount > 0 ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {e.amount > 0 ? "+" : "−"}
                {formatMoney(Math.abs(e.amount))} {e.currency}
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-muted">
              {formatDate(e.entry_date)} · {names.accounts.get(e.account_id)}
              {e.fund_id ? ` · ${names.funds.get(e.fund_id)}` : ""}
            </div>
            {(e.description || e.contributor_id) && (
              <div className="mt-1 text-[11.5px] text-dark/80">
                {e.contributor_id ? contributorLabel(e) ?? <Masked /> : ""}
                {e.contributor_id && e.description ? " · " : ""}
                {e.description ?? ""}
              </div>
            )}
          </button>
        ))}
        {filtered.length === 0 && <Empty />}
      </div>

      {/* Edición */}
      {editing && (
        <Modal title="Editar movimiento" onClose={() => setEditing(null)}>
          <EntryForm
            catalog={catalog}
            year={year}
            today={today}
            nextReceipt={nextReceipt}
            entry={editing}
            onSaved={() => {
              setEditing(null);
              refresh();
            }}
            onCancel={() => setEditing(null)}
          />
          {editing.amount > 0 && editing.receipt_number && (
            <div className="mt-3 border-t border-black/[0.06] pt-3">
              <Link
                href={"/admin/tesoreria/recibo/" + editing.id}
                className="tap inline-flex items-center rounded-xl border border-terra/25 bg-terra/[0.06] px-3.5 py-2 text-[12px] font-semibold text-terra"
              >
                Ver recibo N.° {editing.receipt_number}
              </Link>
            </div>
          )}
          <DeleteRow
            entry={editing}
            onDeleted={() => {
              setEditing(null);
              refresh();
            }}
          />
        </Modal>
      )}

      {/* Transferencia */}
      {transferOpen && (
        <Modal
          title="Transferencia entre cuentas"
          onClose={() => setTransferOpen(false)}
        >
          <TransferForm
            catalog={catalog}
            year={year}
            today={today}
            onSaved={() => {
              setTransferOpen(false);
              refresh();
            }}
            onCancel={() => setTransferOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}

const controlClass =
  "rounded-xl border border-black/10 bg-card px-3 py-2 text-[12.5px] text-dark outline-none focus:border-terra";

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <th className={`px-3 py-2 font-semibold ${className}`}>{children}</th>;
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}

/** Antifaz de un nombre oculto. Largo fijo: si variara con el nombre
 *  real, se filtraría cuán largo es. */
function Masked() {
  return (
    <span
      className="select-none tracking-[0.18em] text-muted/70"
      aria-label="Nombre oculto"
    >
      ••••••
    </span>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.6" />
      {off && <path d="M4 20 20 4" />}
    </svg>
  );
}

function Empty() {
  return (
    <p className="px-4 py-8 text-center text-[12.5px] text-muted">
      No hay movimientos que coincidan.
    </p>
  );
}

/** "2026-08-19" → "19/08" (el año ya está en el encabezado del libro). */
function formatDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function DeleteRow({
  entry,
  onDeleted,
}: {
  entry: TreasuryEntry;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    const fd = new FormData();
    fd.set("id", entry.id);
    const res = await deleteEntryAction(fd);
    setBusy(false);
    if (res.ok) onDeleted();
    else setError(res.error);
  }

  return (
    <div className="mt-4 border-t border-black/[0.06] pt-3">
      {error && <p className="mb-2 text-[11.5px] text-rose-600">{error}</p>}
      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted">
            {entry.transfer_group_id
              ? "Se borran las dos patas de la transferencia."
              : "¿Seguro?"}
          </span>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="tap rounded-xl bg-rose-600 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Borrando…" : "Sí, borrar"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-[12px] font-medium text-muted underline"
          >
            No
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-[12px] font-semibold text-rose-600 hover:underline"
        >
          Eliminar movimiento
        </button>
      )}
    </div>
  );
}

function TransferForm({
  catalog,
  year,
  today,
  onSaved,
  onCancel,
}: {
  catalog: LedgerCatalog;
  year: number;
  today: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [fromCurrency, setFromCurrency] = useState("UYU");
  const [toCurrency, setToCurrency] = useState("UYU");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Las subcategorías de movimiento entre cuentas: cambio de caja y
  // compra de divisas. Si la localidad las nombró distinto, se ofrecen
  // todas y que elija.
  const transferSubs = catalog.subcategories.filter((s) =>
    /cambio de caja|divisa|transferencia/i.test(s.name)
  );
  const options = transferSubs.length > 0 ? transferSubs : catalog.subcategories;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("from_currency", fromCurrency);
    fd.set("to_currency", toCurrency);
    setSaving(true);
    setError(null);
    const res = await saveTransferAction(fd);
    setSaving(false);
    if (res.ok) onSaved();
    else setError(res.error);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="bahai_year" value={year} />
      <p className="text-[12px] leading-relaxed text-muted">
        Se cargan las dos patas juntas. Si cambiás de moneda, poné el monto
        que sale y el que entra: el tipo de cambio queda implícito.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-[10.5px] uppercase tracking-wide text-muted">
            Fecha
          </span>
          <input
            type="date"
            name="entry_date"
            defaultValue={today}
            required
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10.5px] uppercase tracking-wide text-muted">
            Subcategoría
          </span>
          <select name="subcategory_id" required className={inputClass}>
            <option value="">Elegir…</option>
            {options.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-black/10 p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-rose-700">
          Sale de
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select name="from_account_id" required className={inputClass}>
            <option value="">Cuenta…</option>
            {catalog.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <div className="flex gap-1">
            <input
              type="text"
              inputMode="decimal"
              name="from_amount"
              placeholder="0,00"
              required
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              onClick={() => setFromCurrency(fromCurrency === "UYU" ? "USD" : "UYU")}
              className="shrink-0 rounded-xl border border-black/10 px-2 text-[12px] font-semibold"
            >
              {fromCurrency}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-black/10 p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
          Entra en
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select name="to_account_id" required className={inputClass}>
            <option value="">Cuenta…</option>
            {catalog.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <div className="flex gap-1">
            <input
              type="text"
              inputMode="decimal"
              name="to_amount"
              placeholder="0,00"
              required
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              onClick={() => setToCurrency(toCurrency === "UYU" ? "USD" : "UYU")}
              className="shrink-0 rounded-xl border border-black/10 px-2 text-[12px] font-semibold"
            >
              {toCurrency}
            </button>
          </div>
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-[10.5px] uppercase tracking-wide text-muted">
          Descripción
        </span>
        <input
          type="text"
          name="description"
          defaultValue="Cambio de caja"
          className={inputClass}
        />
      </label>

      {error && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="tap rounded-xl bg-terra px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Guardando…" : "Registrar transferencia"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="tap rounded-xl border border-black/10 px-4 py-2 text-[13px] font-semibold text-muted"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-xl border border-black/10 bg-bg/40 px-3 py-2 text-[13.5px] text-dark outline-none focus:border-terra";

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-card p-4 shadow-card-elevated sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-[16px] font-semibold text-dark">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="tap rounded-lg px-2 py-1 text-[18px] leading-none text-muted hover:bg-bg"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
