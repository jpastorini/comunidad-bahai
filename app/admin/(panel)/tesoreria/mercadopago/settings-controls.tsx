"use client";

import { useState } from "react";

/**
 * El interruptor de "Recibir aportes". Un checkbox chico no decía de un
 * vistazo si la comunidad está viendo el botón o no; esto lo dice con
 * color y con palabras. Sigue siendo un checkbox `name="enabled"`, así el
 * action no cambia.
 */
export function EnabledSwitch({ defaultOn }: { defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <label
      className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 px-5 py-4 transition-colors ${
        on ? "border-green bg-green/[0.08]" : "border-black/10 bg-bg/40"
      }`}
    >
      <input
        type="checkbox"
        name="enabled"
        checked={on}
        onChange={(e) => setOn(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-terra ${
          on ? "bg-green" : "bg-black/20"
        }`}
      >
        <span
          className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-7" : "translate-x-1"
          }`}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-dark">
          {on ? "Aportes por Mercado Pago: ACTIVADOS" : "Aportes por Mercado Pago: DESACTIVADOS"}
        </span>
        <span className="block text-[12.5px] text-muted">
          {on
            ? "Al guardar, la comunidad ve «Aportar con Mercado Pago» en Tesorería."
            : "La comunidad no ve el botón. Los aportes que ya estaban en curso se registran igual."}
        </span>
      </span>
    </label>
  );
}

/**
 * Un secreto ya guardado se muestra como puntos y no se puede leer: para
 * cambiarlo se toca «Reemplazar» y aparece el campo vacío. Mientras no se
 * reemplace, el campo no viaja en el formulario y el action conserva lo
 * guardado ("vacío = conservar").
 */
export function SecretField({
  id,
  name,
  savedHint,
  placeholder,
}: {
  id: string;
  name: string;
  /** Los últimos caracteres del guardado, o null si no hay nada guardado. */
  savedHint: string | null;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(!savedHint);
  const input =
    "w-full rounded-xl border border-black/10 bg-card px-3.5 py-2.5 text-[13px] text-dark outline-none placeholder:text-muted focus:border-terra";

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <div className={`${input} flex items-center gap-2 bg-bg/40 font-mono tracking-widest text-muted`}>
          <span className="truncate">••••••••••••••••••••••••</span>
          <span className="shrink-0 tracking-normal">{savedHint}</span>
          <span className="ml-auto shrink-0 font-sans text-[11px] tracking-normal text-green">✓ guardado</span>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 rounded-xl border border-black/10 bg-card px-3.5 py-2.5 text-[13px] font-semibold text-dark hover:bg-bg"
        >
          Reemplazar
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        name={name}
        type="password"
        autoComplete="off"
        autoFocus={Boolean(savedHint)}
        placeholder={placeholder}
        className={input}
      />
      {savedHint && (
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="shrink-0 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-muted hover:bg-bg"
        >
          Cancelar
        </button>
      )}
    </div>
  );
}
