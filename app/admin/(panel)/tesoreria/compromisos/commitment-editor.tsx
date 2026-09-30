"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LedgerMember, TreasuryContributor } from "@/lib/treasury-ledger";
import {
  ContributorPicker,
  type ContributorSelection,
} from "../libro/contributor-picker";
import { deleteCommitmentByTreasurerAction, saveCommitmentAction } from "./actions";

const INPUT =
  "w-full rounded-xl border border-black/10 bg-card px-3 py-2 text-[13.5px] text-dark outline-none placeholder:text-muted focus:border-terra";

type Values = {
  id?: string;
  display_name: string;
  amount: string;
  currency: "UYU" | "USD";
  phone: string;
  want_reminder: boolean;
};

/**
 * Alta de un compromiso por el tesorero (077). El botón abre el formulario
 * en el lugar; la persona se elige con el buscador del Libro.
 */
export function NewCommitment({
  contributors,
  members,
}: {
  contributors: TreasuryContributor[];
  members: LedgerMember[];
}) {
  const [open, setOpen] = useState(false);
  const [person, setPerson] = useState<ContributorSelection | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setNotice(null);
          }}
          className="rounded-xl bg-terra px-4 py-2 text-[13px] font-semibold text-white"
        >
          + Registrar un compromiso
        </button>
        {notice && <span className="text-[12.5px] text-green">{notice}</span>}
      </div>
    );
  }

  const isBeliever =
    person?.kind === "profile" || (person?.kind === "contributor" && !!person.profileId);

  return (
    <CommitmentForm
      title="Registrar un compromiso"
      initial={{ display_name: "", amount: "", currency: "UYU", phone: "", want_reminder: true }}
      onCancel={() => {
        setOpen(false);
        setPerson(null);
      }}
      onSaved={(msg) => {
        setOpen(false);
        setPerson(null);
        setNotice(msg);
      }}
      requirePerson={!person}
      personField={
        <div>
          <span className="mb-1 block text-[12px] font-semibold text-dark">Persona</span>
          {person?.kind === "contributor" && (
            <input type="hidden" name="contributor_id" value={person.id} />
          )}
          {person?.kind === "profile" && (
            <input type="hidden" name="contributor_profile_id" value={person.id} />
          )}
          {person?.kind === "new" && (
            <input type="hidden" name="contributor_name" value={person.name} />
          )}
          <ContributorPicker
            contributors={contributors}
            members={members}
            value={person}
            onChange={setPerson}
            inputClass={INPUT}
          />
          <p className="mt-1 text-[11.5px] leading-snug text-muted">
            {person == null
              ? "Un creyente de la app, alguien del padrón o un nombre nuevo si no está en ningún lado."
              : isBeliever
                ? "Está en la app: va a ver el compromiso en su Tesorería, le llega un aviso y, si lo pide, el recordatorio del 10."
                : "No está en la app: el día 10 aparece en el informe para recordarle vos, por WhatsApp si cargás el teléfono."}
          </p>
        </div>
      }
    />
  );
}

/** Corregir o quitar un compromiso desde su renglón del informe. */
export function CommitmentRowActions({ initial }: { initial: Values & { id: string } }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (editing) {
    return (
      <div className="mt-3">
        <CommitmentForm
          title="Corregir el compromiso"
          initial={initial}
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      </div>
    );
  }

  function remove() {
    const fd = new FormData();
    fd.set("id", initial.id);
    start(async () => {
      const r = await deleteCommitmentByTreasurerAction(fd);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-3 text-[12px]">
      <button type="button" onClick={() => setEditing(true)} className="font-semibold text-terra hover:underline">
        Corregir
      </button>
      {confirming ? (
        <span className="inline-flex items-center gap-2">
          <span className="text-dark">¿Quitar el compromiso?</span>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="font-semibold text-rose-600 hover:underline disabled:opacity-50"
          >
            {pending ? "Quitando…" : "Sí, quitar"}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="text-muted hover:underline">
            No
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="text-muted hover:text-rose-600 hover:underline">
          Quitar
        </button>
      )}
      {error && <span className="text-rose-700">{error}</span>}
    </span>
  );
}

function CommitmentForm({
  title,
  initial,
  personField,
  requirePerson,
  onCancel,
  onSaved,
}: {
  title: string;
  initial: Values;
  personField?: React.ReactNode;
  requirePerson?: boolean;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (requirePerson) {
      setError("Elegí a la persona.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const r = await saveCommitmentAction(fd);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onSaved(r.message ?? "Guardado.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-black/[0.06] bg-bg/40 p-4">
      <h3 className="mb-3 font-display text-[16px] font-semibold text-dark">{title}</h3>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        {personField && <div className="sm:col-span-2">{personField}</div>}
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-dark">Monto por mes</span>
          <div className="flex gap-2">
            <input
              name="amount"
              inputMode="decimal"
              required
              defaultValue={initial.amount}
              placeholder="1.000"
              className={INPUT}
            />
            <select name="currency" defaultValue={initial.currency} className={`${INPUT} w-auto`}>
              <option value="UYU">$ (pesos)</option>
              <option value="USD">US$</option>
            </select>
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-dark">Nombre para el informe</span>
          <input
            name="display_name"
            defaultValue={initial.display_name}
            placeholder="El de la ficha, si queda vacío"
            className={INPUT}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-dark">Teléfono (WhatsApp)</span>
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            defaultValue={initial.phone}
            placeholder="099 123 456"
            className={INPUT}
          />
          <span className="mt-1 block text-[11.5px] leading-snug text-muted">
            Opcional. Con él, el informe ofrece recordarle o agradecerle por WhatsApp con el mensaje ya escrito.
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5 self-center">
          <input
            type="checkbox"
            name="want_reminder"
            defaultChecked={initial.want_reminder}
            className="mt-0.5 h-4 w-4 rounded border-black/20 text-terra focus:ring-terra"
          />
          <span className="text-[13px] leading-snug text-dark">
            Pidió que se le recuerde
            <span className="block text-[11.5px] text-muted">
              Si está en la app le llega el aviso del 10; si no, el informe te lo marca para recordarle.
            </span>
          </span>
        </label>
      </div>
      {error && <p className="mt-3 text-[12.5px] text-rose-700">{error}</p>}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-terra px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" onClick={onCancel} className="text-[13px] text-muted hover:underline">
          Cancelar
        </button>
      </div>
    </form>
  );
}
