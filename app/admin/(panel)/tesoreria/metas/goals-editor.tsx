"use client";

import { useState } from "react";
import {
  Banner,
  Button,
  Card,
  Field,
  Select,
  TextArea,
  TextInput,
} from "@/components/admin/ui";
import {
  CADENCE_LABEL,
  CADENCE_OPTION_LABEL,
  fmtRound,
  type GoalCadence,
  type GoalDirection,
  type GoalStatus,
} from "@/lib/treasury-progress-content";
import {
  LedgerLinksPicker,
  type LedgerPickerOptions,
} from "@/components/admin/LedgerLinksPicker";

/**
 * Editor de las metas de la Asamblea.
 *
 * Todas las metas viven en un solo formulario con un solo botón de
 * guardar: son tres o cuatro, y abrir una pantalla por cada una para
 * cambiar un monto sería peor.
 *
 * Lo que hace que una meta sea medible son dos campos que conviene
 * entender antes de tocarlos:
 *
 *  · "Se mide por" — 'gasto' es para financiar algo (avanza cuando la
 *    Asamblea aplica plata a ese rubro) e 'ingreso' es para juntar algo
 *    (avanza cuando entra plata a ese fondo).
 *  · "Rubros del libro" — contra qué se mide, uno o varios (068): por
 *    fondos o por categorías y subcategorías, nunca mezclados. Sin esto,
 *    una meta con cifra no tiene con qué compararse y el tablero lo dice
 *    en vez de mostrar cero.
 *
 * Una meta sin monto es válida: "conseguir un POS propio" es una gestión
 * real y se informa por su etiqueta de estado.
 */

export type { LedgerPickerOptions };

export type GoalRowData = {
  uid: string;
  id: string;
  title: string;
  description: string;
  badge: string;
  target: string;
  currency: string;
  cadence: GoalCadence;
  direction: GoalDirection;
  status: GoalStatus;
  /** "fund:" / "cat:" / "sub:", varios (068). */
  ledgerRefs: string[];
  yearScope: string;
};

export function GoalsEditor({
  goals,
  options,
  bahaiYear,
  saveAction,
}: {
  goals: GoalRowData[];
  options: LedgerPickerOptions;
  bahaiYear: number | null;
  saveAction: (formData: FormData) => void;
}) {
  const [rows, setRows] = useState<GoalRowData[]>(goals);
  const [deleted, setDeleted] = useState<string[]>([]);
  // Contador propio para las claves de React: los uid tienen que ser
  // estables aunque se quiten filas del medio.
  const [nextUid, setNextUid] = useState(1);

  function add() {
    setNextUid((n) => n + 1);
    setRows((prev) => [
      ...prev,
      {
        uid: `new-${nextUid}`,
        id: "",
        title: "",
        description: "",
        badge: "",
        target: "",
        currency: "UYU",
        cadence: "anual",
        direction: "gasto",
        status: "activa",
        ledgerRefs: [],
        yearScope: bahaiYear ? String(bahaiYear) : "",
      },
    ]);
  }

  function update(uid: string, patch: Partial<GoalRowData>) {
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  }

  function remove(row: GoalRowData) {
    if (row.id && !window.confirm(`¿Borrar la meta "${row.title}"?`)) return;
    if (row.id) setDeleted((prev) => [...prev, row.id]);
    setRows((prev) => prev.filter((r) => r.uid !== row.uid));
  }

  return (
    <form action={saveAction}>
      <input type="hidden" name="deleted" value={deleted.join(",")} />

      <div className="mb-4">
        <Banner tone="info">
          Una meta con <strong>monto</strong> y <strong>rubro del libro</strong>{" "}
          muestra barra de progreso calculada. Una meta sin monto se informa
          como gestión en curso, con su etiqueta de estado. El campo{" "}
          <strong>«El monto es»</strong> dice cómo leer la cifra: por mes
          bahá'í (se acumula mes a mes), para todo el ejercicio, o un total
          sin plazo.
        </Banner>
      </div>

      {rows.length === 0 && (
        <Card className="mb-4">
          <p className="py-6 text-center text-[13px] text-muted">
            Todavía no hay metas cargadas. Agregá la primera: puede ser una
            cifra a sostener por mes o una gestión sin monto.
          </p>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {rows.map((row, index) => (
          <Card key={row.uid}>
            <input type="hidden" name="goal_id" value={row.id} />

            <div className="grid gap-4 md:grid-cols-[1fr,150px]">
              <Field label="Meta" name={`title_${row.uid}`} required>
                <TextInput
                  name="goal_title"
                  required
                  value={row.title}
                  onChange={(e) => update(row.uid, { title: e.target.value })}
                  placeholder="Cachimba del Piojo"
                />
              </Field>
              <Field label="Estado" name={`status_${row.uid}`}>
                <Select
                  name="goal_status"
                  value={row.status}
                  onChange={(e) =>
                    update(row.uid, { status: e.target.value as GoalStatus })
                  }
                >
                  <option value="activa">Activa</option>
                  <option value="lograda">Lograda</option>
                  <option value="archivada">Archivada</option>
                </Select>
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Detalle" name={`desc_${row.uid}`} hint="opcional">
                <TextArea
                  name="goal_description"
                  rows={2}
                  value={row.description}
                  onChange={(e) =>
                    update(row.uid, { description: e.target.value })
                  }
                  placeholder="Financiar el 100 % de las actividades del proyecto"
                />
              </Field>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <Field label="Monto" name={`target_${row.uid}`} hint="vacío = sin cifra">
                <TextInput
                  name="goal_target"
                  type="number"
                  min="0"
                  step="100"
                  value={row.target}
                  onChange={(e) => update(row.uid, { target: e.target.value })}
                  placeholder="3500"
                />
              </Field>
              <Field label="Moneda" name={`currency_${row.uid}`}>
                <Select
                  name="goal_currency"
                  value={row.currency}
                  onChange={(e) => update(row.uid, { currency: e.target.value })}
                >
                  <option value="UYU">Pesos (UYU)</option>
                  <option value="USD">Dólares (USD)</option>
                </Select>
              </Field>
              <Field label="El monto es" name={`cadence_${row.uid}`}>
                <Select
                  name="goal_cadence"
                  value={row.cadence}
                  onChange={(e) =>
                    update(row.uid, { cadence: e.target.value as GoalCadence })
                  }
                >
                  {(
                    Object.keys(CADENCE_OPTION_LABEL) as GoalCadence[]
                  ).map((c) => (
                    <option key={c} value={c}>
                      {CADENCE_OPTION_LABEL[c]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Se mide por" name={`direction_${row.uid}`}>
                <Select
                  name="goal_direction"
                  value={row.direction}
                  onChange={(e) =>
                    update(row.uid, {
                      direction: e.target.value as GoalDirection,
                    })
                  }
                >
                  <option value="gasto">Lo aplicado (financiar)</option>
                  <option value="ingreso">Lo recibido (juntar)</option>
                </Select>
              </Field>
            </div>

            {Number(row.target) > 0 && (
              <p className="mt-2 text-[11.5px] text-muted">
                {row.cadence === "mensual" ? (
                  <>
                    <strong>{fmtRound(Number(row.target), row.currency)}</strong>{" "}
                    {CADENCE_LABEL.mensual}: en los 19 meses del ejercicio son{" "}
                    <strong>{fmtRound(Number(row.target) * 19, row.currency)}</strong>.
                    El tablero compara contra lo acumulado hasta hoy, no contra
                    un mes suelto.
                  </>
                ) : row.cadence === "anual" ? (
                  <>
                    <strong>{fmtRound(Number(row.target), row.currency)}</strong>{" "}
                    {CADENCE_LABEL.anual}, de Riḍván a Riḍván. Por mes bahá'í
                    equivale a{" "}
                    <strong>{fmtRound(Number(row.target) / 19, row.currency)}</strong>.
                  </>
                ) : (
                  <>
                    <strong>{fmtRound(Number(row.target), row.currency)}</strong>{" "}
                    {CADENCE_LABEL.unica}: un total a alcanzar, sin plazo. Si
                    es de este ejercicio, indicalo abajo en «Ejercicio».
                  </>
                )}
              </p>
            )}

            <div className="mt-4 border-t border-black/[0.06] pt-3">
              {/* El índice de la fila ata cada rubro a su meta: los demás
                  campos viajan como arrays paralelos y una meta nueva
                  todavía no tiene id. */}
              <LedgerLinksPicker
                refs={row.ledgerRefs}
                onChange={(refs) => update(row.uid, { ledgerRefs: refs })}
                options={options}
                name="goal_link[]"
                prefix={String(index)}
                label="Rubros del libro"
                hint="contra qué se mide · uno o varios"
              />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[1fr,160px]">
              <Field
                label="Etiqueta"
                name={`badge_${row.uid}`}
                hint="para metas sin cifra"
              >
                <TextInput
                  name="goal_badge"
                  value={row.badge}
                  onChange={(e) => update(row.uid, { badge: e.target.value })}
                  placeholder="En averiguación"
                />
              </Field>
              <Field label="Ejercicio" name={`year_${row.uid}`} hint="vacío = permanente">
                <TextInput
                  name="goal_year"
                  type="number"
                  value={row.yearScope}
                  onChange={(e) => update(row.uid, { yearScope: e.target.value })}
                  placeholder={bahaiYear ? String(bahaiYear) : "183"}
                />
              </Field>
            </div>

            {row.target && row.ledgerRefs.length === 0 && (
              <p className="mt-3 text-[11.5px] italic text-muted">
                Esta meta tiene monto pero no rubro del libro: el tablero la va
                a mostrar como «falta indicar con qué se mide» en vez de
                dibujar una barra en cero.
              </p>
            )}

            <div className="mt-4 flex justify-end border-t border-black/[0.06] pt-3">
              <Button variant="danger" onClick={() => remove(row)}>
                Quitar meta
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <Button variant="secondary" onClick={add}>
          + Agregar meta
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="secondary" href="/admin/tesoreria/progreso">
            Ver el tablero
          </Button>
          <Button type="submit">Guardar metas</Button>
        </div>
      </div>
    </form>
  );
}
