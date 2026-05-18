import {
  Button,
  Card,
  Field,
  Select,
  TextArea,
  TextInput,
} from "@/components/admin/ui";
import { upsertNeedAction } from "./actions";
import type { ServiceNeed } from "@/lib/types";

type Props = { need?: ServiceNeed };

export function NeedForm({ need }: Props) {
  return (
    <form action={upsertNeedAction}>
      {need && <input type="hidden" name="id" value={need.id} />}
      <Card>
        <Field label="Necesidad" name="title" required>
          <TextInput
            id="title"
            name="title"
            required
            defaultValue={need?.title ?? ""}
            placeholder="Tutores para Libro 1"
          />
        </Field>

        <div className="mt-4">
          <Field label="Descripción" name="description" required>
            <TextArea
              id="description"
              name="description"
              rows={4}
              required
              defaultValue={need?.description ?? ""}
              placeholder="Se necesitan 2 tutores para un nuevo círculo de estudio"
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Urgencia" name="urgency" required>
            <Select
              id="urgency"
              name="urgency"
              required
              defaultValue={need?.urgency ?? "media"}
            >
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </Select>
          </Field>
        </div>
      </Card>

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="secondary" href="/admin/servicio">
          Cancelar
        </Button>
        <Button type="submit">{need ? "Guardar" : "Publicar necesidad"}</Button>
      </div>
    </form>
  );
}
