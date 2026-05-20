"use client";

import {
  Button,
  Card,
  Field,
  Select,
  TextArea,
  TextInput,
} from "@/components/admin/ui";
import { BAHAI_MONTHS, approximateBahaiYear } from "@/lib/bahai-calendar";
import type { Feast, FeastLocation, FeastPrayer } from "@/lib/types";
import { upsertFeastAction } from "./actions";

type Props = {
  feast?: Feast;
  locations?: FeastLocation[];
  prayers?: FeastPrayer[];
};

export function FeastForm({ feast, locations = [], prayers = [] }: Props) {
  const defaultYear = approximateBahaiYear(new Date().getFullYear());

  // Add 2 empty location rows so admin can add new ones inline.
  const locationsWithEmpties: (Partial<FeastLocation> & { _new?: boolean })[] = [
    ...locations,
    { _new: true },
    { _new: true },
  ];
  const prayersWithEmpties: (Partial<FeastPrayer> & { _new?: boolean })[] = [
    ...prayers,
    { _new: true },
  ];

  return (
    <form action={upsertFeastAction} encType="multipart/form-data">
      {feast && <input type="hidden" name="id" value={feast.id} />}

      {/* ─── Info básica ─── */}
      <Card>
        <h2 className="mb-4 font-display text-[20px] font-semibold text-dark">
          Identidad de la Fiesta
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Mes bahá'í" name="bahai_month_index" required>
            <Select
              id="bahai_month_index"
              name="bahai_month_index"
              required
              defaultValue={feast?.bahai_month_index ?? 1}
            >
              {BAHAI_MONTHS.map((m) => (
                <option key={m.index} value={m.index}>
                  {m.index}. {m.name} ({m.meaning})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Año bahá'í" name="bahai_year" required hint="183 = 2026 gregoriano">
            <TextInput
              id="bahai_year"
              name="bahai_year"
              type="number"
              min={150}
              max={250}
              required
              defaultValue={feast?.bahai_year ?? defaultYear}
            />
          </Field>
        </div>
      </Card>

      {/* ─── Lugares ─── */}
      <Card className="mt-5">
        <h2 className="mb-1 font-display text-[20px] font-semibold text-dark">
          Lugares de celebración
        </h2>
        <p className="mb-4 text-[12px] text-muted">
          Una Fiesta puede celebrarse en varios lugares en distintas fechas.
          Las filas vacías se ignoran al guardar.
        </p>
        <div className="flex flex-col gap-4">
          {locationsWithEmpties.map((loc, i) => (
            <LocationRow key={loc.id ?? `new-${i}`} location={loc} />
          ))}
        </div>
      </Card>

      {/* ─── Programa: Oraciones ─── */}
      <Card className="mt-5">
        <h2 className="mb-1 font-display text-[20px] font-semibold text-dark">
          Oraciones
        </h2>
        <p className="mb-4 text-[12px] text-muted">
          Lista ordenada de oraciones para la parte devocional.
        </p>
        <div className="flex flex-col gap-4">
          {prayersWithEmpties.map((p, i) => (
            <PrayerRow key={p.id ?? `new-${i}`} prayer={p} index={i + 1} />
          ))}
        </div>
      </Card>

      {/* ─── Profundización ─── */}
      <Card className="mt-5">
        <h2 className="mb-4 font-display text-[20px] font-semibold text-dark">
          Profundización
        </h2>
        <Field label="Tema" name="deepening_theme">
          <TextInput
            id="deepening_theme"
            name="deepening_theme"
            defaultValue={feast?.deepening_theme ?? ""}
            placeholder="La Fiesta de los Diecinueve Días — corazón de la vida comunitaria"
          />
        </Field>
        <div className="mt-4">
          <Field label="Contenido / texto a estudiar" name="deepening_content">
            <TextArea
              id="deepening_content"
              name="deepening_content"
              rows={6}
              defaultValue={feast?.deepening_content ?? ""}
              placeholder="Cita de los Escritos, párrafo a reflexionar, preguntas guía..."
            />
          </Field>
        </div>
      </Card>

      {/* ─── Informes ─── */}
      <Card className="mt-5">
        <h2 className="mb-4 font-display text-[20px] font-semibold text-dark">
          Informes
        </h2>
        <Field label="Internacionales" name="international_reports" hint="Resumen de news.bahai.org">
          <TextArea
            id="international_reports"
            name="international_reports"
            rows={5}
            defaultValue={feast?.international_reports ?? ""}
          />
        </Field>
        <div className="mt-4">
          <Field label="Nacionales" name="national_reports">
            <TextArea
              id="national_reports"
              name="national_reports"
              rows={4}
              defaultValue={feast?.national_reports ?? ""}
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Locales" name="local_reports">
            <TextArea
              id="local_reports"
              name="local_reports"
              rows={5}
              defaultValue={feast?.local_reports ?? ""}
            />
          </Field>
        </div>
      </Card>

      {/* ─── Comunicado ─── */}
      <Card className="mt-5">
        <h2 className="mb-4 font-display text-[20px] font-semibold text-dark">
          Comunicado de la Asamblea
        </h2>
        <Field label="Mensaje a la comunidad" name="assembly_communique">
          <TextArea
            id="assembly_communique"
            name="assembly_communique"
            rows={5}
            defaultValue={feast?.assembly_communique ?? ""}
            placeholder="Mensaje opcional de la Asamblea Local a la comunidad."
          />
        </Field>
      </Card>

      {/* ─── Tesorería ─── */}
      <Card className="mt-5">
        <h2 className="mb-1 font-display text-[20px] font-semibold text-dark">
          Tesorería del mes
        </h2>
        <p className="mb-4 text-[12px] text-muted">
          Fondo Local — todos los montos son opcionales.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Ingresos del mes" name="treasury_income">
            <TextInput
              id="treasury_income"
              name="treasury_income"
              type="number"
              step="1"
              defaultValue={feast?.treasury_income ?? ""}
            />
          </Field>
          <Field label="Egresos del mes" name="treasury_expenses">
            <TextInput
              id="treasury_expenses"
              name="treasury_expenses"
              type="number"
              step="1"
              defaultValue={feast?.treasury_expenses ?? ""}
            />
          </Field>
          <Field label="Estado final" name="treasury_final">
            <TextInput
              id="treasury_final"
              name="treasury_final"
              type="number"
              step="1"
              defaultValue={feast?.treasury_final ?? ""}
            />
          </Field>
        </div>
        <div className="mt-4">
          <div className="mb-1.5 text-[12px] font-semibold text-dark">
            PDF de tesorería (opcional)
          </div>
          {feast?.treasury_pdf_url && (
            <div className="mb-2 rounded-lg border border-black/[0.06] bg-bg p-2.5">
              <a
                href={feast.treasury_pdf_url}
                target="_blank"
                rel="noopener"
                className="text-[12px] font-medium text-terra hover:underline"
              >
                Ver PDF actual
              </a>
              <label className="mt-2 flex items-center gap-2 text-[11px] text-muted">
                <input
                  type="checkbox"
                  name="treasury_pdf_remove"
                  className="h-3.5 w-3.5"
                />
                <span>Quitar al guardar</span>
              </label>
            </div>
          )}
          <input
            type="file"
            name="treasury_pdf_file"
            accept="application/pdf"
            className="block w-full cursor-pointer rounded-xl border border-dashed border-black/15 bg-bg/40 px-3 py-2.5 text-[12px] text-muted file:mr-3 file:rounded file:border-0 file:bg-terra file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-white hover:bg-bg/70"
          />
        </div>
      </Card>

      <div className="mt-6 flex items-center justify-end gap-2">
        <Button variant="secondary" href="/admin/fiestas">
          Cancelar
        </Button>
        <Button type="submit">{feast ? "Guardar cambios" : "Crear Fiesta"}</Button>
      </div>
    </form>
  );
}

function LocationRow({ location }: { location: Partial<FeastLocation> & { _new?: boolean } }) {
  const dt = location.starts_at ? new Date(location.starts_at) : null;
  const date = dt ? dt.toISOString().slice(0, 10) : "";
  const time = dt
    ? `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`
    : "19:00";

  return (
    <div className="rounded-xl border border-black/[0.06] bg-bg/40 p-3">
      <input type="hidden" name="location_id[]" value={location.id ?? ""} />
      <input type="hidden" name="location_remove[]" value="0" />
      <div className="grid gap-3 md:grid-cols-[1.4fr,1fr]">
        <Field label="Nombre del lugar" name="location_name[]">
          <TextInput
            name="location_name[]"
            defaultValue={location.name ?? ""}
            placeholder="Casa García"
          />
        </Field>
        <Field label="Dirección" name="location_address[]">
          <TextInput
            name="location_address[]"
            defaultValue={location.address ?? ""}
            placeholder="Av. Principal 1234"
          />
        </Field>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr,1fr,1.5fr]">
        <Field label="Fecha" name="location_date[]">
          <TextInput
            name="location_date[]"
            type="date"
            defaultValue={date}
          />
        </Field>
        <Field label="Hora" name="location_time[]">
          <TextInput
            name="location_time[]"
            type="time"
            defaultValue={time}
          />
        </Field>
        <Field label="Notas" name="location_notes[]">
          <TextInput
            name="location_notes[]"
            defaultValue={location.notes ?? ""}
            placeholder="Ej. 'Devocional con música'"
          />
        </Field>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[160px,1fr]">
        <Field
          label="Participantes"
          name="location_participants[]"
          hint="Se registra después de la Fiesta"
        >
          <TextInput
            name="location_participants[]"
            type="number"
            min={0}
            defaultValue={
              location.participant_count != null ? location.participant_count : ""
            }
            placeholder="—"
          />
        </Field>
      </div>
      {location.id && (
        <label className="mt-2 inline-flex items-center gap-2 text-[11px] text-rose-600">
          <input
            type="checkbox"
            name="location_remove[]"
            value="1"
            className="h-3.5 w-3.5"
            onChange={(e) => {
              const prev = e.currentTarget.previousElementSibling as HTMLInputElement;
              if (prev) prev.value = e.currentTarget.checked ? "1" : "0";
            }}
          />
          <span>Eliminar este lugar al guardar</span>
        </label>
      )}
    </div>
  );
}

function PrayerRow({
  prayer,
  index,
}: {
  prayer: Partial<FeastPrayer> & { _new?: boolean };
  index: number;
}) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-bg/40 p-3">
      <input type="hidden" name="prayer_id[]" value={prayer.id ?? ""} />
      <input type="hidden" name="prayer_remove[]" value="0" />
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
        #{index}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Título (opcional)" name="prayer_title[]">
          <TextInput
            name="prayer_title[]"
            defaultValue={prayer.title ?? ""}
            placeholder="Oración por la unidad"
          />
        </Field>
        <Field label="Referencia" name="prayer_reference[]">
          <TextInput
            name="prayer_reference[]"
            defaultValue={prayer.reference ?? ""}
            placeholder="Bahá'u'lláh"
          />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Texto" name="prayer_body[]">
          <TextArea
            name="prayer_body[]"
            rows={4}
            defaultValue={prayer.body ?? ""}
            placeholder="Texto de la oración..."
          />
        </Field>
      </div>
      {prayer.id && (
        <label className="mt-2 inline-flex items-center gap-2 text-[11px] text-rose-600">
          <input
            type="checkbox"
            name="prayer_remove[]"
            value="1"
            className="h-3.5 w-3.5"
            onChange={(e) => {
              const prev = e.currentTarget.previousElementSibling as HTMLInputElement;
              if (prev) prev.value = e.currentTarget.checked ? "1" : "0";
            }}
          />
          <span>Eliminar esta oración al guardar</span>
        </label>
      )}
    </div>
  );
}
