"use client";

import { useEffect, useRef, useState } from "react";

// Campo de hora que se ve SIEMPRE en 24 horas (hh:mm).
//
// Mismo problema que DateInput: un `<input type="time">` lo dibuja el
// navegador con el idioma de su interfaz, y en uno en inglés pide "07:00 PM".
// Acá no hay selector del sistema a propósito: el de un navegador en inglés
// también mostraría AM/PM, y escribir cuatro cifras es más rápido.
//
// Lo que viaja es "HH:MM", igual que el `type="time"`, en un hidden con el
// `name` de siempre (se renderiza aunque esté vacío, porque los campos
// `location_time[]` de la Fiesta se leen por posición).

type Props = {
  name?: string;
  id?: string;
  value?: string;
  defaultValue?: string;
  /** Recibe "HH:MM", o "" mientras la hora está incompleta. */
  onValueChange?: (hhmm: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

/** Dígitos y dos puntos (punto o espacio cuentan como dos puntos), a lo
 *  sumo 2:2; los dos puntos aparecen solos al seguir tipeando después de la
 *  hora, nunca al completarla (si no, borrarlos los volvería a poner). */
function mask(input: string): string {
  const s = input.replace(/[.\s]/g, ":").replace(/[^\d:]/g, "");
  let hh = "";
  let mm = "";
  let inMinutes = false;
  for (const ch of s) {
    if (ch === ":") {
      if (hh) inMinutes = true;
      continue;
    }
    // Una hora que empieza con 3 a 9 ya está completa: "730" es 7:30.
    const hourDone = hh.length === 2 || (hh.length === 1 && Number(hh) > 2);
    if (!inMinutes && !hourDone) hh += ch;
    else if (mm.length < 2) {
      inMinutes = true;
      mm += ch;
    }
  }
  return inMinutes ? `${hh}:${mm}` : hh;
}

/** "h:mm" → "HH:MM" si es una hora válida. Con `loose` acepta solo la hora
 *  ("19" → "19:00"), que se interpreta al salir del campo. */
function textToValue(text: string, loose = false): string {
  const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(text.replace(/:$/, ""));
  if (!m) return "";
  if (m[2] === undefined && !loose) return "";
  const h = Number(m[1]);
  const min = Number(m[2] ?? "0");
  if (h > 23 || min > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function normalize(v: string): string {
  return textToValue(v.slice(0, 5), true);
}

export function TimeInput({
  name,
  id,
  value,
  defaultValue,
  onValueChange,
  required,
  disabled,
  className = "",
}: Props) {
  const initial = normalize(value ?? defaultValue ?? "");
  const [hhmm, setHhmm] = useState(initial);
  const [text, setText] = useState(initial);
  const lastEmitted = useRef(initial);
  const textRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value === undefined) return;
    const v = normalize(value);
    if (v === lastEmitted.current) return;
    lastEmitted.current = v;
    setHhmm(v);
    setText(v);
  }, [value]);

  function commit(next: string) {
    setHhmm(next);
    if (next !== lastEmitted.current) {
      lastEmitted.current = next;
      onValueChange?.(next);
    }
  }

  useEffect(() => {
    textRef.current?.setCustomValidity(
      text && !hhmm ? "Escribí la hora como hh:mm, en 24 horas (ej. 19:30)." : ""
    );
  }, [text, hhmm]);

  return (
    <>
      <input
        ref={textRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="hh:mm"
        maxLength={5}
        required={required}
        disabled={disabled}
        value={text}
        onChange={(e) => {
          const t = mask(e.target.value);
          setText(t);
          commit(textToValue(t));
        }}
        onBlur={() => {
          // Al salir, "7" queda como "07:00" y "7:30" como "07:30".
          const next = textToValue(text, true);
          if (next) {
            setText(next);
            commit(next);
          }
        }}
        className={`${className} tabular-nums`}
      />
      {name && <input type="hidden" name={name} value={hhmm} />}
    </>
  );
}
