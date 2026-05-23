import {
  Banner,
  Button,
  Card,
  Field,
  Select,
  TextArea,
  TextInput,
} from "@/components/admin/ui";
import { upsertEventAction } from "./actions";
import type { CalendarEvent } from "@/lib/types";

type Props = { event?: CalendarEvent };

const COLORS = [
  { value: "#2A3F8F", label: "Terra (azul)" },
  { value: "#7E44B8", label: "Amber (morado)" },
  { value: "#6A8B5F", label: "Verde" },
  { value: "#C4A235", label: "Dorado" },
];

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function EventForm({ event }: Props) {
  const date = event
    ? `${event.year}-${String(event.month).padStart(2, "0")}-${String(event.day).padStart(2, "0")}`
    : "";

  const isProtected = event?.is_system_seeded === true;
  const officialDateLabel = event?.official_date
    ? formatLongDate(event.official_date)
    : null;
  const celebrationDateLabel =
    event && date ? formatLongDate(date) : null;

  return (
    <form action={upsertEventAction} encType="multipart/form-data">
      {event && <input type="hidden" name="id" value={event.id} />}

      {isProtected && (
        <div className="mb-5">
          <Banner tone="info">
            <strong>Este es un Día Sagrado oficial.</strong> El nombre y la
            fecha están definidos por el calendario bahá'í y no se pueden
            modificar. Sí podés editar la hora, el lugar, la descripción, la
            imagen de invitación y la duración.
          </Banner>
        </div>
      )}

      <Card>
        {isProtected ? (
          <div className="mb-4 grid gap-3 rounded-xl border border-black/[0.06] bg-bg/40 p-4 md:grid-cols-2">
            <div>
              <div className="text-[10.5px] uppercase tracking-wide text-muted">
                Día Sagrado
              </div>
              <div className="font-display text-[18px] font-semibold text-dark">
                {event?.title}
              </div>
            </div>
            {officialDateLabel && (
              <div>
                <div className="text-[10.5px] uppercase tracking-wide text-muted">
                  Fecha oficial
                </div>
                <div className="text-[13px] text-dark">{officialDateLabel}</div>
                {celebrationDateLabel &&
                  event?.official_date !== date && (
                    <div className="mt-1 text-[10.5px] uppercase tracking-wide text-terra">
                      Celebración
                    </div>
                  )}
                {celebrationDateLabel &&
                  event?.official_date !== date && (
                    <div className="text-[12.5px] font-semibold text-terra">
                      {celebrationDateLabel}
                    </div>
                  )}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Fecha" name="date" required>
                <TextInput
                  id="date"
                  name="date"
                  type="date"
                  required
                  defaultValue={date}
                />
              </Field>
              <Field label="Hora" name="time" hint='Texto libre (ej. "7:00 PM")'>
                <TextInput
                  id="time"
                  name="time"
                  defaultValue={event?.time ?? "7:00 PM"}
                  placeholder="7:00 PM"
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Título" name="title" required>
                <TextInput
                  id="title"
                  name="title"
                  required
                  defaultValue={event?.title ?? ""}
                  placeholder="Círculo de Estudio"
                />
              </Field>
            </div>
          </>
        )}

        {isProtected && (
          <Field label="Hora" name="time" hint='Texto libre (ej. "7:00 PM" o "Al atardecer")'>
            <TextInput
              id="time"
              name="time"
              defaultValue={event?.time ?? ""}
              placeholder="Al atardecer"
            />
          </Field>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Ubicación" name="location" hint="Aparece en el .ics">
            <TextInput
              id="location"
              name="location"
              defaultValue={event?.location ?? ""}
              placeholder="Casa Rodríguez"
            />
          </Field>
          <Field
            label="Duración (minutos)"
            name="duration_minutes"
            hint="Usado para el calendario descargable"
          >
            <TextInput
              id="duration_minutes"
              name="duration_minutes"
              type="number"
              min={5}
              max={720}
              defaultValue={event?.duration_minutes ?? 60}
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Color" name="color">
            <Select id="color" name="color" defaultValue={event?.color ?? "#2A3F8F"}>
              {COLORS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="mt-4">
          <Field
            label="Descripción"
            name="description"
            hint="Cuerpo del evento — se muestra en la página de detalle"
          >
            <TextArea
              id="description"
              name="description"
              rows={5}
              defaultValue={event?.description ?? ""}
              placeholder="Detalles del evento, qué traer, qué esperar..."
            />
          </Field>
        </div>
      </Card>

      <Card className="mt-5">
        <h2 className="mb-1 font-display text-[18px] font-semibold text-dark">
          Imagen de invitación
        </h2>
        <p className="mb-4 text-[12px] text-muted">
          Opcional. Se muestra arriba de la página del evento.
        </p>
        <ImageSlot currentUrl={event?.image_url ?? null} />
      </Card>

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="secondary" href="/admin/calendario">
          Cancelar
        </Button>
        <Button type="submit">{event ? "Guardar" : "Crear evento"}</Button>
      </div>
    </form>
  );
}

function formatLongDate(iso: string): string {
  const [yStr, mStr, dStr] = iso.split("-");
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const d = parseInt(dStr, 10);
  if (!y || !m || !d) return iso;
  return `${d} de ${MONTHS_ES[m - 1]} de ${y}`;
}

function ImageSlot({ currentUrl }: { currentUrl: string | null }) {
  return (
    <div>
      {currentUrl && (
        <div className="mb-2 rounded-lg border border-black/[0.06] bg-bg p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentUrl}
            alt="Invitación actual"
            className="max-h-48 w-full rounded object-contain"
          />
          <label className="mt-2 flex items-center gap-2 text-[11px] text-muted">
            <input type="checkbox" name="image_remove" className="h-3.5 w-3.5" />
            <span>Quitar esta imagen al guardar</span>
          </label>
        </div>
      )}
      <input
        type="file"
        name="image_file"
        accept="image/*"
        className="block w-full cursor-pointer rounded-xl border border-dashed border-black/15 bg-bg/40 px-3 py-2.5 text-[12px] text-muted file:mr-3 file:rounded file:border-0 file:bg-terra file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-white hover:bg-bg/70"
      />
      <p className="mt-1 text-[10px] text-muted">
        {currentUrl ? "Subir una nueva reemplaza la actual." : "Máximo 10MB."}
      </p>
    </div>
  );
}
