"use client";

import { useState } from "react";
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Field,
  Select,
  TextArea,
  TextInput,
} from "@/components/admin/ui";
import {
  AUDIENCE_HINT,
  AUDIENCE_LABEL,
  DESTINATION_TONES,
  NOTE_SECTIONS,
  fmtAmount,
  fmtDayMonth,
  type DestinationTone,
  type NoteKey,
  type ReportAudience,
  type ReportEditorial,
  type ReportSnapshot,
} from "@/lib/treasury-report-content";

/**
 * Editor del informe: los textos que el libro no puede saber.
 *
 * Las cifras se muestran acá solo como referencia (columna izquierda de
 * cada sección): son de solo lectura porque salen del libro y se
 * recalculan en cada guardado. Lo que se edita es el relato.
 */

type Props = {
  id: string;
  title: string;
  subtitle: string | null;
  audience: ReportAudience;
  periodFrom: string;
  periodTo: string;
  status: "draft" | "published";
  snapshot: ReportSnapshot;
  editorial: ReportEditorial;
  today: string;
  saveAction: (formData: FormData) => void;
};

/** Las secciones que existen en la hoja del acta; el resto de las notas
 *  solo tiene dónde aparecer en el deck de la comunidad. */
const SHEET_NOTES: readonly string[] = [
  "summary",
  "income",
  "expenses",
  "funds",
  "accounts",
  "budget",
];

type DestRow = {
  uid: string;
  label: string;
  badge: string;
  amount: string;
  tone: DestinationTone;
};

export function ReportEditor({
  id,
  title,
  subtitle,
  audience: initialAudience,
  periodFrom,
  periodTo,
  status,
  snapshot,
  editorial,
  today,
  saveAction,
}: Props) {
  const [rows, setRows] = useState<DestRow[]>(
    editorial.destination.map((d, i) => ({ uid: `d${i}`, ...d }))
  );
  const [audience, setAudience] = useState<ReportAudience>(initialAudience);
  // El deck de la comunidad y la hoja del acta no comparten secciones:
  // los gráficos, la meta destacada, el destino de los fondos y la cita
  // son del deck; las observaciones y la aprobación, de la hoja.
  const esInterno = audience === "internos";

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        uid: `new-${prev.length}-${prev.length + 1}`,
        label: "",
        badge: "",
        amount: "",
        tone: "gold",
      },
    ]);
  }

  function update(uid: string, patch: Partial<DestRow>) {
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  }

  function remove(uid: string) {
    setRows((prev) => prev.filter((r) => r.uid !== uid));
  }

  const goal = editorial.goal;

  return (
    <form action={saveAction}>
      <input type="hidden" name="id" value={id} />

      {/* ─── Portada y período ─────────────────────────────────── */}
      <Card className="mb-4">
        <h2 className="mb-4 font-display text-[20px] font-semibold text-dark">
          Destinatario, título y período
        </h2>
        <div className="mb-4">
          <Field
            label="Destinatario"
            name="audience"
            hint="define el formato y quién lo puede leer"
          >
            <Select
              id="audience"
              name="audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value as ReportAudience)}
            >
              {(Object.keys(AUDIENCE_LABEL) as ReportAudience[]).map((a) => (
                <option key={a} value={a}>
                  {AUDIENCE_LABEL[a]}
                </option>
              ))}
            </Select>
          </Field>
          <p className="mt-1 text-[11.5px] leading-snug text-muted">
            {AUDIENCE_HINT[audience]}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Título" name="title" required>
            <TextInput
              id="title"
              name="title"
              required
              defaultValue={title}
              placeholder="Fiesta de los Diecinueve Días"
            />
          </Field>
          <Field label="Subtítulo" name="subtitle" hint="opcional">
            <TextInput
              id="subtitle"
              name="subtitle"
              defaultValue={subtitle ?? ""}
              placeholder="Asmáʼ · «Nombres» · 183 E.B."
            />
          </Field>
          <Field label="Desde" name="period_from" required>
            <TextInput
              id="period_from"
              name="period_from"
              type="date"
              required
              max={today}
              defaultValue={periodFrom}
            />
          </Field>
          <Field label="Hasta" name="period_to" required>
            <TextInput
              id="period_to"
              name="period_to"
              type="date"
              required
              defaultValue={periodTo}
            />
          </Field>
        </div>
        <p className="mt-3 text-[11.5px] text-muted">
          Si cambiás las fechas, las cifras se vuelven a leer del libro al
          guardar.
        </p>
      </Card>

      {/* ─── Cifras calculadas ─────────────────────────────────── */}
      <Card className="mb-4">
        <h2 className="mb-1 font-display text-[20px] font-semibold text-dark">
          Cifras del período
        </h2>
        <p className="mb-4 text-[12px] text-muted">
          Salen del libro y se recalculan cada vez que guardás (o con el botón
          «Recalcular cifras», al pie). No se editan
          acá: si algo no cuadra, se corrige el movimiento en el libro.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Figure
            label="Contribuciones"
            value={snapshot.income
              .map((m) => `${fmtAmount(m.amount, m.currency)} ${m.currency}`)
              .join(" · ")}
            meta={`${snapshot.incomeCount} aportes${
              snapshot.receiptFrom
                ? ` · recibos ${snapshot.receiptFrom}–${snapshot.receiptTo}`
                : ""
            }`}
          />
          <Figure
            label="Egresos"
            value={
              snapshot.expenses
                .map((m) => `${fmtAmount(m.amount, m.currency)} ${m.currency}`)
                .join(" · ") || "sin egresos"
            }
            meta={`${snapshot.expenseLines.length} movimientos`}
          />
          <Figure
            label="Resultado"
            value={snapshot.result
              .map(
                (m) =>
                  `${m.amount >= 0 ? "+" : "−"}${fmtAmount(
                    Math.abs(m.amount),
                    m.currency
                  )} ${m.currency}`
              )
              .join(" · ")}
            meta={`${fmtDayMonth(snapshot.from)} al ${fmtDayMonth(snapshot.to)}`}
          />
        </div>

        {/* Los saldos por fondo con sus montos: es la única forma de ver,
            sin abrir la hoja o el deck, que el recálculo tomó la fecha de
            cierre nueva. Un saldo es acumulado desde el principio del
            libro, así que cambiar "Desde" no lo mueve; "Hasta" sí. */}
        <div className="mt-2 rounded-xl border border-black/[0.06] bg-bg/40 px-3.5 py-3">
          <div className="text-[10.5px] font-bold uppercase tracking-wide text-muted">
            Saldos por fondo al {fmtDayMonth(snapshot.to)}
          </div>
          {snapshot.byFund.length === 0 ? (
            <div className="mt-0.5 text-[15px] font-semibold text-dark">—</div>
          ) : (
            <ul className="mt-1.5 divide-y divide-black/[0.05]">
              {snapshot.byFund.map((row) => (
                <li
                  key={`${row.label}|${row.currency}`}
                  className="flex items-baseline justify-between gap-3 py-1 text-[13.5px]"
                >
                  <span className="text-dark">{row.label}</span>
                  <span className="shrink-0 tabular-nums font-semibold text-dark">
                    {fmtAmount(row.amount, row.currency)}{" "}
                    <span className="text-[11px] font-medium text-muted">
                      {row.currency}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-1.5 text-[11.5px] text-muted">
            Acumulados desde el inicio del libro hasta la fecha de cierre; la
            fecha de inicio no los cambia. {snapshot.byAccount.length} filas
            de cuenta ·{" "}
            {snapshot.internalTransfers > 0
              ? `${snapshot.internalTransfers} operaciones internas excluidas`
              : "sin operaciones internas en el período"}
            .
          </div>
        </div>

        {/* Los gráficos son del deck; la hoja del acta va sin ninguno.
            Los inputs siguen en el DOM para no perder la preferencia del
            deck si el informe vuelve a ser de la comunidad. */}
        <div
          className={`mt-4 flex flex-col gap-2.5 border-t border-black/[0.06] pt-4 ${
            esInterno ? "hidden" : ""
          }`}
        >
          <Checkbox
            name="show_contributions"
            label="Mostrar el gráfico de aportes por mes"
            defaultChecked={editorial.showContributionsChart}
          />
          <Checkbox
            name="show_local_fund"
            label={`Mostrar el gráfico del saldo del ${
              snapshot.localFund?.name ?? "Fondo Local"
            }`}
            defaultChecked={editorial.showLocalFundChart}
          />
          <Checkbox
            name="show_budget"
            label="Mostrar presupuesto vs. ejecutado"
            defaultChecked={editorial.showBudget}
          />
        </div>

        {esInterno && (
          <p className="mt-4 border-t border-black/[0.06] pt-4 text-[12px] text-muted">
            La hoja para el acta va sin gráficos: los ingresos y los egresos se
            informan como totales por rubro, más la conciliación de fondos
            contra cuentas y las transferencias internas del período.
          </p>
        )}

        {!esInterno && editorial.showBudget && !snapshot.budget && (
          <div className="mt-4">
            <Banner tone="info">
              No hay presupuesto cargado para este año bahá'í, así que esa
              sección no va a aparecer.
            </Banner>
          </div>
        )}
        {snapshot.budget && snapshot.budget.lines.some((l) => !l.linked) && (
          <div className="mt-4">
            <Banner tone="info">
              Hay líneas del presupuesto sin categoría del libro vinculada
              (
              {snapshot.budget.lines
                .filter((l) => !l.linked)
                .map((l) => l.category)
                .join(", ")}
              ). Vinculalas en{" "}
              <a
                href="/admin/tesoreria/presupuesto"
                className="font-semibold text-terra underline"
              >
                Plan de Presupuesto
              </a>{" "}
              para que tengan ejecutado.
            </Banner>
          </div>
        )}
      </Card>

      {/* ─── Notas por sección ─────────────────────────────────── */}
      <Card className="mb-4">
        <h2 className="mb-1 font-display text-[20px] font-semibold text-dark">
          Notas al pie
        </h2>
        <p className="mb-4 text-[12px] text-muted">
          Una por sección, todas opcionales. Acá va lo que los números no
          cuentan: por qué se hizo un gasto, qué se está gestionando, a quién
          agradecer.
        </p>
        <div className="grid gap-4">
          {NOTE_SECTIONS.map((section) => (
            <div
              key={section.key}
              // Las notas de los gráficos y del destino de los fondos no
              // tienen sección donde aparecer en la hoja del acta. El
              // input se oculta pero sigue enviándose, así que el texto
              // no se pierde si el informe vuelve a ser de la comunidad.
              className={
                esInterno && !SHEET_NOTES.includes(section.key) ? "hidden" : ""
              }
            >
              <Field
                label={section.label}
                name={`note_${section.key}`}
                hint="opcional"
              >
                <TextArea
                  id={`note_${section.key}`}
                  name={`note_${section.key}`}
                  rows={2}
                  defaultValue={editorial.notes[section.key as NoteKey] ?? ""}
                />
              </Field>
            </div>
          ))}
        </div>
      </Card>

      {/* ─── Solo hoja interna: observaciones y aprobación ──────── */}
      {esInterno && (
        <Card className="mb-4">
          <h2 className="mb-1 font-display text-[20px] font-semibold text-dark">
            Observaciones y aprobación
          </h2>
          <p className="mb-4 text-[12px] text-muted">
            Lo que la Asamblea tiene que saber para aprobar: qué quedó en
            gestión, qué falta documentar, qué necesita decisión.
          </p>
          <Field label="Observaciones y pendientes" name="observations" hint="opcional">
            <TextArea
              id="observations"
              name="observations"
              rows={4}
              defaultValue={editorial.observations}
              placeholder="Los materiales de la puerta siguen en gestión de devolución…"
            />
          </Field>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field
              label="Aprobado en la reunión del"
              name="approval_meeting_date"
              hint="se completa después de aprobarlo"
            >
              <TextInput
                id="approval_meeting_date"
                name="approval_meeting_date"
                defaultValue={editorial.approval?.meetingDate ?? ""}
                placeholder="23 de agosto de 2026"
              />
            </Field>
            <Field label="Acta N.º" name="approval_acta_number" hint="opcional">
              <TextInput
                id="approval_acta_number"
                name="approval_acta_number"
                defaultValue={editorial.approval?.actaNumber ?? ""}
                placeholder="47"
              />
            </Field>
          </div>
          <p className="mt-3 text-[11.5px] text-muted">
            Si los dejás vacíos, la hoja imprime líneas de puntos para
            completar a mano en la reunión.
          </p>
        </Card>
      )}

      {/* ─── Meta de la Asamblea (solo deck) ───────────────────── */}
      <Card className={`mb-4 ${esInterno ? "hidden" : ""}`}>
        <h2 className="mb-1 font-display text-[20px] font-semibold text-dark">
          Meta de la Asamblea
        </h2>
        <p className="mb-4 text-[12px] text-muted">
          Una sola meta destacada, con sus cifras escritas a mano (son
          objetivos, no saldos). Si dejás el título vacío, la sección no
          aparece.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Título" name="goal_title" hint="ej. Cachimba del Piojo">
            <TextInput
              id="goal_title"
              name="goal_title"
              defaultValue={goal?.title ?? ""}
            />
          </Field>
          <Field label="Bajada" name="goal_subtitle" hint="opcional">
            <TextInput
              id="goal_subtitle"
              name="goal_subtitle"
              defaultValue={goal?.subtitle ?? ""}
              placeholder="Financiar el 100 % de las actividades"
            />
          </Field>
          <Field label="Meta mensual" name="goal_monthly" hint="texto libre">
            <TextInput
              id="goal_monthly"
              name="goal_monthly"
              defaultValue={goal?.monthly ?? ""}
              placeholder="$ 3.500"
            />
          </Field>
          <Field label="Meta anual" name="goal_annual" hint="texto libre">
            <TextInput
              id="goal_annual"
              name="goal_annual"
              defaultValue={goal?.annual ?? ""}
              placeholder="$ 42.000"
            />
          </Field>
          <Field label="Cubierto" name="goal_covered" hint="texto libre">
            <TextInput
              id="goal_covered"
              name="goal_covered"
              defaultValue={goal?.covered ?? ""}
              placeholder="≈ 23 %"
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Nota de la meta" name="goal_note" hint="opcional">
            <TextArea
              id="goal_note"
              name="goal_note"
              rows={2}
              defaultValue={goal?.note ?? ""}
            />
          </Field>
        </div>
      </Card>

      {/* ─── Destino de los Fondos (solo deck) ─────────────────── */}
      <Card className={`mb-4 ${esInterno ? "hidden" : ""}`}>
        <div className="mb-1 flex items-start justify-between gap-3">
          <h2 className="font-display text-[20px] font-semibold text-dark">
            Destino de los Fondos
          </h2>
          <Button variant="secondary" onClick={addRow}>
            + Agregar línea
          </Button>
        </div>
        <p className="mb-4 text-[12px] text-muted">
          Los proyectos e iniciativas en curso. El monto es texto libre: puede
          decir «$ 3.500 / mes» o «en estudio».
        </p>

        {rows.length === 0 && (
          <p className="rounded-xl border border-dashed border-black/15 bg-bg/40 p-5 text-center text-[13px] text-muted">
            Sin líneas. Si no agregás ninguna, la sección no aparece en el
            informe.
          </p>
        )}

        <div className="grid gap-3">
          {rows.map((row) => (
            <div
              key={row.uid}
              className="grid gap-2 rounded-xl border border-black/[0.06] bg-bg/30 p-3 md:grid-cols-[1fr,150px,120px,140px,auto]"
            >
              <TextInput
                name="dest_label"
                value={row.label}
                onChange={(e) => update(row.uid, { label: e.target.value })}
                placeholder="Cachimba del Piojo · financiación del 100 %"
              />
              <TextInput
                name="dest_badge"
                value={row.badge}
                onChange={(e) => update(row.uid, { badge: e.target.value })}
                placeholder="Meta AEL"
              />
              <TextInput
                name="dest_amount"
                value={row.amount}
                onChange={(e) => update(row.uid, { amount: e.target.value })}
                placeholder="$ 3.500 / mes"
              />
              <Select
                name="dest_tone"
                value={row.tone}
                onChange={(e) =>
                  update(row.uid, { tone: e.target.value as DestinationTone })
                }
              >
                {DESTINATION_TONES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </Select>
              <Button
                variant="danger"
                onClick={() => remove(row.uid)}
                className="justify-center"
              >
                Quitar
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* ─── Cierre ────────────────────────────────────────────── */}
      {/* La cita es del deck; la firma la usan los dos formatos (en la
          hoja va sobre la línea de firma del tesorero). */}
      <Card className="mb-4">
        <h2 className="mb-4 font-display text-[20px] font-semibold text-dark">
          {esInterno ? "Firma" : "Cierre"}
        </h2>
        <div className="grid gap-4">
          <div className={esInterno ? "hidden" : ""}>
            <Field label="Cita" name="quote_text" hint="opcional">
              <TextArea
                id="quote_text"
                name="quote_text"
                rows={2}
                defaultValue={editorial.quote?.text ?? ""}
              />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className={esInterno ? "hidden" : ""}>
              <Field label="Fuente de la cita" name="quote_source">
                <TextInput
                  id="quote_source"
                  name="quote_source"
                  defaultValue={editorial.quote?.source ?? ""}
                  placeholder="Bahá'u'lláh · Palabras Ocultas"
                />
              </Field>
            </div>
            <Field label="Firma" name="signature_name">
              <TextInput
                id="signature_name"
                name="signature_name"
                defaultValue={editorial.signature?.name ?? ""}
              />
            </Field>
            <Field label="Cargo" name="signature_role">
              <TextInput
                id="signature_role"
                name="signature_role"
                defaultValue={editorial.signature?.role ?? ""}
                placeholder="Tesorero de la Asamblea"
              />
            </Field>
          </div>
        </div>
      </Card>

      {/* ─── Acciones ──────────────────────────────────────────── */}
      {/* Botones nativos y no <Button>: necesitan name/value para que el
          server action sepa si se guarda, se publica o se despublica. */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" href={`/admin/informe/${id}`}>
          Ver informe
        </Button>
        {/* Hace lo mismo que guardar (todo guardado relee el libro), pero
            con el nombre queda claro que es el camino para refrescar las
            cifras tras cargar movimientos o cambiar las fechas. A
            diferencia de "Guardar borrador", no toca el estado: un informe
            publicado sigue publicado. */}
        <button
          type="submit"
          name="intent"
          value="recalc"
          title="Vuelve a leer el libro hasta la fecha de cierre y guarda las cifras nuevas"
          className="tap inline-flex items-center justify-center rounded-xl border border-black/10 bg-card px-4 py-2.5 text-[13px] font-semibold text-dark transition hover:bg-bg"
        >
          Recalcular cifras
        </button>
        <button
          type="submit"
          name="intent"
          value="draft"
          className="tap inline-flex items-center justify-center rounded-xl border border-black/10 bg-card px-4 py-2.5 text-[13px] font-semibold text-dark transition hover:bg-bg"
        >
          Guardar borrador
        </button>
        {status === "published" && (
          <button
            type="submit"
            name="intent"
            value="unpublish"
            onClick={(ev) => {
              if (
                !window.confirm(
                  "El informe volverá a borrador y el link compartido dejará de funcionar. ¿Continuar?"
                )
              ) {
                ev.preventDefault();
              }
            }}
            className="tap inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[13px] font-semibold text-rose-700 transition hover:bg-rose-100"
          >
            Despublicar
          </button>
        )}
        <button
          type="submit"
          name="intent"
          value="publish"
          className="tap inline-flex items-center justify-center rounded-xl bg-terra px-4 py-2.5 text-[13px] font-semibold text-white shadow-card-soft transition hover:bg-terra-light"
        >
          {status === "published" ? "Guardar y republicar" : "Publicar"}
        </button>
      </div>
    </form>
  );
}

function Figure({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-bg/40 px-3.5 py-3">
      <div className="text-[10.5px] font-bold uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className="mt-0.5 tabular-nums text-[15px] font-semibold text-dark">
        {value || "—"}
      </div>
      <div className="mt-0.5 text-[11.5px] text-muted">{meta}</div>
    </div>
  );
}
