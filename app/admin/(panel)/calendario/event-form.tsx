import {
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

export function EventForm({ event }: Props) {
  const date = event
    ? `${event.year}-${String(event.month).padStart(2, "0")}-${String(event.day).padStart(2, "0")}`
    : "";

  return (
    <form action={upsertEventAction} encType="multipart/form-data">
      {event && <input type="hidden" name="id" value={event.id} />}

      <Card>
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
