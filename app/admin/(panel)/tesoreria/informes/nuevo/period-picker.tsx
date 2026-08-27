"use client";

import { useState } from "react";
import { Field, Select, TextInput } from "@/components/admin/ui";
import {
  AUDIENCE_HINT,
  AUDIENCE_LABEL,
  type ReportAudience,
} from "@/lib/treasury-report-content";
import type { PeriodPreset } from "@/lib/treasury-reports";

/** Título sugerido según el destinatario. */
const DEFAULT_TITLE: Record<ReportAudience, string> = {
  comunidad: "Fiesta de los Diecinueve Días",
  internos: "Informe de Tesorería a la Asamblea",
};

/**
 * Elegir el período del informe.
 *
 * Los atajos son los meses bahá'ís del año: el informe se presenta en la
 * Fiesta que abre el mes siguiente, así que el mes bahá'í es el corte
 * natural. Pero las fechas quedan editables a mano, porque en la
 * práctica la Fiesta se celebra unos días después de la fecha oficial y
 * el tesorero corre el cierre hasta ese día.
 */
export function PeriodPicker({
  presets,
  today,
  defaultTitle,
}: {
  presets: PeriodPreset[];
  today: string;
  defaultTitle: string;
}) {
  const initial = presets[0];
  const [from, setFrom] = useState(initial?.from ?? today);
  const [to, setTo] = useState(initial?.to ?? today);
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [presetKey, setPresetKey] = useState(initial?.key ?? "custom");
  const [audience, setAudience] = useState<ReportAudience>("comunidad");
  const [title, setTitle] = useState(defaultTitle);

  function applyPreset(key: string) {
    setPresetKey(key);
    const preset = presets.find((p) => p.key === key);
    if (!preset) return;
    setFrom(preset.from);
    setTo(preset.to);
    setSubtitle(preset.subtitle);
  }

  /** Al cambiar el destinatario se sugiere el título de ese formato, pero
   *  solo si el tesorero no lo tocó: no le pisamos lo que escribió. */
  function applyAudience(next: ReportAudience) {
    setAudience(next);
    const suggestions = Object.values(DEFAULT_TITLE);
    if (title === "" || suggestions.includes(title)) {
      setTitle(DEFAULT_TITLE[next]);
    }
  }

  return (
    <>
      <Field
        label="Destinatario"
        name="audience"
        hint="define el formato y quién lo puede leer"
      >
        <Select
          id="audience"
          name="audience"
          value={audience}
          onChange={(e) => applyAudience(e.target.value as ReportAudience)}
        >
          {(Object.keys(AUDIENCE_LABEL) as ReportAudience[]).map((a) => (
            <option key={a} value={a}>
              {AUDIENCE_LABEL[a]}
            </option>
          ))}
        </Select>
      </Field>
      <p className="mb-4 mt-1 text-[11.5px] leading-snug text-muted">
        {AUDIENCE_HINT[audience]}
      </p>

      <Field
        label="Período"
        name="preset"
        hint="Los meses bahá'ís del año; después podés correr las fechas"
      >
        <Select
          id="preset"
          value={presetKey}
          onChange={(e) => applyPreset(e.target.value)}
        >
          {presets.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
          <option value="custom">Fechas a mano</option>
        </Select>
      </Field>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Desde" name="period_from" required>
          <TextInput
            id="period_from"
            name="period_from"
            type="date"
            required
            max={today}
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPresetKey("custom");
            }}
          />
        </Field>
        <Field label="Hasta" name="period_to" required>
          <TextInput
            id="period_to"
            name="period_to"
            type="date"
            required
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPresetKey("custom");
            }}
          />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Título" name="title" required>
          <TextInput
            id="title"
            name="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Fiesta de los Diecinueve Días"
          />
        </Field>
        <Field label="Subtítulo" name="subtitle" hint="opcional">
          <TextInput
            id="subtitle"
            name="subtitle"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Asmáʼ · «Nombres» · 183 E.B."
          />
        </Field>
      </div>
    </>
  );
}
