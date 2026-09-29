"use client";

import { useMemo, useState } from "react";
import { Banner, Button, DateInput, Field, Select, TextArea, TextInput } from "@/components/admin/ui";
import { formatDate } from "@/lib/format";
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
  /** Desde cuándo ocupa la fila ("" = desde la elección). Solo lo tiene
   *  quien entró a mitad de ejercicio (073). */
  since: string;
};

/** Quien ocupó una fila y la dejó durante el ejercicio (073). */
export type FormerRow = {
  position: number;
  profile: string;
  name: string;
  office: AssemblyOffice | "";
  since: string;
  until: string;
};

type Props = {
  year: number;
  electedOn: string;
  notes: string;
  profiles: PickableProfile[];
  initial: EditorRow[];
  initialFormer: FormerRow[];
  /** De dónde salió la lista inicial cuando el ejercicio no estaba cargado. */
  prefillNote: string | null;
};

const OTHER = "otro";

const EMPTY: EditorRow = { profile: "", name: "", office: "", since: "" };

/**
 * Los nueve del ejercicio, con su cargo. Un formulario plano (post al
 * server action): lo único que hace el cliente es mostrar el campo de
 * nombre cuando la persona no está en la app y avisar en vivo si el
 * oficial declarado no tiene el tag que hace falta para su trabajo.
 *
 * Un cambio a mitad de ejercicio (073) —un tesorero que deja el cargo en
 * noviembre— NO se hace pisando la fila: se toca "Reemplazar", se da la
 * fecha, y quien se va queda abajo en "Cambios durante el ejercicio" con
 * su "hasta". Así los recibos que firmó siguen con su nombre y los de
 * después salen con el del nuevo.
 */
export function MembersEditor({
  year,
  electedOn,
  notes,
  profiles,
  initial,
  initialFormer,
  prefillNote,
}: Props) {
  const [rows, setRows] = useState<EditorRow[]>(() =>
    Array.from({ length: ASSEMBLY_SIZE }, (_, i) => initial[i] ?? EMPTY)
  );
  const [former, setFormer] = useState<FormerRow[]>(initialFormer);
  // Fila en la que se está registrando un reemplazo, y la fecha elegida.
  const [replacing, setReplacing] = useState<number | null>(null);
  const [replaceDate, setReplaceDate] = useState("");

  const byId = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const nameOf = (r: { profile: string; name: string }) =>
    r.profile && r.profile !== OTHER ? byId.get(r.profile)?.name ?? "" : r.name;

  function update(i: number, patch: Partial<EditorRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function confirmReplace(i: number) {
    const row = rows[i];
    if (!replaceDate || !nameOf(row)) return;
    setFormer((prev) => [
      ...prev,
      {
        position: i + 1,
        profile: row.profile,
        name: nameOf(row),
        office: row.office,
        since: row.since,
        until: replaceDate,
      },
    ]);
    // La fila queda para el nuevo, con el mismo cargo (lo habitual es que
    // el reemplazo tome el cargo que quedó vacante) y "desde" esa fecha.
    update(i, { profile: "", name: "", since: replaceDate });
    setReplacing(null);
    setReplaceDate("");
  }

  function removeFormer(k: number) {
    setFormer((prev) => prev.filter((_, idx) => idx !== k));
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
  // Quien dejó el cargo de Tesorero/a y conserva el permiso sigue viendo
  // el libro entero: hay que sacárselo a mano.
  for (const f of former) {
    if (f.office !== "tesorero" || !f.profile || f.profile === OTHER) continue;
    const p = byId.get(f.profile);
    if (p?.can_manage_treasury) {
      warnings.push(
        `${p.name} dejó de ser Tesorero/a el ${formatDate(f.until)} y todavía tiene el permiso de Tesorería: sigue viendo el libro y los nombres. Se quita en Creyentes → Creyentes.`
      );
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
          <DateInput id="elected_on" name="elected_on" defaultValue={electedOn} />
        </Field>
        <div className="flex items-end text-[12px] text-muted">
          {filled} de {ASSEMBLY_SIZE} miembros cargados
          {usedOffices.size < ASSEMBLY_OFFICES.length &&
            ` · faltan ${ASSEMBLY_OFFICES.length - usedOffices.size} cargos`}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <div className="hidden grid-cols-[28px_1fr_1fr_180px_92px] gap-2 px-1 text-[10px] font-semibold uppercase tracking-[1.5px] text-muted md:grid">
          <span>#</span>
          <span>Persona</span>
          <span>Nombre (si no está en la app)</span>
          <span>Cargo</span>
          <span />
        </div>
        {rows.map((row, i) => {
          const n = i + 1;
          const isOther = row.profile === OTHER;
          const hasPerson = !!nameOf(row);
          const isReplacing = replacing === i;
          return (
            <div key={n} className="flex flex-col gap-2">
              <div className="grid grid-cols-1 gap-2 rounded-xl border border-black/[0.06] bg-bg/60 p-2.5 md:grid-cols-[28px_1fr_1fr_180px_92px] md:items-center md:border-0 md:bg-transparent md:p-0">
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
                <input type="hidden" name={`member_${n}_since`} value={row.since} />
                <div className="flex items-center justify-end gap-1 text-[11px]">
                  {row.since && (
                    <span className="text-muted" title="Entró a mitad de ejercicio">
                      desde {formatDate(row.since)}
                    </span>
                  )}
                  {hasPerson && !isReplacing && (
                    <button
                      type="button"
                      onClick={() => {
                        setReplacing(i);
                        setReplaceDate("");
                      }}
                      className="rounded-lg px-2 py-1 font-semibold text-terra hover:bg-terra/[0.06]"
                      title="Esta persona deja la Asamblea o el cargo: registrar desde cuándo"
                    >
                      Reemplazar
                    </button>
                  )}
                </div>
              </div>

              {isReplacing && (
                <div className="ml-0 flex flex-col gap-2 rounded-xl border border-gold/40 bg-gold/[0.06] p-3 md:ml-[36px] md:flex-row md:items-end">
                  <div className="flex-1 text-[12.5px] text-dark">
                    <strong>{nameOf(row)}</strong> deja{" "}
                    {row.office ? `el cargo de ${ASSEMBLY_OFFICE_LABELS[row.office]}` : "la Asamblea"}.
                    ¿Desde qué fecha? Hasta ese día los documentos siguen con su nombre; desde
                    ese día, con el de quien elijas en la fila.
                  </div>
                  <div className="w-full md:w-[170px]">
                    <DateInput
                      aria-label="Fecha del cambio"
                      value={replaceDate}
                      onValueChange={setReplaceDate}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setReplacing(null)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      disabled={!replaceDate}
                      onClick={() => confirmReplace(i)}
                    >
                      Registrar el cambio
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quienes ocuparon una fila y la dejaron durante el ejercicio. Van
          al formulario como filas ocultas, con su "hasta". */}
      <input type="hidden" name="former_count" value={former.length} />
      {former.length > 0 && (
        <div className="mt-5">
          <div className="text-[10px] font-semibold uppercase tracking-[1.5px] text-muted">
            Cambios durante el ejercicio
          </div>
          <ul className="mt-2 flex flex-col gap-1.5">
            {former.map((f, k) => (
              <li
                key={`${f.position}-${f.until}-${k}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-bg/70 px-3 py-2 text-[12.5px] text-dark"
              >
                <input type="hidden" name={`former_${k}_position`} value={f.position} />
                <input type="hidden" name={`former_${k}_profile`} value={f.profile} />
                <input type="hidden" name={`former_${k}_name`} value={f.name} />
                <input type="hidden" name={`former_${k}_office`} value={f.office} />
                <input type="hidden" name={`former_${k}_since`} value={f.since} />
                <input type="hidden" name={`former_${k}_until`} value={f.until} />
                <span className="w-5 text-center text-[11px] font-semibold text-muted">
                  {f.position}
                </span>
                <span className="font-semibold">{f.name}</span>
                <span className="text-muted">
                  {f.office ? ASSEMBLY_OFFICE_LABELS[f.office] : "Miembro"}
                  {f.since ? ` · desde ${formatDate(f.since)}` : ""} · hasta {formatDate(f.until)}
                </span>
                <button
                  type="button"
                  onClick={() => removeFormer(k)}
                  className="ml-auto text-[11px] font-semibold text-muted hover:text-rose-700"
                  title="Quitar este cambio de la historia"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

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
