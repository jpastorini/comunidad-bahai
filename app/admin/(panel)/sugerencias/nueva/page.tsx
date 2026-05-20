import {
  Banner,
  Button,
  Card,
  Field,
  FormShell,
  PageHeader,
  Select,
  TextInput,
} from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { BulkRows } from "./bulk-rows";
import { bulkInsertSuggestionsAction } from "../actions";

export default async function NewSuggestionsPage({
  searchParams,
}: {
  searchParams: { feast?: string };
}) {
  await requireAdmin();
  const supabase = createSupabaseServer();

  // Trae todas las Fiestas para el selector, más recientes primero.
  const { data: feasts } = await supabase
    .from("feasts")
    .select("id, bahai_month_name, bahai_month_index, bahai_year, status")
    .order("bahai_year", { ascending: false })
    .order("bahai_month_index", { ascending: false });

  const defaultFeast =
    searchParams.feast ?? (feasts && feasts[0]?.id) ?? "";

  return (
    <FormShell>
      <PageHeader
        eyebrow="Asamblea Local"
        title="Agregar sugerencias"
        description="Captura todas las sugerencias recogidas durante una Fiesta. Solo el detalle es obligatorio — el nombre del autor es opcional."
      />

      <Banner tone="info">
        Tip: agrega tantas filas como necesites. Las filas vacías se ignoran al
        guardar.
      </Banner>

      <form action={bulkInsertSuggestionsAction} className="mt-4">
        <Card>
          <Field label="Fiesta a la que corresponden" name="feast_id" required>
            <Select
              id="feast_id"
              name="feast_id"
              required
              defaultValue={defaultFeast}
            >
              {(feasts ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.bahai_month_name} · Mes {f.bahai_month_index} · {f.bahai_year} BE
                  {f.status === "in_progress" ? " (iniciada)" : ""}
                </option>
              ))}
            </Select>
          </Field>
          {!feasts || feasts.length === 0 ? (
            <div className="mt-3 text-[12px] text-rose-600">
              No hay Fiestas creadas todavía. Crea una primero.
            </div>
          ) : null}
        </Card>

        <Card className="mt-4">
          <h2 className="mb-1 font-display text-[18px] font-semibold text-dark">
            Sugerencias
          </h2>
          <p className="mb-4 text-[12px] text-muted">
            Una fila por sugerencia. La fecha se asigna automáticamente al
            guardar.
          </p>
          <BulkRows />
        </Card>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="secondary" href="/admin/sugerencias">
            Cancelar
          </Button>
          <Button type="submit">Guardar sugerencias</Button>
        </div>
      </form>
    </FormShell>
  );
}
