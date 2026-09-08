"use client";

import { useMemo, useState } from "react";
import { Banner, Button, Field, Select, TextArea, TextInput } from "@/components/admin/ui";
import {
  ASSEMBLY_SIZE,
  ASSEMBLY_OFFICES,
  ASSEMBLY_OFFICE_LABELS,
  type AssemblyOffice,
} from "@/lib/types";
import { saveAssemblyTermAction } from "./actions";

export type PickableProfile = {
  id: string;
  name: string;
  role: "member" | "admin";
  can_manage_treasury: boolean;
  can_respond_chat: boolean;
};

export type EditorRow = {
  /** id de perfil, "otro" para nombre a mano, "" para fila vacía. */
  profile: string;
  name: string;
  office: AssemblyOffice | "";
};

type Props = {
  year: number;
  electedOn: string;
  notes: string;
  profiles: PickableProfile[];
  initial: EditorRow[];
  /** De dónde salió la lista inicial cuando el ejercicio no estaba cargado. */
  prefillNote: string | null;
};

const OTHER = "otro";

/**
 * Los nueve del ejercicio, con su cargo. Un formulario plano (post al
 * server action): lo único que hace el cliente es mostrar el campo de
 * nombre cuando la persona no está en la app y avisar en vivo si el
 * oficial declarado no tiene el tag que hace falta para su trabajo.
 */
export function MembersEditor({ year, electedOn, notes, profiles, initial, prefillNote }: Props) {
  const [rows, setRows] = useState<EditorRow[]>(() =>
    Array.from({ length: ASSEMBLY_SIZE }, (_, i) => initial[i] ?? { profile: "", name: "", office: "" })
  );

  const byId = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  function update(i: number, patch: Partial<EditorRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  // Avisos: la ficha es informativa, los permisos siguen en los tags.
  const warnings: string[] = [];
  const treasurer = rows.find((r) => r.office === "tesorero");
  if (treasurer && treasurer.profile && treasurer.profile !== OTHER) {
    const p = byId.get(treasurer.profile);
    if (p && !p.can_manage_treasury) {
      warnings.push(
        `${p.name} figura como Tesorero/a pero no tiene el permiso de Tesorería en la app. Se asigna en Creyentes → Creyentes.`
      );
    }
  }
  const secretary = rows.find((r) => r.office === "secretario");
  if (secretary && secretary.profile && secretary.profile !== OTHER) {
    const p = byId.get(secretary.profile);
    if (p && !p.can_respond_chat) {
      warnings.push(
        `${p.name} figura como Secretario/a pero no atiende el Chat de Secretaría en la app. Se asigna en Creyentes → Creyentes.`
      );
    }
  }
  for (const r of rows) {
    if (!r.profile || r.profile === OTHER) continue;
    const p = byId.get(r.profile);
    if (p && p.role !== "admin") {
      warnings.push(`${p.name} integra la Asamblea pero no tiene rol de Asamblea en la app.`);
    }
  }

  const usedOffices = new Set(rows.map((r) => r.office).filter(Boolean));
  const usedProfiles = new Set(rows.map((r) => r.profile).filter((p) => p && p !== OTHER));
  const filled = rows.filter((r) => (r.profile && r.profile !== OTHER) || r.name.trim()).length;

  return (
    <form action={saveAssemblyTermAction}>
      <input type="hidden" name="bahai_year" value={year} />

      {prefillNote && (
        <div className="mb-4">
          <Banner tone="info">{prefillNote} Revisá la lista y guardá.</Banner>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Fecha de elección"
          name="elected_on"
          hint="Normalmente el primer día de Riḍván."
        >
          <TextInput id="elected_on" name="elected_on" type="date" defaultValue={electedOn} />
        </Field>
        <div className="flex items-end text-[12px] text-muted">
          {filled} de {ASSEMBLY_SIZE} miembros cargados
          {usedOffices.size < ASSEMBLY_OFFICES.length &&
            ` · faltan ${ASSEMBLY_OFFICES.length - usedOffices.size} cargos`}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <div className="hidden grid-cols-[28px_1fr_1fr_180px] gap-2 px-1 text-[10px] font-semibold uppercase tracking-[1.5px] text-muted md:grid">
          <span>#</span>
          <span>Persona</span>
          <span>Nombre (si no está en la app)</span>
          <span>Cargo</span>
        </div>
        {rows.map((row, i) => {
          const n = i + 1;
          const isOther = row.profile === OTHER;
          return (
            <div
              key={n}
              className="grid grid-cols-1 gap-2 rounded-xl border border-black/[0.06] bg-bg/60 p-2.5 md:grid-cols-[28px_1fr_1fr_180px] md:items-center md:border-0 md:bg-transparent md:p-0"
            >
              <span className="text-[12px] font-semibold text-muted md:text-center">{n}</span>
              <Select
                aria-label={`Persona ${n}`}
                name={`member_${n}_profile`}
                value={row.profile}
                onChange={(e) => update(i, { profile: e.target.value })}
              >
                <option value="">— Vacío —</option>
                {profiles.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                    disabled={usedProfiles.has(p.id) && row.profile !== p.id}
                  >
                    {p.name}
                    {p.role === "admin" ? "" : " (creyente)"}
                  </option>
                ))}
                <option value={OTHER}>Otra persona (nombre a mano)</option>
              </Select>
              <TextInput
                aria-label={`Nombre ${n}`}
                name={`member_${n}_name`}
                value={isOther ? row.name : ""}
                onChange={(e) => update(i, { name: e.target.value })}
                disabled={!isOther}
                placeholder={isOther ? "Nombre y apellido" : "—"}
                className={isOther ? "" : "opacity-50"}
              />
              <Select
                aria-label={`Cargo ${n}`}
                name={`member_${n}_office`}
                value={row.office}
                onChange={(e) => update(i, { office: e.target.value as EditorRow["office"] })}
              >
                <option value="">Miembro</option>
                {ASSEMBLY_OFFICES.map((o) => (
                  <option key={o} value={o} disabled={usedOffices.has(o) && row.office !== o}>
                    {ASSEMBLY_OFFICE_LABELS[o]}
                  </option>
                ))}
              </Select>
            </div>
          );
        })}
      </div>

      {warnings.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {warnings.map((w) => (
            <Banner key={w} tone="warning">
              {w}
            </Banner>
          ))}
        </div>
      )}

      <div className="mt-5">
        <Field
          label="Notas del ejercicio"
          name="term_notes"
          hint="Opcional: elección extraordinaria, renuncias, reemplazos."
        >
          <TextArea id="term_notes" name="term_notes" rows={3} defaultValue={notes} />
        </Field>
      </div>

      <div className="mt-5 flex justify-end">
        <Button type="submit">Guardar composición {year}</Button>
      </div>
    </form>
  );
}
