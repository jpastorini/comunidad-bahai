import {
  Button,
  Card,
  Field,
  Select,
  TextArea,
  TextInput,
} from "@/components/admin/ui";
import { upsertActivityAction } from "./actions";
import type { Activity } from "@/lib/types";

type Props = { activity?: Activity };

const TYPES = [
  { value: "estudio", label: "Estudio" },
  { value: "devocional", label: "Devocional" },
  { value: "ninos", label: "Clases de niños" },
  { value: "jovenes", label: "Jóvenes / prejuniors" },
];

export function ActivityForm({ activity }: Props) {
  const startsAt = activity ? new Date(activity.starts_at) : null;
  const date = startsAt ? toISODate(startsAt) : "";
  const time = startsAt ? toTime(startsAt) : "";

  return (
    <form action={upsertActivityAction}>
      {activity && <input type="hidden" name="id" value={activity.id} />}
      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Tipo" name="type" required>
            <Select
              id="type"
              name="type"
              required
              defaultValue={activity?.type ?? "estudio"}
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Lugar" name="place" required>
            <TextInput
              id="place"
              name="place"
              required
              defaultValue={activity?.place ?? ""}
              placeholder="Casa Rodríguez"
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Título" name="title" required>
            <TextInput
              id="title"
              name="title"
              required
              defaultValue={activity?.title ?? ""}
              placeholder="Círculo de Estudio"
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Detalle" name="detail">
            <TextArea
              id="detail"
              name="detail"
              rows={2}
              defaultValue={activity?.detail ?? ""}
              placeholder="Libro 7, Unidad 2"
            />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Fecha" name="date" required>
            <TextInput
              id="date"
              name="date"
              type="date"
              required
              defaultValue={date}
            />
          </Field>
          <Field label="Hora" name="time">
            <TextInput id="time" name="time" type="time" defaultValue={time} />
          </Field>
        </div>
      </Card>

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="secondary" href="/admin/actividades">
          Cancelar
        </Button>
        <Button type="submit">{activity ? "Guardar" : "Crear actividad"}</Button>
      </div>
    </form>
  );
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toTime(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function pad(n: number) {
  return n.toString().padStart(2, "0");
}
