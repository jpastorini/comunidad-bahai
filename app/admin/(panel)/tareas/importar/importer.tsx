"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Banner,
  Button,
  Card,
  Field,
  Select,
  TextArea,
  TextInput,
} from "@/components/admin/ui";
import type { ExtractedTask } from "@/lib/acta-extract";
import {
  extractTasksFromActaAction,
  saveImportedTasksAction,
} from "./actions";

type Phase = "upload" | "preview";

/** Fila editable del preview (igual que ExtractedTask pero con due_date como
 *  string vacío en vez de null, para los inputs controlados). */
type Row = {
  description: string;
  assignee: string;
  priority: ExtractedTask["priority"];
  due_date: string;
};

function toRow(t: ExtractedTask): Row {
  return {
    description: t.description,
    assignee: t.assignee ?? "",
    priority: t.priority,
    due_date: t.due_date ?? "",
  };
}

const EMPTY_ROW: Row = {
  description: "",
  assignee: "",
  priority: "media",
  due_date: "",
};

export function ActaImporter() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("upload");
  const [error, setError] = useState<string | null>(null);
  const [extracting, startExtract] = useTransition();
  const [saving, startSave] = useTransition();

  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  function handleExtract(formData: FormData) {
    setError(null);
    // Pre-cargamos título/fecha de los campos del form para el preview.
    setTitle((formData.get("title") as string)?.trim() || "");
    setMeetingDate((formData.get("meeting_date") as string) || "");

    startExtract(async () => {
      const result = await extractTasksFromActaAction(formData);
      if (!result.ok) {
        setError(result.error ?? "No se pudo procesar el acta.");
        return;
      }
      setRows((result.tasks ?? []).map(toRow));
      setPhase("preview");
    });
  }

  function updateRow(idx: number, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    );
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function addRow() {
    setRows((prev) => [...prev, { ...EMPTY_ROW }]);
  }

  function handleSave() {
    setError(null);
    const cleaned = rows
      .map((r) => ({
        description: r.description.trim(),
        assignee: r.assignee.trim() || null,
        priority: r.priority,
        due_date: r.due_date || null,
      }))
      .filter((r) => r.description.length > 0);

    if (!title.trim()) {
      setError("Ponele un título al acta antes de guardar.");
      return;
    }
    if (cleaned.length === 0) {
      setError("No hay tareas con descripción para guardar.");
      return;
    }

    startSave(async () => {
      const result = await saveImportedTasksAction({
        title: title.trim(),
        meetingDate: meetingDate || null,
        tasks: cleaned,
      });
      if (!result.ok) {
        setError(result.error ?? "No se pudo guardar.");
        return;
      }
      router.push("/admin/tareas");
    });
  }

  if (phase === "upload") {
    return (
      <form action={handleExtract}>
        {error && (
          <div className="mb-4">
            <Banner tone="danger">{error}</Banner>
          </div>
        )}

        <Card>
          <Field
            label="Título del acta"
            name="title"
            hint="Para identificarla en el tablero"
            required
          >
            <TextInput
              id="title"
              name="title"
              required
              placeholder="Ej. Reunión ordinaria de mayo"
            />
          </Field>

          <div className="mt-4">
            <Field label="Fecha de la reunión" name="meeting_date" hint="Opcional">
              <TextInput id="meeting_date" name="meeting_date" type="date" />
            </Field>
          </div>

          <div className="mt-4">
            <Field
              label="Acta (.docx)"
              name="file"
              hint="Solo Word .docx — no guardamos el archivo, solo leemos el texto"
              required
            >
              <TextInput
                id="file"
                name="file"
                type="file"
                accept=".docx"
                required
                className="cursor-pointer file:mr-3 file:rounded-lg file:border-0 file:bg-bg file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-dark"
              />
            </Field>
          </div>
        </Card>

        <div className="mt-3">
          <Banner tone="info">
            Al subir el acta, Claude lee el texto y propone una lista de tareas.
            Vas a poder revisarla y editarla antes de guardar nada.
          </Banner>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="secondary" href="/admin/tareas">
            Cancelar
          </Button>
          <Button type="submit" disabled={extracting}>
            {extracting ? "Analizando acta…" : "Analizar acta"}
          </Button>
        </div>
      </form>
    );
  }

  // ── Fase preview ──────────────────────────────────────────────
  return (
    <div>
      {error && (
        <div className="mb-4">
          <Banner tone="danger">{error}</Banner>
        </div>
      )}

      <div className="mb-4">
        <Banner tone="info">
          Revisá las tareas que detectó Claude. Editá lo que haga falta, borrá
          las que no correspondan o agregá las que falten. Nada se guarda hasta
          que confirmes.
        </Banner>
      </div>

      {rows.length === 0 ? (
        <Card className="py-8 text-center text-[14px] text-muted">
          No se detectaron tareas en el acta. Podés agregarlas a mano.
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row, idx) => (
            <Card key={idx}>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-gold-dark">
                  Tarea {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="text-[12px] font-semibold text-rose-600 hover:underline"
                >
                  Quitar
                </button>
              </div>

              <Field label="Descripción" name={`desc-${idx}`} required>
                <TextArea
                  id={`desc-${idx}`}
                  rows={2}
                  value={row.description}
                  onChange={(e) => updateRow(idx, { description: e.target.value })}
                />
              </Field>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Field label="Responsable" name={`assignee-${idx}`}>
                  <TextInput
                    id={`assignee-${idx}`}
                    value={row.assignee}
                    placeholder="Opcional"
                    onChange={(e) => updateRow(idx, { assignee: e.target.value })}
                  />
                </Field>
                <Field label="Prioridad" name={`priority-${idx}`}>
                  <Select
                    id={`priority-${idx}`}
                    value={row.priority}
                    onChange={(e) =>
                      updateRow(idx, {
                        priority: e.target.value as Row["priority"],
                      })
                    }
                  >
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baja">Baja</option>
                  </Select>
                </Field>
                <Field label="Fecha límite" name={`due-${idx}`}>
                  <TextInput
                    id={`due-${idx}`}
                    type="date"
                    value={row.due_date}
                    onChange={(e) => updateRow(idx, { due_date: e.target.value })}
                  />
                </Field>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-3">
        <Button variant="secondary" onClick={addRow}>
          + Agregar tarea
        </Button>
      </div>

      <div className="mt-6 flex items-center justify-between gap-2 border-t border-black/[0.06] pt-5">
        <Button
          variant="ghost"
          onClick={() => {
            setError(null);
            setPhase("upload");
          }}
        >
          ← Volver a subir
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving
            ? "Guardando…"
            : `Guardar ${rows.length} tarea${rows.length === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}
