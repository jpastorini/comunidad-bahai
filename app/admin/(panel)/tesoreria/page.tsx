import {
  Banner,
  Button,
  Card,
  Field,
  PageHeader,
  TextInput,
} from "@/components/admin/ui";
import { IconArrowRight } from "@/components/Icons";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Treasury, TreasuryCommitment } from "@/lib/types";
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

  // Compromisos de miembros — solo el tesorero los ve (RLS lo garantiza).
  const { data: commitmentsRaw } = await supabase
    .from("treasury_commitments")
    .select("*")
    .order("amount", { ascending: false });

  // Enriquecemos con el email del perfil para que el tesorero pueda contactar.
  const commitments = (commitmentsRaw ?? []) as TreasuryCommitment[];
  let commitmentsWithEmail: (TreasuryCommitment & { email: string | null })[] = [];
  if (commitments.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", commitments.map((c) => c.user_id));
    const emailById = new Map<string, string | null>();
    for (const p of profiles ?? []) emailById.set(p.id, p.email);
    commitmentsWithEmail = commitments.map((c) => ({
      ...c,
      email: emailById.get(c.user_id) ?? null,
    }));
  }

  const totalCommitted = commitments.reduce((s, c) => s + Number(c.amount), 0);
  const wantReminderCount = commitments.filter((c) => c.want_reminder).length;

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
        actions={
          <Button href="/admin/tesoreria/presupuesto">
            Plan de Presupuesto
            <IconArrowRight size={13} />
          </Button>
        }
      />

      <div className="mb-4">
        <Banner tone="info">
          La cifra y el progreso aparecen automáticamente en la app de
          miembros cuando guardas los cambios.
        </Banner>
      </div>

      {/* Compromisos mensuales declarados por los miembros */}
      <Card className="mb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-[20px] font-semibold text-dark">
              Compromisos mensuales
            </h2>
            <p className="mt-1 text-[12px] text-muted">
              Declarados privadamente por los miembros. Solo tú (tesorero) los
              ves; ningún otro miembro de la Asamblea tiene acceso.
            </p>
          </div>
          <div className="text-right">
            <div className="font-display text-[28px] font-bold leading-none text-amber">
              {totalCommitted.toLocaleString("es-UY", {
                style: "currency",
                currency: "UYU",
                maximumFractionDigits: 0,
              })}
            </div>
            <div className="mt-0.5 text-[11px] text-muted">
              total / mes
              {commitments.length > 0 && (
                <> · {commitments.length} {commitments.length === 1 ? "miembro" : "miembros"}</>
              )}
            </div>
          </div>
        </div>

        {commitments.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-black/15 bg-bg/40 p-5 text-center text-[13px] text-muted">
            Aún no hay compromisos registrados. Los miembros pueden declarar el
            suyo desde la app, en la sección Tesorería.
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-black/[0.05]">
            <table className="w-full border-collapse text-left">
              <thead className="bg-bg/40 text-[11px] font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5">Nombre</th>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5 text-right">Monto / mes</th>
                  <th className="px-4 py-2.5 text-center">Recordatorio</th>
                  <th className="px-4 py-2.5">Última actualización</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05]">
                {commitmentsWithEmail.map((c) => (
                  <tr key={c.user_id} className="hover:bg-bg/30">
                    <td className="px-4 py-2.5 text-[13px] font-semibold text-dark">
                      {c.display_name}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-muted">
                      {c.email ? (
                        <a
                          href={`mailto:${c.email}`}
                          className="text-terra hover:underline"
                        >
                          {c.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-display text-[15px] font-semibold text-dark">
                      {Number(c.amount).toLocaleString("es-UY", {
                        style: "currency",
                        currency: "UYU",
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {c.want_reminder ? (
                        <span className="inline-flex rounded bg-amber/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber">
                          Sí · contactar
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-muted">
                      {new Date(c.updated_at).toLocaleDateString("es-MX", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {wantReminderCount > 0 && (
          <p className="mt-3 text-[11.5px] text-muted">
            <strong className="text-dark">{wantReminderCount}</strong>{" "}
            {wantReminderCount === 1 ? "miembro pidió" : "miembros pidieron"}{" "}
            que se les recuerde si hay retraso en su aporte.
          </p>
        )}
      </Card>

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
