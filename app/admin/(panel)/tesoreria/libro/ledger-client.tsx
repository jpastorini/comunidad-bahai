"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LedgerCatalog, TreasuryEntry } from "@/lib/treasury-ledger";
import { monthKeyOf, monthLabel, monthRange } from "@/lib/treasury-cashbook";
import { formatMoney } from "@/lib/treasury-format";
import {
  activeFilterCount,
  applyLedgerFilters,
  EMPTY_FILTERS,
  entryKind,
  filteredTotals,
  KIND_LABELS,
  ledgerCSV,
  ledgerCSVFilename,
  type EntryKind,
  type LedgerFilters,
  type LedgerNames,
} from "@/lib/treasury-ledger-filters";
import {
  deleteEntryAction,
  revertEntryAction,
  saveTransferAction,
  voidEntryAction,
} from "./actions";
import { EntryForm } from "./entry-form";
import { DateInput } from "@/components/DateInput";

type Props = {
  catalog: LedgerCatalog;
  entries: TreasuryEntry[];
  year: number;
  years: number[];
  today: string;
  nextReceipt: number;
  /** Comprobantes por movimiento, para el clip de la lista. */
  attachmentCounts: Record<string, number>;
  /** Meses civiles cerrados ("YYYY-MM"): sus movimientos no se editan ni
   *  se borran, se revierten con un contra-asiento (054). */
  closedMonths: string[];
  /** Movimientos que ya cerraron contra el extracto de la plataforma
   *  (061), para la marca de la lista. */
  reconciledIds: string[];
  /** Si viene, la lista es de ese rango de fechas y no de un ejercicio.
   *  Lo resuelve el servidor: un rango puede cruzar el corte de Riḍván. */
  range: { from: string; to: string } | null;
  /** Cómo se llama lo que está en pantalla ("183 E.B." o "1 abr – 30 abr
   *  2026"), para el nombre del archivo exportado. */
  scopeLabel: string;
  /** Movimientos señalados desde otra pantalla (hoy, un hallazgo de la
   *  Auditoría). La lista ya viene filtrada a estos: acá sirven para
   *  avisarlo y para abrir la ficha cuando es uno solo. */
  focusIds?: string[];
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
  attachmentCounts,
  closedMonths,
  reconciledIds,
  range,
  scopeLabel,
  focusIds = [],
}: Props) {
  const router = useRouter();
  const closed = useMemo(() => new Set(closedMonths), [closedMonths]);
  const reconciled = useMemo(() => new Set(reconciledIds), [reconciledIds]);
  /** El mes del movimiento ya se cerró: solo se puede revertir. */
  const isLocked = (e: TreasuryEntry) => closed.has(monthKeyOf(e.entry_date));
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<TreasuryEntry | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  // Los filtros trabajan sobre lo cargado y por eso son estado, no URL.
  // El período es la excepción: cambia QUÉ se carga, así que viaja en la
  // dirección y lo resuelve el servidor.
  const [filters, setFilters] = useState<LedgerFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const set = <K extends keyof LedgerFilters>(k: K, v: LedgerFilters[K]) =>
    setFilters((f) => ({ ...f, [k]: v }));
  // Los nombres de quienes aportan son confidenciales y la pantalla del
  // tesorero no siempre está sola. Arrancan ocultos en cada carga; el
  // estado sobrevive a los router.refresh() de la propia sesión de carga.
  const [showNames, setShowNames] = useState(false);

  // Un solo movimiento señalado abre su ficha sola: el hallazgo de la
  // Auditoría ya sabía de cuál hablaba y hacer buscarlo en una lista de
  // una fila sería devolverle el trabajo a la persona.
  //
  // El candado es un ref y no una dependencia del efecto porque después
  // de guardar se llama a router.refresh(): las entradas llegan nuevas,
  // el efecto volvería a correr y la ficha reaparecería sobre la lista
  // apenas la cerraste.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current || focusIds.length !== 1) return;
    const only = entries.find((e) => e.id === focusIds[0]);
    if (!only) return;
    autoOpened.current = true;
    setEditing(only);
  }, [entries, focusIds]);

  const names: LedgerNames = useMemo(
    () => ({
      accounts: new Map(catalog.accounts.map((a) => [a.id, a.name])),
      funds: new Map(catalog.funds.map((f) => [f.id, f.name])),
      categories: new Map(catalog.categories.map((c) => [c.id, c.name])),
      subcategories: new Map(catalog.subcategories.map((s) => [s.id, s.name])),
      contributors: new Map(catalog.contributors.map((c) => [c.id, c.name])),
    }),
    [catalog]
  );

  // El último seudónimo que usó cada contribuyente, para que el
  // formulario lo proponga. Las entradas vienen de la más nueva a la más
  // vieja, así que la primera que se ve es la última que se usó.
  const lastReceiptNames = useMemo(() => {
    const out: Record<string, string> = {};
    for (const e of entries) {
      if (e.contributor_id && e.receipt_name && !(e.contributor_id in out)) {
        out[e.contributor_id] = e.receipt_name;
      }
    }
    return out;
  }, [entries]);

  const filtered = useMemo(
    () => applyLedgerFilters(entries, filters, names, reconciled),
    [entries, filters, names, reconciled]
  );
  const totals = useMemo(() => filteredTotals(filtered), [filtered]);
  const activeCount = activeFilterCount(filters);

  // Las subcategorías que se ofrecen son las de la categoría elegida: con
  // el catálogo entero en un desplegable no se encuentra ninguna.
  const subcategoryOptions = useMemo(
    () =>
      filters.categoryId
        ? catalog.subcategories.filter((s) => s.category_id === filters.categoryId)
        : catalog.subcategories,
    [catalog.subcategories, filters.categoryId]
  );

  /** Las monedas y los tipos que EXISTEN en lo cargado: ofrecer dólares
   *  en un libro que solo tiene pesos es ofrecer una lista vacía. */
  const currencies = useMemo(
    () => [...new Set(entries.map((e) => e.currency))].sort(),
    [entries]
  );
  const kinds = useMemo(
    () =>
      (["ingreso", "gasto", "transferencia", "apertura"] as EntryKind[]).filter(
        (k) => entries.some((e) => entryKind(e) === k)
      ),
    [entries]
  );

  function refresh() {
    router.refresh();
  }

  /** El período cambia qué se carga, así que se navega. */
  function goToRange(from: string, to: string) {
    router.push(`/admin/tesoreria/libro?from=${from}&to=${to}`);
  }

  function exportCSV() {
    const csv = ledgerCSV(filtered, names, reconciled, { showNames });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ledgerCSVFilename(scopeLabel);
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Nombre del contribuyente, o el antifaz si están ocultos. La cantidad
   *  de aportes sí se muestra siempre: es anónima por definición. */
  function contributorLabel(e: TreasuryEntry) {
    if (!e.contributor_id) {
      return e.contributions_count > 1 ? `${e.contributions_count} aportes` : "—";
    }
    if (!showNames) return null; // lo pinta el componente Masked
    const name = names.contributors.get(e.contributor_id) ?? "—";
    // El seudónimo del recibo, si lo hay, va al lado: el libro sabe quién
    // aportó y también cómo quiso figurar.
    return e.receipt_name ? `${name} (${e.receipt_name})` : name;
  }

  return (
    <>
      {/* Movimientos señalados desde otra pantalla. La salida está a la
          vista desde el primer momento: alguien que llega acá por un
          link no tiene por qué deducir que el libro entero sigue ahí. */}
      {focusIds.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-terra/25 bg-terra/[0.06] px-3.5 py-2.5">
          <p className="text-[12.5px] text-dark">
            {entries.length === 0 ? (
              <>
                No se encontró el movimiento señalado: puede haberse borrado
                desde que se corrió la auditoría.
              </>
            ) : (
              <>
                Estás viendo{" "}
                <strong>
                  {entries.length === 1
                    ? "un movimiento señalado"
                    : `${entries.length} movimientos señalados`}
                </strong>
                , no el libro completo.
              </>
            )}
          </p>
          <Link
            href="/admin/tesoreria/libro"
            className="tap shrink-0 text-[12px] font-semibold text-terra hover:underline"
          >
            Ver el libro completo
          </Link>
        </div>
      )}

      {/* Barra de herramientas */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={range ? "" : String(year)}
          onChange={(e) =>
            router.push(
              e.target.value
                ? `/admin/tesoreria/libro?year=${e.target.value}`
                : "/admin/tesoreria/libro"
            )
          }
          className={controlClass}
        >
          {range && <option value="">Período elegido</option>}
          {years.map((y) => (
            <option key={y} value={y}>
              Año {y} E.B.
            </option>
          ))}
        </select>
        <input
          type="search"
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Buscar por rubro, descripción, recibo…"
          className={`${controlClass} min-w-[200px] flex-1`}
        />
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          className={`tap inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12.5px] font-semibold ${
            activeCount > 0 || range
              ? "border-terra/30 bg-terra/[0.07] text-terra"
              : "border-black/10 text-dark hover:bg-bg"
          }`}
        >
          <FilterIcon />
          Filtros
          {activeCount > 0 && (
            <span className="rounded-full bg-terra px-1.5 text-[10.5px] font-semibold text-white">
              {activeCount}
            </span>
          )}
        </button>
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
          onClick={exportCSV}
          disabled={filtered.length === 0}
          className="tap rounded-xl border border-black/10 px-3 py-2 text-[12.5px] font-semibold text-dark hover:bg-bg disabled:opacity-40"
          title={
            showNames
              ? "Bajar lo que está en pantalla como CSV"
              : "Bajar lo que está en pantalla como CSV. Los nombres están ocultos, así que el archivo tampoco los lleva."
          }
        >
          Exportar CSV
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

      {filtersOpen && (
        <FiltersPanel
          filters={filters}
          set={set}
          onClear={() => setFilters(EMPTY_FILTERS)}
          catalog={catalog}
          subcategoryOptions={subcategoryOptions}
          currencies={currencies}
          kinds={kinds}
          range={range}
          today={today}
          onRange={goToRange}
          onClearRange={() => router.push("/admin/tesoreria/libro")}
        />
      )}

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
          lastReceiptNames={lastReceiptNames}
          onSaved={refresh}
        />
      </div>

      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h3 className="text-[13px] font-semibold text-dark">
          Movimientos
          <span className="ml-1.5 text-[11.5px] font-normal text-muted">
            {filtered.length === entries.length
              ? `${entries.length}`
              : `${filtered.length} de ${entries.length}`}
          </span>
        </h3>
        {(activeCount > 0 || range) && (
          <button
            type="button"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              if (range) router.push("/admin/tesoreria/libro");
            }}
            className="tap text-[11.5px] font-semibold text-terra hover:underline"
          >
            Limpiar todo
          </button>
        )}
      </div>

      {/* Los totales de lo que quedó a la vista. Es la razón de ser de
          los filtros: el número que se pone al lado del extracto para
          ver dónde está la diferencia. Solo aparece con algo filtrado,
          porque sin filtros ya está arriba el movimiento del período. */}
      {(activeCount > 0 || range) && totals.length > 0 && (
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          {totals.map((t) => (
            <div
              key={t.currency}
              className="rounded-2xl border border-terra/15 bg-terra/[0.04] px-3.5 py-2.5"
            >
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-terra">
                  Seleccionado · {t.currency}
                </span>
                <span className="text-[11px] text-muted">
                  {t.count} {t.count === 1 ? "movimiento" : "movimientos"}
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-[12.5px]">
                <Total label="Ingresos" value={t.income} tone="income" />
                <Total label="Gastos" value={t.expense} tone="expense" />
                {t.internal !== 0 && (
                  <Total label="Internos" value={t.internal} />
                )}
                {t.opening !== 0 && (
                  <Total label="Apertura" value={t.opening} />
                )}
                <Total label="Neto" value={t.net} strong />
              </div>
            </div>
          ))}
        </div>
      )}

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
                className={`cursor-pointer border-b border-black/[0.04] last:border-0 hover:bg-bg/60 ${
                  e.voided_at ? "text-muted line-through decoration-rose-400/70" : ""
                }`}
              >
                <Td className="whitespace-nowrap">
                  {isLocked(e) && <LockIcon />}
                  {formatDate(e.entry_date)}
                </Td>
                <Td>{names.accounts.get(e.account_id) ?? "—"}</Td>
                <Td>
                  {names.subcategories.get(e.subcategory_id) ?? "—"}
                  {e.fund_id && (
                    <span className="ml-1.5 rounded-full bg-bg px-1.5 py-0.5 text-[10px] text-muted">
                      {names.funds.get(e.fund_id)}
                    </span>
                  )}
                </Td>
                <Td className="text-muted">
                  {e.description ?? "—"}
                  <Clip count={attachmentCounts[e.id] ?? 0} />
                  <BankMark on={reconciled.has(e.id)} />
                  <StateChips entry={e} />
                </Td>
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
            className={`tap block w-full rounded-2xl bg-card p-3 text-left shadow-card-soft ${
              e.voided_at ? "opacity-70" : ""
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span
                className={`text-[12.5px] font-semibold ${
                  e.voided_at ? "text-muted line-through" : "text-dark"
                }`}
              >
                {names.subcategories.get(e.subcategory_id) ?? "—"}
              </span>
              <span
                className={`shrink-0 tabular-nums text-[13px] font-semibold ${
                  e.voided_at
                    ? "text-muted line-through"
                    : e.amount > 0
                      ? "text-emerald-700"
                      : "text-rose-700"
                }`}
              >
                {e.amount > 0 ? "+" : "−"}
                {formatMoney(Math.abs(e.amount))} {e.currency}
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-muted">
              {isLocked(e) && <LockIcon />}
              {formatDate(e.entry_date)} · {names.accounts.get(e.account_id)}
              {e.fund_id ? ` · ${names.funds.get(e.fund_id)}` : ""}
              <Clip count={attachmentCounts[e.id] ?? 0} />
              <BankMark on={reconciled.has(e.id)} />
              <StateChips entry={e} />
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

      {/* Consulta de un movimiento que ya no se edita: anulado, de un mes
          cerrado, o con recibo emitido. Lo que se puede hacer con él son
          acciones sobre la fila (revertir, anular), nunca cambiarlo. */}
      {editing && (editing.voided_at || isLocked(editing) || editing.receipt_issued) && (
        <Modal
          title={
            editing.voided_at
              ? "Movimiento anulado"
              : isLocked(editing)
                ? `Movimiento de ${monthLabel(monthKeyOf(editing.entry_date))} (cerrado)`
                : "Movimiento con recibo emitido"
          }
          onClose={() => setEditing(null)}
        >
          <EntryDetails
            entry={editing}
            names={names}
            showNames={showNames}
            attachmentCount={attachmentCounts[editing.id] ?? 0}
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
          {!editing.voided_at && isLocked(editing) && (
            <ReasonRow
              key={`revert-${editing.id}`}
              label="Revertir con un contra-asiento"
              hint={`${monthLabel(monthKeyOf(editing.entry_date))} está cerrado. Se carga hoy un movimiento igual con el signo cambiado, que apunta a este. Después cargá el correcto, si hace falta.`}
              placeholder="Motivo: por qué se corrige"
              confirmLabel="Crear contra-asiento"
              tone="terra"
              run={(reason) => {
                const fd = new FormData();
                fd.set("id", editing.id);
                fd.set("reason", reason);
                fd.set("bahai_year", String(year));
                return revertEntryAction(fd);
              }}
              onDone={() => {
                setEditing(null);
                refresh();
              }}
            />
          )}
          {!editing.voided_at &&
            !isLocked(editing) &&
            editing.receipt_issued &&
            !editing.transfer_group_id &&
            !editing.is_opening_balance && (
              <ReasonRow
                key={`void-${editing.id}`}
                label="Anular este recibo"
                hint={`El recibo N.° ${editing.receipt_number ?? "—"} ya fue emitido, así que no se edita ni se borra: se anula. El número queda ocupado y el aporte deja de sumar. Si el aporte fue real, cargalo de nuevo.`}
                placeholder="Motivo de la anulación"
                confirmLabel="Sí, anular"
                tone="rose"
                run={(reason) => {
                  const fd = new FormData();
                  fd.set("id", editing.id);
                  fd.set("reason", reason);
                  return voidEntryAction(fd);
                }}
                onDone={() => {
                  setEditing(null);
                  refresh();
                }}
              />
            )}
        </Modal>
      )}

      {/* Edición */}
      {editing && !editing.voided_at && !isLocked(editing) && !editing.receipt_issued && (
        <Modal title="Editar movimiento" onClose={() => setEditing(null)}>
          <EntryForm
            catalog={catalog}
            year={year}
            today={today}
            nextReceipt={nextReceipt}
            entry={editing}
            attachmentCount={attachmentCounts[editing.id] ?? 0}
            lastReceiptNames={lastReceiptNames}
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

/**
 * El panel de filtros.
 *
 * El período va primero y separado del resto por una línea, porque es de
 * otra naturaleza: los demás filtros esconden filas de lo que ya está en
 * pantalla, y el período cambia lo que se trae de la base. Eso se nota
 * —hay una navegación— y el orden lo explica sin decirlo.
 */
function FiltersPanel({
  filters,
  set,
  onClear,
  catalog,
  subcategoryOptions,
  currencies,
  kinds,
  range,
  today,
  onRange,
  onClearRange,
}: {
  filters: LedgerFilters;
  set: <K extends keyof LedgerFilters>(k: K, v: LedgerFilters[K]) => void;
  onClear: () => void;
  catalog: LedgerCatalog;
  subcategoryOptions: LedgerCatalog["subcategories"];
  currencies: string[];
  kinds: EntryKind[];
  range: { from: string; to: string } | null;
  today: string;
  onRange: (from: string, to: string) => void;
  onClearRange: () => void;
}) {
  // Los atajos son meses CIVILES porque así vienen los extractos y así
  // se cierra el libro (054), aunque el ejercicio corra de Riḍván a
  // Riḍván. Doce hacia atrás alcanzan para cualquier conciliación.
  const months = useMemo(() => {
    const out: string[] = [];
    let k = monthKeyOf(today);
    for (let i = 0; i < 12; i++) {
      out.push(k);
      const [y, m] = k.split("-").map((p) => parseInt(p, 10));
      const d = new Date(Date.UTC(y, m - 2, 1));
      k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    }
    return out;
  }, [today]);

  const activeMonth =
    range && months.find((k) => {
      const r = monthRange(k);
      return r.from === range.from && r.to === range.to;
    });

  return (
    <div className="mb-4 rounded-2xl bg-card p-4 shadow-card-soft">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          Período
        </h3>
        {range && (
          <button
            type="button"
            onClick={onClearRange}
            className="tap text-[11.5px] font-semibold text-terra hover:underline"
          >
            Volver al ejercicio
          </button>
        )}
      </div>
      <p className="mb-2 text-[11.5px] text-muted">
        Un rango de fechas trae los movimientos aunque queden a los dos
        lados de Riḍván, que es donde cambia el ejercicio contable. Es lo
        que hace falta para cuadrar contra un extracto.
      </p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {months.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              const r = monthRange(k);
              onRange(r.from, r.to);
            }}
            className={`tap rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${
              activeMonth === k
                ? "border-terra bg-terra text-white"
                : "border-black/10 text-dark hover:bg-bg"
            }`}
          >
            {monthLabel(k)}
          </button>
        ))}
      </div>
      <RangeInputs range={range} onRange={onRange} />

      <div className="mt-4 border-t border-black/[0.06] pt-3">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Acotar la lista
          </h3>
          <button
            type="button"
            onClick={onClear}
            className="tap text-[11.5px] font-semibold text-terra hover:underline"
          >
            Limpiar filtros
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Picker
            label="Cuenta"
            value={filters.accountId}
            onChange={(v) => set("accountId", v)}
            all="Todas las cuentas"
            options={catalog.accounts}
          />
          <Picker
            label="Fondo"
            value={filters.fundId}
            onChange={(v) => set("fundId", v)}
            all="Todos los fondos"
            options={catalog.funds}
          />
          <Picker
            label="Categoría"
            value={filters.categoryId}
            onChange={(v) => {
              set("categoryId", v);
              // La subcategoría elegida puede no pertenecer a la
              // categoría nueva: dejarla puesta daría cero filas sin que
              // se vea por qué.
              set("subcategoryId", "");
            }}
            all="Todas las categorías"
            options={catalog.categories}
          />
          <Picker
            label="Subcategoría"
            value={filters.subcategoryId}
            onChange={(v) => set("subcategoryId", v)}
            all="Todas las subcategorías"
            options={subcategoryOptions}
          />
          {currencies.length > 1 && (
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-muted">
                Moneda
              </span>
              <select
                value={filters.currency}
                onChange={(e) => set("currency", e.target.value)}
                className={`${controlClass} w-full`}
              >
                <option value="">Todas</option>
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-muted">
              Tipo
            </span>
            <select
              value={filters.kind}
              onChange={(e) => set("kind", e.target.value as EntryKind | "")}
              className={`${controlClass} w-full`}
            >
              <option value="">Todos los movimientos</option>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-muted">
              Extracto
            </span>
            <select
              value={filters.reconciled}
              onChange={(e) =>
                set("reconciled", e.target.value as LedgerFilters["reconciled"])
              }
              className={`${controlClass} w-full`}
            >
              <option value="">Conciliados y sin conciliar</option>
              <option value="no">Todavía sin conciliar</option>
              <option value="si">Ya conciliados</option>
            </select>
          </label>
        </div>
        <p className="mt-2 text-[11.5px] text-muted">
          &quot;Sin conciliar&quot; es lo que el libro tiene y el extracto
          todavía no cerró. Una cuenta de la que nunca se importó un
          extracto aparece entera sin conciliar, que es lo que corresponde.
        </p>
      </div>
    </div>
  );
}

/** Las dos puntas del rango. Se aplican con el botón y no al tipear,
 *  porque cada cambio es una ida al servidor y el campo emite ""
 *  mientras la fecha está a medio escribir. */
function RangeInputs({
  range,
  onRange,
}: {
  range: { from: string; to: string } | null;
  onRange: (from: string, to: string) => void;
}) {
  const [from, setFrom] = useState(range?.from ?? "");
  const [to, setTo] = useState(range?.to ?? "");
  const ready = Boolean(from && to && from <= to);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold text-muted">
          Desde
        </span>
        <DateInput
          value={from}
          onValueChange={setFrom}
          className={controlClass}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold text-muted">
          Hasta
        </span>
        <DateInput
          value={to}
          onValueChange={setTo}
          className={controlClass}
        />
      </label>
      <button
        type="button"
        disabled={!ready}
        onClick={() => onRange(from, to)}
        className="tap rounded-xl bg-terra px-3 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40"
      >
        Aplicar
      </button>
      {from && to && from > to && (
        <span className="text-[11.5px] text-rose-700">
          La fecha de inicio es posterior a la del final.
        </span>
      )}
    </div>
  );
}

function Picker({
  label,
  value,
  onChange,
  all,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  all: string;
  options: Array<{ id: string; name: string }>;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-muted">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${controlClass} w-full`}
      >
        <option value="">{all}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Una cifra de la barra de totales de lo filtrado. */
function Total({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: number;
  tone?: "income" | "expense";
  strong?: boolean;
}) {
  const color =
    tone === "income"
      ? "text-emerald-700"
      : tone === "expense"
        ? "text-rose-700"
        : value < 0
          ? "text-rose-700"
          : "text-dark";
  return (
    <span className="whitespace-nowrap">
      <span className="text-muted">{label} </span>
      <span
        className={`tabular-nums ${color} ${strong ? "font-semibold" : ""}`}
      >
        {formatMoney(value)}
      </span>
    </span>
  );
}

function FilterIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

/** Clip de comprobantes. No dice "0": la ausencia se nota sola y la
 *  lista ya tiene bastante ruido. */
/** El movimiento ya cerró contra el extracto de la plataforma (061). */
function BankMark({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <span
      className="ml-1.5 inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-emerald-700"
      title="Conciliado con el extracto de la plataforma"
    >
      banco ✓
    </span>
  );
}

function Clip({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-bg px-1.5 py-0.5 align-middle text-[10px] text-muted"
      title={count === 1 ? "1 comprobante" : `${count} comprobantes`}
    >
      <svg
        width="9"
        height="9"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.67 3.67 0 0 1 5.19 5.19l-9.2 9.19a1.83 1.83 0 0 1-2.59-2.6l8.49-8.48" />
      </svg>
      {count}
    </span>
  );
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

/** Candado: el mes de este movimiento ya se cerró. */
function LockIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Mes cerrado"
      className="mr-1 inline-block align-[-1px] text-muted"
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

/** Los estados que cambian qué se puede hacer con la fila (054). */
function StateChips({ entry: e }: { entry: TreasuryEntry }) {
  const chips: Array<{ text: string; cls: string; title?: string }> = [];
  if (e.voided_at) {
    chips.push({
      text: "Anulado",
      cls: "bg-rose-50 text-rose-700",
      title: e.void_reason ?? undefined,
    });
  }
  if (e.adjusts_entry_id) {
    chips.push({
      text: "Contra-asiento",
      cls: "bg-amber-50 text-amber-800",
      title: e.adjustment_reason ?? undefined,
    });
  }
  if (chips.length === 0) return null;
  return (
    <>
      {chips.map((c) => (
        <span
          key={c.text}
          title={c.title}
          className={`ml-1.5 inline-block rounded px-1.5 py-0.5 align-middle text-[9.5px] font-bold uppercase tracking-wide no-underline ${c.cls}`}
          style={{ textDecoration: "none" }}
        >
          {c.text}
        </span>
      ))}
    </>
  );
}

/** El movimiento en lectura, para los que ya no se editan. */
function EntryDetails({
  entry: e,
  names,
  showNames,
  attachmentCount,
}: {
  entry: TreasuryEntry;
  names: {
    accounts: Map<string, string>;
    funds: Map<string, string>;
    subcategories: Map<string, string>;
    contributors: Map<string, string>;
  };
  showNames: boolean;
  attachmentCount: number;
}) {
  const rows: Array<[string, React.ReactNode]> = [
    ["Fecha", formatDate(e.entry_date)],
    ["Cuenta", names.accounts.get(e.account_id) ?? "—"],
    [
      "Rubro",
      `${names.subcategories.get(e.subcategory_id) ?? "—"}${
        e.fund_id ? ` · ${names.funds.get(e.fund_id) ?? ""}` : ""
      }`,
    ],
    [
      e.amount > 0 ? "Ingreso" : "Gasto",
      `${formatMoney(Math.abs(e.amount))} ${e.currency}`,
    ],
  ];
  if (e.contributor_id) {
    rows.push([
      "Contribuyente",
      showNames ? (
        `${names.contributors.get(e.contributor_id) ?? "—"}${
          e.receipt_name ? ` (${e.receipt_name})` : ""
        }`
      ) : (
        <Masked />
      ),
    ]);
  }
  if (e.description) rows.push(["Descripción", e.description]);
  if (attachmentCount > 0) {
    rows.push(["Comprobantes", `${attachmentCount}`]);
  }
  if (e.voided_at) {
    rows.push(["Anulado", e.void_reason || "sin motivo registrado"]);
  }
  if (e.adjusts_entry_id) {
    rows.push(["Contra-asiento", e.adjustment_reason || "revierte un movimiento cerrado"]);
  }
  return (
    <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-[12.5px]">
      {rows.map(([k, v]) => (
        <Fragment key={k}>
          <dt className="text-muted">{k}</dt>
          <dd className={`text-dark ${e.voided_at && k !== "Anulado" ? "line-through" : ""}`}>
            {v}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}

/**
 * Una acción sobre la fila que exige motivo (anular, revertir): se abre
 * con un botón, pide el texto, confirma y corre el server action. El
 * motivo queda en la base, que es lo que separa una corrección auditable
 * de una tachadura.
 */
function ReasonRow({
  label,
  hint,
  placeholder,
  confirmLabel,
  tone,
  run,
  onDone,
}: {
  label: string;
  hint: string;
  placeholder: string;
  confirmLabel: string;
  tone: "rose" | "terra";
  run: (reason: string) => Promise<{ ok: boolean; error: string | null }>;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (reason.trim().length < 3) {
      setError("Escribí el motivo.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await run(reason.trim());
    setBusy(false);
    if (res.ok) onDone();
    else setError(res.error);
  }

  const button =
    tone === "rose"
      ? "bg-rose-600 text-white"
      : "bg-terra text-white";
  const link = tone === "rose" ? "text-rose-600" : "text-terra";

  return (
    <div className="mt-4 border-t border-black/[0.06] pt-3">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`text-[12px] font-semibold hover:underline ${link}`}
        >
          {label}
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-[12px] leading-snug text-muted">{hint}</p>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={placeholder}
            maxLength={500}
            autoFocus
            className={controlClass + " w-full"}
          />
          {error && <p className="text-[11.5px] text-rose-600">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className={`tap rounded-xl px-3 py-1.5 text-[12px] font-semibold disabled:opacity-60 ${button}`}
            >
              {busy ? "Guardando…" : confirmLabel}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[12px] font-medium text-muted underline"
            >
              Cancelar
            </button>
          </div>
        </div>
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
  // Solo las activas: las dadas de baja en el Catálogo no se ofrecen.
  const activeSubs = catalog.subcategories.filter((s) => s.is_active);
  const transferSubs = activeSubs.filter((s) =>
    /cambio de caja|divisa|transferencia/i.test(s.name)
  );
  const options = transferSubs.length > 0 ? transferSubs : activeSubs;

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
          <DateInput
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
            {catalog.accounts.filter((a) => a.is_active).map((a) => (
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
            {catalog.accounts.filter((a) => a.is_active).map((a) => (
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
        className="max-h-[calc(92dvh/var(--ui-zoom,1))] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-card p-4 shadow-card-elevated sm:rounded-2xl"
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
