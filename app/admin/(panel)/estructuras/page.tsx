import { Banner, Button, Card, Checkbox, Field, PageHeader, Select, TextInput } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { activeMembers, getLocalityMembers, type LocalityMember } from "@/lib/memberships";
import {
  getChildStructures,
  getStructureCandidates,
  structureTypeLabel,
  type StructureCandidate,
  type StructureWithMembers,
} from "@/lib/structures";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  isNationalLocality,
  isStructureLocality,
  STRUCTURE_TYPE_LABELS,
  STRUCTURE_TYPES,
  type Locality,
} from "@/lib/types";
import {
  addStructureMemberAction,
  createStructureAction,
  removeStructureMemberAction,
  setStructureTreasuryAction,
  updateStructureAction,
} from "./actions";

/**
 * Asamblea → Estructuras (082). Con la Asamblea puesta: crear Comités,
 * Departamentos, la Coordinación o la Junta de Instituto, y nombrar a sus
 * integrantes. Con una estructura puesta, la misma ruta es "Integrantes":
 * quiénes la integran, de solo lectura.
 */
export default async function EstructurasPage() {
  const session = await requireAdmin();
  if (isStructureLocality(session.locality)) {
    return <OwnStructure locality={session.locality} />;
  }

  const [{ structures, schemaMissing }, candidates] = await Promise.all([
    getChildStructures(session.locality.id),
    getStructureCandidates(session.locality),
  ]);
  const national = isNationalLocality(session.locality);

  return (
    <>
      <PageHeader
        eyebrow="Asamblea"
        title="Estructuras"
        description={`Los Comités, Departamentos y la Coordinación o Junta de Instituto que creó ${
          national ? "la Asamblea Nacional" : "la Asamblea"
        }. Cada una tiene su panel con reuniones, tareas, calendario y Tesorería; no tiene creyentes ni publica nada a la comunidad.`}
      />

      {schemaMissing && (
        <div className="mb-5">
          <Banner tone="warning">
            Falta aplicar la migración 082 en la base. Hasta entonces no se pueden
            crear estructuras.
          </Banner>
        </div>
      )}

      {structures.length > 0 && (
        <div className="mb-6 flex flex-col gap-4">
          {structures.map((s) => (
            <StructureCard
              key={s.locality.id}
              structure={s}
              parent={session.locality}
              candidates={candidates}
            />
          ))}
        </div>
      )}

      <Card>
        <h2 className="mb-1 font-display text-[20px] font-semibold text-dark">
          + Nueva estructura
        </h2>
        <p className="mb-4 text-[13px] text-muted">
          {national
            ? "Sus integrantes pueden ser creyentes de cualquier comunidad del país."
            : "Sus integrantes son creyentes de esta comunidad."}
        </p>
        <form action={createStructureAction}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nombre" name="name" required>
              <TextInput
                name="name"
                required
                placeholder={national ? "Junta Nacional de Instituto" : "Comité de Juventud"}
              />
            </Field>
            <Field label="Tipo" name="structure_type" required>
              <TypeSelect />
            </Field>
          </div>
          <div className="mt-5 flex justify-end">
            <Button type="submit" disabled={schemaMissing}>
              Crear estructura
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}

function TypeSelect({ defaultValue }: { defaultValue?: string | null }) {
  return (
    <Select name="structure_type" required defaultValue={defaultValue ?? ""}>
      <option value="" disabled>
        Elegí…
      </option>
      {STRUCTURE_TYPES.map((t) => (
        <option key={t} value={t}>
          {STRUCTURE_TYPE_LABELS[t]}
        </option>
      ))}
    </Select>
  );
}

function memberName(m: LocalityMember): string {
  return m.full_name?.trim() || m.email || "Sin nombre";
}

function StructureCard({
  structure,
  parent,
  candidates,
}: {
  structure: StructureWithMembers;
  parent: Locality;
  candidates: StructureCandidate[];
}) {
  const { locality, members } = structure;
  const memberIds = new Set(members.map((m) => m.id));
  const available = candidates.filter((c) => !memberIds.has(c.id));

  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[1.5px] text-gold-dark">
            {structureTypeLabel(locality.structure_type, parent)}
          </div>
          <div className="font-display text-[20px] font-semibold text-dark">{locality.name}</div>
          <div className="mt-0.5 text-[12px] text-muted">
            {members.length === 0
              ? "Sin integrantes todavía"
              : `${members.length} ${members.length === 1 ? "integrante" : "integrantes"}`}
          </div>
        </div>
        {!locality.is_active && (
          <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-700">
            Inactiva
          </span>
        )}
      </div>

      {members.length > 0 && (
        <ul className="mb-4 divide-y divide-black/[0.05] rounded-xl border border-black/[0.06]">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              <span className="min-w-0 flex-1 text-[13.5px] font-medium text-dark">
                {memberName(m)}
                {m.disabled_at && (
                  <span className="ml-2 text-[11px] text-muted">(deshabilitado)</span>
                )}
              </span>
              <form action={setStructureTreasuryAction}>
                <input type="hidden" name="structure_id" value={locality.id} />
                <input type="hidden" name="profile_id" value={m.id} />
                <input type="hidden" name="value" value={m.can_manage_treasury ? "" : "on"} />
                <button
                  type="submit"
                  title={m.can_manage_treasury ? "Quitarle la Tesorería" : "Darle la Tesorería"}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    m.can_manage_treasury
                      ? "bg-terra/10 text-terra"
                      : "bg-black/[0.04] text-muted hover:text-dark"
                  }`}
                >
                  {m.can_manage_treasury ? "Tesorería ✓" : "+ Tesorería"}
                </button>
              </form>
              <form action={removeStructureMemberAction}>
                <input type="hidden" name="structure_id" value={locality.id} />
                <input type="hidden" name="profile_id" value={m.id} />
                <button
                  type="submit"
                  className="text-[12px] font-semibold text-rose-600 hover:underline"
                >
                  Quitar
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form
        action={addStructureMemberAction}
        className="flex flex-col gap-3 md:flex-row md:items-end"
      >
        <input type="hidden" name="structure_id" value={locality.id} />
        <div className="flex-1">
          <Field label="Sumar integrante" name="profile_id">
            <Select name="profile_id" required defaultValue="">
              <option value="" disabled>
                {available.length === 0 ? "No queda nadie para sumar" : "Elegí un creyente…"}
              </option>
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="md:pb-2.5">
          <Checkbox name="can_manage_treasury" label="Lleva la Tesorería" />
        </div>
        <Button type="submit" variant="secondary" disabled={available.length === 0}>
          Sumar
        </Button>
      </form>

      <details className="mt-4 border-t border-black/[0.06] pt-3">
        <summary className="cursor-pointer text-[12.5px] font-semibold text-muted hover:text-terra">
          Editar nombre, tipo o desactivar
        </summary>
        <form action={updateStructureAction} className="mt-3">
          <input type="hidden" name="id" value={locality.id} />
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nombre" name="name">
              <TextInput name="name" defaultValue={locality.name} required />
            </Field>
            <Field label="Tipo" name="structure_type">
              <TypeSelect defaultValue={locality.structure_type} />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <Checkbox
              name="is_active"
              label="Activa (sus integrantes la ven en el panel)"
              defaultChecked={locality.is_active}
            />
            <Button type="submit">Guardar cambios</Button>
          </div>
        </form>
      </details>
    </Card>
  );
}

/** Con una estructura puesta: quiénes la integran y de quién depende. */
async function OwnStructure({ locality }: { locality: Locality }) {
  const supabase = createSupabaseServer();
  const [members, parentRes] = await Promise.all([
    getLocalityMembers(supabase, locality.id),
    locality.parent_id
      ? supabase.from("localities").select("*").eq("id", locality.parent_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const parent = (parentRes.data as Locality | null) ?? null;
  const list = activeMembers(members);

  return (
    <>
      <PageHeader
        eyebrow="Reuniones y tareas"
        title="Integrantes"
        description={`${structureTypeLabel(locality.structure_type, parent)}${
          parent ? ` de ${parent.name}` : ""
        }. Los integrantes los nombra la Asamblea que creó la estructura.`}
      />
      <Card>
        {list.length === 0 ? (
          <p className="text-[13px] text-muted">Todavía no hay integrantes.</p>
        ) : (
          <ul className="divide-y divide-black/[0.05]">
            {list.map((m) => (
              <li key={m.id} className="flex items-center gap-2 py-2.5">
                <span className="min-w-0 flex-1 text-[13.5px] font-medium text-dark">
                  {memberName(m)}
                </span>
                {m.can_manage_treasury && (
                  <span className="rounded-full bg-terra/10 px-2.5 py-1 text-[11px] font-semibold text-terra">
                    Tesorería
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
