import {
  Banner,
  Button,
  Card,
  Field,
  PageHeader,
  TextInput,
} from "@/components/admin/ui";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Treasury } from "@/lib/types";
import { saveTreasuryAction } from "./actions";

export default async function AdminTesoreriaPage() {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);

  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("treasury")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const t = (data ?? {
    id: null,
    period: "Año " + new Date().getFullYear(),
    goal_amount: 0,
    current_amount: 0,
    contributions: [],
    methods: [],
  }) as Treasury & { id?: string | null };

  // Render existing rows plus 2 empty slots so admins can add new ones
  // without JavaScript. Empty rows are filtered out in the server action.
  const contributions = [
    ...t.contributions,
    { label: "", amount: 0 },
    { label: "", amount: 0 },
  ];
  const methods = [
    ...t.methods,
    { type: "", description: "", letter: "" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Tesorería"
        title="Fondo de la Comunidad"
        description="Solo miembros con permiso de Tesorería pueden editar esta sección."
      />

      <div className="mb-4">
        <Banner tone="info">
          La cifra y el progreso aparecen automáticamente en la app de
          miembros cuando guardas los cambios.
        </Banner>
      </div>

      <form action={saveTreasuryAction}>
        {t.id && <input type="hidden" name="id" value={t.id} />}

        <Card>
          <h2 className="mb-4 font-display text-[20px] font-semibold text-dark">
            Periodo y meta
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Periodo" name="period" required>
              <TextInput
                id="period"
                name="period"
                required
                defaultValue={t.period}
                placeholder="Año 2026"
              />
            </Field>
            <Field label="Meta ($)" name="goal_amount" required>
              <TextInput
                id="goal_amount"
                name="goal_amount"
                type="number"
                step="1"
                min="0"
                required
                defaultValue={t.goal_amount}
              />
            </Field>
            <Field label="Recaudado ($)" name="current_amount" required>
              <TextInput
                id="current_amount"
                name="current_amount"
                type="number"
                step="1"
                min="0"
                required
                defaultValue={t.current_amount}
              />
            </Field>
          </div>
        </Card>

        <Card className="mt-4">
          <h2 className="mb-1 font-display text-[20px] font-semibold text-dark">
            Informe mensual
          </h2>
          <p className="mb-4 text-[12px] text-muted">
            Lista de líneas que aparecen en la sección "Informe mensual".
          </p>
          <RepeatingRows
            rows={contributions.map((c, i) => ({ id: String(i), ...c }))}
            template={(row) => (
              <div className="grid gap-3 md:grid-cols-[1fr,160px]" key={row.id}>
                <TextInput
                  name="contribution_label[]"
                  defaultValue={row.label}
                  placeholder="Ingresos del mes"
                />
                <TextInput
                  name="contribution_amount[]"
                  type="number"
                  step="1"
                  defaultValue={row.amount}
                  placeholder="0"
                />
              </div>
            )}
          />
        </Card>

        <Card className="mt-4">
          <h2 className="mb-1 font-display text-[20px] font-semibold text-dark">
            Métodos de contribución
          </h2>
          <p className="mb-4 text-[12px] text-muted">
            Tarjetas mostradas en "Cómo aportar".
          </p>
          <RepeatingRows
            rows={methods.map((m, i) => ({ id: String(i), ...m }))}
            template={(row) => (
              <div
                className="grid gap-3 md:grid-cols-[160px,1fr,80px]"
                key={row.id}
              >
                <TextInput
                  name="method_type[]"
                  defaultValue={row.type}
                  placeholder="Transferencia"
                />
                <TextInput
                  name="method_description[]"
                  defaultValue={row.description}
                  placeholder="Datos bancarios"
                />
                <TextInput
                  name="method_letter[]"
                  defaultValue={row.letter}
                  maxLength={1}
                  placeholder="T"
                />
              </div>
            )}
          />
        </Card>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="secondary" href="/admin">
            Cancelar
          </Button>
          <Button type="submit">Guardar Tesorería</Button>
        </div>
      </form>
    </>
  );
}

function RepeatingRows<T>({
  rows,
  template,
}: {
  rows: T[];
  template: (row: T) => React.ReactNode;
}) {
  // Server-only renderer: we render the existing rows plus one empty placeholder
  // so admins can grow the list by submitting filled fields.
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => template(row))}
      <p className="text-[11px] text-muted">
        Las filas vacías se ignoran al guardar. Si necesitas más espacio,
        guarda primero y vuelve a abrir esta página.
      </p>
    </div>
  );
}
