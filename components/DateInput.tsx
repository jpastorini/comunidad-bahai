"use client";

import { useEffect, useRef, useState } from "react";
import { IconCalendario } from "@/components/Icons";

// Campo de fecha que se ve SIEMPRE como dd/mm/aaaa.
//
// Existe porque un `<input type="date">` no se deja formatear: el navegador
// lo dibuja con el idioma de SU interfaz, no el de la página. En un Chrome o
// un Windows en inglés sale mm/dd/aaaa aunque todo lo demás esté en español,
// y "03/04" pasa a significar otra fecha según quién mire.
//
// Lo que viaja no cambia: el valor es "yyyy-mm-dd", en un hidden con el
// `name` de siempre, así que los server actions no se enteran. Se escribe a
// mano (las barras se ponen solas) o se elige del calendario del sistema,
// que es un `<input type="date">` invisible encima del ícono: la grilla de
// días no tiene el problema, solo lo tenía el texto.

type Props = {
  name?: string;
  id?: string;
  /** Controlado: "yyyy-mm-dd" o "". */
  value?: string;
  defaultValue?: string;
  /** Recibe "yyyy-mm-dd", o "" mientras la fecha está incompleta o no existe. */
  onValueChange?: (iso: string) => void;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
};

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TEXT_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/;
const MAX_LEN = [2, 2, 4];

function isoToText(iso: string): string {
  const m = ISO_RE.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** Solo dígitos y barras (punto, guion o espacio cuentan como barra), a lo
 *  sumo 2/2/4, y la barra aparece sola cuando el segmento se llena y se
 *  sigue tipeando. No se agrega al llenar: si no, borrar la barra la
 *  volvería a poner. */
function mask(input: string): string {
  const s = input.replace(/[.\-\s]/g, "/").replace(/[^\d/]/g, "");
  const segs: string[] = [];
  let cur = "";
  for (const ch of s) {
    const i = segs.length;
    if (ch === "/") {
      if (cur && i < 2) {
        segs.push(cur);
        cur = "";
      }
      continue;
    }
    if (cur.length < MAX_LEN[i]) cur += ch;
    else if (i < 2) {
      segs.push(cur);
      cur = ch;
    }
  }
  return [...segs, cur].join("/");
}

/** "d/m/aaaa" → "yyyy-mm-dd" si la fecha existe. Con `loose` acepta año de
 *  dos cifras (20aa), que solo se interpreta al salir del campo. */
function textToIso(text: string, loose = false): string {
  const m = TEXT_RE.exec(text);
  if (!m) return "";
  if (m[3].length === 2 && !loose) return "";
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const mo = Number(m[2]);
  const d = Number(m[1]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return "";
  }
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function DateInput({
  name,
  id,
  value,
  defaultValue,
  onValueChange,
  required,
  disabled,
  min,
  max,
  className = "",
}: Props) {
  const initial = value ?? defaultValue ?? "";
  const [iso, setIso] = useState(initial);
  const [text, setText] = useState(() => isoToText(initial));
  const lastEmitted = useRef(initial);
  const textRef = useRef<HTMLInputElement>(null);

  // Controlado: si el padre cambia el valor (un atajo de período, un reset),
  // se refleja. Lo que acabamos de emitir no, o el "" de una fecha a medio
  // escribir borraría lo que la persona está tipeando.
  useEffect(() => {
    if (value === undefined || value === lastEmitted.current) return;
    lastEmitted.current = value;
    setIso(value);
    setText(isoToText(value));
  }, [value]);

  function commit(next: string) {
    setIso(next);
    if (next !== lastEmitted.current) {
      lastEmitted.current = next;
      onValueChange?.(next);
    }
  }

  // El hidden no participa de la validación del formulario: la hace el
  // campo visible, con mensajes en palabras.
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    let msg = "";
    if (text && !iso) msg = "Escribí la fecha como dd/mm/aaaa.";
    else if (iso && min && iso < min) msg = `La fecha no puede ser anterior al ${isoToText(min)}.`;
    else if (iso && max && iso > max) msg = `La fecha no puede ser posterior al ${isoToText(max)}.`;
    el.setCustomValidity(msg);
  }, [text, iso, min, max]);

  return (
    <div className="relative">
      <input
        ref={textRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/aaaa"
        maxLength={10}
        required={required}
        disabled={disabled}
        value={text}
        onChange={(e) => {
          const t = mask(e.target.value);
          setText(t);
          commit(textToIso(t));
        }}
        onBlur={() => {
          // Al salir, "5/9/26" queda escrito como "05/09/2026".
          const next = textToIso(text, true);
          if (next) {
            setText(isoToText(next));
            commit(next);
          }
        }}
        className={`${className} pr-9 tabular-nums`}
      />
      {name && <input type="hidden" name={name} value={iso} />}
      {/* El `<input type="date">` va encima del ícono, invisible pero
          tocable: en el celular un toque directo es lo único que abre la
          rueda del sistema sin depender de showPicker(). En la PC ese
          toque cae en el texto del control, que no abre nada solo; de
          ahí el showPicker() del click. */}
      <span className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted">
        <IconCalendario size={16} />
        <input
          type="date"
          tabIndex={-1}
          aria-label="Elegir en el calendario"
          disabled={disabled}
          min={min}
          max={max}
          value={iso}
          onClick={(e) => {
            try {
              e.currentTarget.showPicker();
            } catch {
              // Sin showPicker: el toque ya lo abre por su cuenta.
            }
          }}
          onChange={(e) => {
            setText(isoToText(e.target.value));
            commit(e.target.value);
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
        />
      </span>
    </div>
  );
}
