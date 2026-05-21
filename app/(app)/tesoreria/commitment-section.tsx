"use client";

import { useState } from "react";
import type { TreasuryCommitment } from "@/lib/types";
import {
  deleteCommitmentAction,
  upsertCommitmentAction,
} from "./actions";

type Props = {
  defaultName: string;
  commitment: TreasuryCommitment | null;
};

/**
 * Sección donde el miembro declara su compromiso mensual de aporte.
 * - Si no tiene compromiso → muestra el form
 * - Si ya tiene uno → muestra resumen + botón "Editar" / "Quitar"
 */
export function CommitmentSection({ defaultName, commitment }: Props) {
  const [editing, setEditing] = useState(!commitment);

  return (
    <section className="mb-3.5 rounded-2xl border border-amber/20 bg-card p-4 shadow-card-soft">
      <h2 className="font-display text-[17px] font-semibold leading-tight text-dark">
        Compromiso mensual
      </h2>
      <p className="mt-1 text-[11.5px] leading-snug text-muted">
        Esta información es <strong className="text-dark">privada</strong>:
        solo la ve el tesorero de la Asamblea Local. Ningún otro miembro de
        la comunidad puede verla.
      </p>

      {!editing && commitment && (
        <ExistingCommitment
          commitment={commitment}
          onEdit={() => setEditing(true)}
        />
      )}

      {editing && (
        <CommitmentForm
          defaultName={defaultName}
          commitment={commitment}
          onCancel={commitment ? () => setEditing(false) : undefined}
        />
      )}
    </section>
  );
}

function ExistingCommitment({
  commitment,
  onEdit,
}: {
  commitment: TreasuryCommitment;
  onEdit: () => void;
}) {
  const fmt = (n: number) =>
    n.toLocaleString("es-MX", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });

  return (
    <div className="mt-3 rounded-xl bg-amber/[0.06] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-amber">
            Tu compromiso
          </div>
          <div className="mt-0.5 font-display text-[24px] font-bold leading-none text-dark">
            {fmt(commitment.amount)}{" "}
            <span className="text-[12px] font-normal text-muted">/ mes</span>
          </div>
          <div className="mt-1 text-[12px] text-dark">
            {commitment.display_name}
          </div>
          {commitment.want_reminder && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded bg-amber/15 px-2 py-0.5 text-[10px] font-semibold text-amber">
              ✓ Quieres recordatorios si hay retraso
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="tap text-[12px] font-semibold text-terra hover:underline"
        >
          Editar
        </button>
      </div>
      <form action={deleteCommitmentAction} className="mt-3">
        <button
          type="submit"
          className="text-[11px] font-medium text-rose-600 hover:underline"
        >
          Quitar compromiso
        </button>
      </form>
    </div>
  );
}

function CommitmentForm({
  defaultName,
  commitment,
  onCancel,
}: {
  defaultName: string;
  commitment: TreasuryCommitment | null;
  onCancel?: () => void;
}) {
  return (
    <form action={upsertCommitmentAction} className="mt-3 flex flex-col gap-3">
      <label className="block">
        <span className="mb-1 block text-[11.5px] font-semibold text-dark">
          Nombre
        </span>
        <input
          type="text"
          name="display_name"
          required
          defaultValue={commitment?.display_name ?? defaultName}
          placeholder="Familia García"
          className="w-full rounded-xl border border-black/10 bg-bg/40 px-3.5 py-2.5 text-[14px] text-dark outline-none focus:border-terra focus:bg-card"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-[11.5px] font-semibold text-dark">
          Monto mensual (USD)
        </span>
        <input
          type="number"
          name="amount"
          min="1"
          step="1"
          inputMode="numeric"
          required
          defaultValue={commitment?.amount ?? ""}
          placeholder="50"
          className="w-full rounded-xl border border-black/10 bg-bg/40 px-3.5 py-2.5 text-[14px] text-dark outline-none focus:border-terra focus:bg-card"
        />
      </label>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-bg/40 px-3 py-2.5">
        <input
          type="checkbox"
          name="want_reminder"
          defaultChecked={commitment?.want_reminder ?? false}
          className="mt-0.5 h-4 w-4 rounded border-black/20 text-terra focus:ring-terra"
        />
        <span className="text-[12.5px] leading-snug text-dark">
          <strong>Quiero que se me recuerde</strong> si hay un retraso en mi
          aporte (el tesorero podrá contactarme).
        </span>
      </label>

      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="tap flex-1 rounded-xl border border-black/10 bg-card px-4 py-2.5 text-[13px] font-semibold text-dark"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          className="tap flex-1 rounded-xl bg-terra px-4 py-2.5 text-[13px] font-semibold text-white shadow-card-soft"
        >
          {commitment ? "Guardar cambios" : "Registrar compromiso"}
        </button>
      </div>
    </form>
  );
}
