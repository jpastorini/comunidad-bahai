"use client";

import { useState } from "react";
import { Checkbox, Field, TextInput } from "@/components/admin/ui";
import { POLL_MAX_OPTIONS, POLL_MIN_OPTIONS } from "@/lib/polls";
import type { MessagePoll } from "@/lib/types";

type Props = {
  poll: MessagePoll | null;
  /** Cuántas personas ya votaron. Con votos, la pregunta y las opciones quedan congeladas. */
  participants: number;
};

/**
 * La pregunta de un comunicado (051), dentro del formulario de la
 * Asamblea. Cuatro cosas y nada más: la pregunta, de 2 a 10 opciones,
 * si se pueden elegir varias, si es anónima; más una fecha de cierre
 * opcional.
 *
 * Con votos ya emitidos, editar la pregunta o las opciones dejaría los
 * votos apuntando a otra cosa, así que se muestran de solo lectura y lo
 * único que se puede seguir cambiando es la fecha de cierre. Cerrar a
 * mano se hace desde el informe.
 *
 * ⚠️ Los campos de solo lectura NO se envían (un control `disabled` no
 * viaja con el formulario); el action los omite del payload a propósito,
 * no depende de que lleguen.
 */
export function PollFields({ poll, participants }: Props) {
  const locked = participants > 0;
  const [enabled, setEnabled] = useState(Boolean(poll));
  const [options, setOptions] = useState<string[]>(
    poll ? poll.options.map((o) => o.label) : ["", ""]
  );

  const closesOn = poll?.closes_at ? toMontevideoDate(poll.closes_at) : "";

  function setOption(i: number, value: string) {
    setOptions((prev) => prev.map((o, j) => (j === i ? value : o)));
  }
  function addOption() {
    if (options.length >= POLL_MAX_OPTIONS) return;
    setOptions((prev) => [...prev, ""]);
  }
  function removeOption(i: number) {
    if (options.length <= POLL_MIN_OPTIONS) return;
    setOptions((prev) => prev.filter((_, j) => j !== i));
  }

  return (
    <div>
      {poll && <input type="hidden" name="poll_id" value={poll.id} />}
      {locked ? (
        <>
          <input type="hidden" name="poll_enabled" value="on" />
          <p className="mb-3 text-[12px] text-muted">
            {participants === 1 ? "Ya votó una persona" : `Ya votaron ${participants} personas`}:
            la pregunta y las opciones no se pueden cambiar. Podés ajustar la fecha de
            cierre, o cerrar la votación desde el informe.
          </p>
        </>
      ) : (
        <Checkbox
          name="poll_enabled"
          label="Incluir una pregunta para votar (como una encuesta de WhatsApp)"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
      )}

      {(enabled || locked) && (
        <div className="mt-4 flex flex-col gap-4">
          <Field label="Pregunta" name="poll_question" required={!locked}>
            {locked ? (
              <ReadOnly>{poll?.question}</ReadOnly>
            ) : (
              <TextInput
                id="poll_question"
                name="poll_question"
                required
                maxLength={200}
                defaultValue={poll?.question ?? ""}
                placeholder="¿Qué día les queda mejor para la reunión devocional?"
              />
            )}
          </Field>

          <div>
            <div className="mb-1.5 text-[12px] font-semibold text-dark">
              Opciones{" "}
              <span className="font-normal text-muted">
                (de {POLL_MIN_OPTIONS} a {POLL_MAX_OPTIONS})
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {locked
                ? poll?.options.map((o) => <ReadOnly key={o.id}>{o.label}</ReadOnly>)
                : options.map((label, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <TextInput
                        name="poll_options[]"
                        required
                        maxLength={100}
                        value={label}
                        onChange={(e) => setOption(i, e.target.value)}
                        placeholder={`Opción ${i + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeOption(i)}
                        disabled={options.length <= POLL_MIN_OPTIONS}
                        className="shrink-0 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-muted hover:bg-black/[0.04] hover:text-rose-600 disabled:opacity-30"
                        aria-label="Quitar opción"
                        title="Quitar opción"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
            </div>
            {!locked && options.length < POLL_MAX_OPTIONS && (
              <button
                type="button"
                onClick={addOption}
                className="mt-2 text-[12px] font-semibold text-terra hover:underline"
              >
                + Agregar opción
              </button>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {locked ? (
              <div className="text-[12px] text-muted">
                {poll?.allow_multiple ? "Se pueden elegir varias opciones." : "Una sola opción por persona."}{" "}
                {poll?.anonymous
                  ? "Encuesta anónima: nadie ve quién votó qué."
                  : "La Asamblea ve quién votó qué."}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <Checkbox
                  name="poll_allow_multiple"
                  label="Se pueden elegir varias opciones"
                  defaultChecked={poll?.allow_multiple ?? false}
                />
                <Checkbox
                  name="poll_anonymous"
                  label="Anónima: el voto se guarda sin el nombre de quien votó. Ni la Asamblea puede saberlo."
                  defaultChecked={poll?.anonymous ?? false}
                />
              </div>
            )}
            <Field
              label="Cierra el"
              name="poll_closes_on"
              hint="Opcional. Hasta el final de ese día. Después nadie puede votar y se ven los resultados finales."
            >
              <TextInput
                id="poll_closes_on"
                name="poll_closes_on"
                type="date"
                defaultValue={closesOn}
              />
            </Field>
          </div>

          <p className="text-[11.5px] text-muted">
            Cada persona vota una sola vez y no puede cambiar el voto. Los totales se
            muestran a quien ya votó y a todos al cierre; quién votó qué lo ve solo la
            Asamblea, y solo si la encuesta no es anónima.
          </p>
        </div>
      )}
    </div>
  );
}

function ReadOnly({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-bg px-3 py-2 text-[13px] text-dark">
      {children}
    </div>
  );
}

/** Instante → 'YYYY-MM-DD' del día civil de Montevideo (UTC-3, sin horario de verano). */
function toMontevideoDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}
