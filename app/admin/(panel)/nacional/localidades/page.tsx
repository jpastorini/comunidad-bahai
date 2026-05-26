import {
  Banner,
  Button,
  Card,
  Checkbox,
  Field,
  PageHeader,
  TextArea,
  TextInput,
} from "@/components/admin/ui";
import { requireNationalAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Locality } from "@/lib/types";
import {
  deleteLocalityAction,
  upsertLocalityAction,
} from "../actions";

export const revalidate = 60;

export default async function LocalidadesPage() {
  await requireNationalAdmin();
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("localities")
    .select("*")
    .order("name");
  const localities = (data ?? []) as Locality[];

  // Conteo de miembros por localidad (para mostrar al borrar)
  const counts = new Map<string, number>();
  if (localities.length > 0) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("locality_id");
    for (const p of prof ?? []) {
      if (p.locality_id)
        counts.set(p.locality_id, (counts.get(p.locality_id) ?? 0) + 1);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Admin Nacional"
        title="Localidades"
        description="Cada localidad es una Comunidad Bahá'í independiente. Los datos no se cruzan entre localidades."
      />

      {localities.length > 0 && (
        <div className="mb-6 flex flex-col gap-3">
          {localities.map((loc) => (
            <LocalityCard
              key={loc.id}
              loc={loc}
              memberCount={counts.get(loc.id) ?? 0}
            />
          ))}
        </div>
      )}

      <Card>
        <h2 className="mb-4 font-display text-[20px] font-semibold text-dark">
          + Nueva localidad
        </h2>
        <form action={upsertLocalityAction}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nombre" name="name" required>
              <TextInput
                name="name"
                required
                placeholder="Comunidad Bahá'í de Salto"
              />
            </Field>
            <Field label="Ciudad" name="city">
              <TextInput name="city" placeholder="Salto" />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="País" name="country">
              <TextInput name="country" defaultValue="Uruguay" />
            </Field>
          </div>
          <div className="mt-4">
            <Field
              label="Descripción"
              name="description"
              hint="Aparece en el selector de localidades"
            >
              <TextArea
                name="description"
                rows={3}
                placeholder="Asamblea Espiritual Local establecida en..."
              />
            </Field>
          </div>
          <div className="mt-4">
            <Checkbox
              name="is_active"
              label="Activa (visible en el selector de los usuarios)"
              defaultChecked
            />
          </div>
          <div className="mt-5 flex justify-end">
            <Button type="submit">Crear localidad</Button>
          </div>
        </form>
      </Card>

      <div className="mt-6">
        <Banner tone="info">
          Para borrar una localidad primero debes reasignar todos sus
          miembros a otra. Esto evita perder datos por accidente.
        </Banner>
      </div>
    </>
  );
}

function LocalityCard({
  loc,
  memberCount,
}: {
  loc: Locality;
  memberCount: number;
}) {
  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-[20px] font-semibold text-dark">
            {loc.name}
          </div>
          <div className="mt-0.5 text-[12px] text-muted">
            {[loc.city, loc.country].filter(Boolean).join(" · ")} · {memberCount}{" "}
            {memberCount === 1 ? "miembro" : "miembros"}
          </div>
        </div>
        {!loc.is_active && (
          <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-700">
            Inactiva
          </span>
        )}
      </div>

      <form action={upsertLocalityAction}>
        <input type="hidden" name="id" value={loc.id} />
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Nombre" name="name">
            <TextInput name="name" defaultValue={loc.name} required />
          </Field>
          <Field label="Ciudad" name="city">
            <TextInput name="city" defaultValue={loc.city ?? ""} />
          </Field>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="País" name="country">
            <TextInput name="country" defaultValue={loc.country} />
          </Field>
          <div className="flex items-end">
            <Checkbox
              name="is_active"
              label="Activa"
              defaultChecked={loc.is_active}
            />
          </div>
        </div>
        <div className="mt-3">
          <Field label="Descripción" name="description">
            <TextArea
              name="description"
              rows={2}
              defaultValue={loc.description ?? ""}
            />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <form action={deleteLocalityAction}>
            <input type="hidden" name="id" value={loc.id} />
            <button
              type="submit"
              className="text-[12px] font-semibold text-rose-600 hover:underline disabled:opacity-50"
              disabled={memberCount > 0}
              title={
                memberCount > 0
                  ? `${memberCount} miembros la usan aún`
                  : "Borrar localidad"
              }
            >
              Borrar
            </button>
          </form>
          <button
            type="submit"
            className="tap rounded-xl bg-terra px-4 py-2 text-[13px] font-semibold text-white shadow-card-soft"
          >
            Guardar cambios
          </button>
        </div>
      </form>
    </Card>
  );
}
