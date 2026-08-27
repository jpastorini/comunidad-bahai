"use client";

import { useMemo, useRef, useState } from "react";
import {
  AttachmentsPanel,
  type AttachmentsHandle,
} from "@/components/treasury/AttachmentsPanel";
import type {
  LedgerCatalog,
  TreasuryEntry,
} from "@/lib/treasury-ledger";
import { parseMoney } from "@/lib/treasury-format";
import { saveEntryAction } from "./actions";

type Props = {
  catalog: LedgerCatalog;
  year: number;
  /** Fecha de hoy (ISO), calculada en el servidor con el huso de la comunidad. */
  today: string;
  /** Próximo número de recibo libre. */
  nextReceipt: number;
  /** Si viene, el formulario edita ese movimiento en vez de crear uno. */
  entry?: TreasuryEntry | null;
  /** Cuántos comprobantes tiene ya. Solo se usa para decidir si mostrar
   *  el panel en un ingreso: normalmente las facturas son de gastos. */
  attachmentCount?: number;
  onSaved: () => void;
  onCancel?: () => void;
};

/**
 * Alta y edición de un movimiento.
 *
 * Réplica de la comodidad de la planilla: al elegir la subcategoría se
 * completan solos la categoría y el fondo, la fecha arranca en hoy y el
 * número de recibo en el siguiente libre. Después de guardar el foco
 * vuelve al monto, para poder encadenar varias cargas seguidas.
 */
export function EntryForm({
  catalog,
  year,
  today,
  nextReceipt,
  entry,
  attachmentCount = 0,
  onSaved,
  onCancel,
}: Props) {
  const isEdit = Boolean(entry);
  const formRef = useRef<HTMLFormElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const attachmentsRef = useRef<AttachmentsHandle>(null);

  const [direction, setDirection] = useState<"ingreso" | "gasto">(
    entry ? (entry.amount < 0 ? "gasto" : "ingreso") : "ingreso"
  );
  const [subcategoryId, setSubcategoryId] = useState(entry?.subcategory_id ?? "");
  const [fundId, setFundId] = useState(entry?.fund_id ?? "");
  const [currency, setCurrency] = useState(entry?.currency ?? "UYU");
  const [contributorText, setContributorText] = useState(
    entry?.contributor_id
      ? catalog.contributors.find((c) => c.id === entry.contributor_id)?.name ?? ""
      : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // El monto se sigue en estado además del input: lo necesita el panel
  // de comprobantes para avisar si las facturas no cuadran.
  const [amountText, setAmountText] = useState(
    entry ? Math.abs(entry.amount).toFixed(2) : ""
  );

  const amountValue = amountText.trim() ? parseMoney(amountText) : NaN;
  // Las facturas son del gasto. En un ingreso el comprobante lo emitimos
  // nosotros, así que el panel solo aparece si ese asiento ya tiene algo
  // adjunto —para no esconderlo si alguna vez se cargó al revés.
  const showAttachments = direction === "gasto" || attachmentCount > 0;

  const subcategory = catalog.subcategories.find((s) => s.id === subcategoryId);
  const categoryName = useMemo(() => {
    if (!subcategory) return null;
    return catalog.categories.find((c) => c.id === subcategory.category_id)?.name ?? null;
  }, [subcategory, catalog.categories]);

  function onSubcategoryChange(id: string) {
    setSubcategoryId(id);
    const sub = catalog.subcategories.find((s) => s.id === id);
    // El fondo se propone, no se impone: los saldos de apertura del mismo
    // rubro van a fondos distintos.
    setFundId(sub?.default_fund_id ?? "");
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    // El contribuyente se escribe libre con autocompletado. Si el texto
    // coincide con uno existente mandamos el id; si no, el nombre para
    // que la action lo dé de alta.
    const typed = contributorText.trim();
    const match = catalog.contributors.find(
      (c) => c.name.trim().toLowerCase() === typed.toLowerCase()
    );
    fd.delete("contributor_text");
    if (match) fd.set("contributor_id", match.id);
    else if (typed) fd.set("contributor_name", typed);

    setSaving(true);
    setError(null);
    const res = await saveEntryAction(fd);

    if (!res.ok) {
      setSaving(false);
      setError(res.error);
      return;
    }

    // Los comprobantes cuelgan del movimiento, así que en un alta recién
    // ahora hay dónde colgarlos. Si alguno falla, el movimiento YA quedó
    // guardado: se avisa sin deshacerlo, porque el asiento es lo que no
    // se puede perder.
    if (res.id && (attachmentsRef.current?.pendingCount() ?? 0) > 0) {
      const uploadError = await attachmentsRef.current?.uploadPending(res.id);
      if (uploadError) {
        setSaving(false);
        setError(
          `El movimiento se guardó, pero un comprobante no subió: ${uploadError}`
        );
        onSaved();
        return;
      }
    }

    setSaving(false);

    if (!isEdit) {
      // Encadenar cargas: se limpia lo variable y se conserva el contexto
      // (fecha, cuenta, rubro), que en una tanda suele repetirse.
      form.querySelectorAll<HTMLInputElement>("[data-clear-on-save]").forEach((el) => {
        el.value = "";
      });
      setAmountText("");
      setContributorText("");
      amountRef.current?.focus();
    }
    onSaved();
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
      {isEdit && <input type="hidden" name="id" value={entry!.id} />}
      <input type="hidden" name="bahai_year" value={year} />
      <input type="hidden" name="direction" value={direction} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="fund_id" value={fundId} />

      {/* Ingreso o gasto */}
      <div className="flex gap-2">
        <Segment
          active={direction === "ingreso"}
          onClick={() => setDirection("ingreso")}
          tone="income"
        >
          Ingreso
        </Segment>
        <Segment
          active={direction === "gasto"}
          onClick={() => setDirection("gasto")}
          tone="expense"
        >
          Gasto
        </Segment>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Fecha" className="col-span-1">
          <input
            type="date"
            name="entry_date"
            defaultValue={entry?.entry_date ?? today}
            required
            className={inputClass}
          />
        </Field>

        <Field label="Monto" className="col-span-1">
          <div className="flex gap-1">
            <input
              ref={amountRef}
              type="text"
              inputMode="decimal"
              name="amount"
              data-clear-on-save
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              placeholder="0,00"
              required
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              onClick={() => setCurrency(currency === "UYU" ? "USD" : "UYU")}
              className="shrink-0 rounded-xl border border-black/10 px-2 text-[12px] font-semibold text-dark hover:bg-bg"
              title="Cambiar moneda"
            >
              {currency}
            </button>
          </div>
        </Field>

        <Field label="Cuenta" className="col-span-2 sm:col-span-1">
          <select
            name="account_id"
            defaultValue={entry?.account_id ?? ""}
            required
            className={inputClass}
          >
            <option value="">Elegir…</option>
            {catalog.accounts
              .filter((a) => a.is_active || a.id === entry?.account_id)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </Field>

        <Field label="Fondo" className="col-span-2 sm:col-span-1">
          <select
            value={fundId}
            onChange={(e) => setFundId(e.target.value)}
            className={inputClass}
          >
            <option value="">Sin fondo</option>
            {catalog.funds.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Subcategoría">
        <select
          name="subcategory_id"
          value={subcategoryId}
          onChange={(e) => onSubcategoryChange(e.target.value)}
          required
          className={inputClass}
        >
          <option value="">Elegir…</option>
          {catalog.subcategories
            .filter((s) => s.is_active || s.id === entry?.subcategory_id)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </select>
        {categoryName && (
          <span className="mt-1 inline-block text-[11px] text-muted">
            Categoría: <strong className="font-semibold">{categoryName}</strong>
          </span>
        )}
      </Field>

      <Field label="Descripción">
        <input
          type="text"
          name="description"
          data-clear-on-save
          defaultValue={entry?.description ?? ""}
          placeholder="Para qué fue"
          className={inputClass}
        />
      </Field>

      {showAttachments && (
        <AttachmentsPanel
          ref={attachmentsRef}
          entryId={entry?.id ?? null}
          entryAmount={Number.isFinite(amountValue) ? amountValue : null}
          currency={currency}
        />
      )}

      {direction === "ingreso" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Contribuyente" className="col-span-2">
            <input
              type="text"
              list="contribuyentes"
              value={contributorText}
              onChange={(e) => setContributorText(e.target.value)}
              placeholder="Nombre o dejar vacío"
              className={inputClass}
            />
            <datalist id="contribuyentes">
              {catalog.contributors.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </Field>

          <Field label="N° recibo" className="col-span-1">
            <input
              type="number"
              name="receipt_number"
              defaultValue={entry?.receipt_number ?? nextReceipt}
              className={inputClass}
            />
          </Field>

          <Field label="Aportes" className="col-span-1">
            <input
              type="number"
              name="contributions_count"
              min={0}
              defaultValue={entry?.contributions_count ?? 1}
              className={inputClass}
              title="Cuántos aportes agrupa esta línea (la canasta de la Fiesta puede ser varios)"
            />
          </Field>
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="tap rounded-xl bg-terra px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Agregar movimiento"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="tap rounded-xl border border-black/10 px-4 py-2 text-[13px] font-semibold text-muted hover:bg-bg"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-xl border border-black/10 bg-bg/40 px-3 py-2 text-[13.5px] text-dark outline-none focus:border-terra";

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[10.5px] uppercase tracking-wide text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function Segment({
  active,
  onClick,
  tone,
  children,
}: {
  active: boolean;
  onClick: () => void;
  tone: "income" | "expense";
  children: React.ReactNode;
}) {
  const activeClass =
    tone === "income"
      ? "bg-emerald-600 text-white"
      : "bg-rose-600 text-white";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap flex-1 rounded-xl px-3 py-2 text-[13px] font-semibold transition ${
        active ? activeClass : "border border-black/10 text-muted hover:bg-bg"
      }`}
    >
      {children}
    </button>
  );
}
