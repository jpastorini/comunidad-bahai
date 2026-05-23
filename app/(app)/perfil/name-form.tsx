"use client";

import { useState, useTransition } from "react";
import { updateFullNameAction } from "./actions";

export function NameForm({ initialName }: { initialName: string }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("full_name", name);
    startTransition(async () => {
      const res = await updateFullNameAction(fd);
      if (res.ok) {
        setEditing(false);
        setError(null);
      } else {
        setError(res.error);
      }
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10.5px] uppercase tracking-wide text-muted">
            Nombre
          </div>
          <div className="font-display text-[18px] font-semibold text-dark">
            {initialName || "Sin nombre"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[12px] font-semibold text-terra hover:underline"
        >
          Editar
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="text-[10.5px] uppercase tracking-wide text-muted">
        Nombre
      </div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        maxLength={80}
        className="w-full rounded-xl border border-black/10 bg-bg/40 px-3 py-2 text-[14px] text-dark outline-none focus:border-terra"
      />
      {error && <p className="text-[11.5px] text-rose-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-terra px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setName(initialName);
            setError(null);
            setEditing(false);
          }}
          className="rounded-xl border border-black/10 px-3 py-1.5 text-[12px] font-semibold text-muted"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
