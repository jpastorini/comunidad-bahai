"use client";

import { useState } from "react";
import { TREASURY_HELP } from "@/lib/treasury-help";
import { DateInput, Field, Select, TextInput } from "@/components/admin/ui";
import { formatDate } from "@/lib/format";
import {
  AUDIENCE_HINT,
  AUDIENCE_LABEL,
  type ReportAudience,
} from "@/lib/treasury-report-content";
import type {
  LastPublishedByAudience,
  PeriodPreset,
} from "@/lib/treasury-reports";
import { addDays } from "@/lib/treasury-year";

/** Título sugerido según el destinatario. */
const DEFAULT_TITLE: Record<ReportAudience, string> = {
  comunidad: "Fiesta de los Diecinueve Días",
  internos: "Informe de Tesorería a la Asamblea",
  balance: "Memoria y Balance anual",
};

/** Un atajo de mes bahá'í (los otros son el ejercicio y el estatutario). */
function isMonthPreset(p: PeriodPreset) {
  return !p.key.startsWith("statutory-") && !p.key.endsWith("-full");
}

type Proposal = {
  from: string;
  to: string;
  subtitle: string;
  presetKey: string;
};

/**
 * El período que se propone para un destinatario.
 *
 * Si ya hay un informe emitido para ese destinatario, el nuevo arranca el
 * día siguiente al que cerró el último y llega hasta hoy: cada serie
 * (Fiesta, reunión de la Asamblea, balance) continúa donde quedó, sin
 * huecos ni solapamientos. El subtítulo se toma del atajo que coincide
 * exacto con ese rango o, si no hay, del mes bahá'í en curso, que es el
 * que se nombra en la Fiesta.
 *
 * Sin informe anterior: el balance propone el ejercicio estatutario en
 * curso y los demás el mes bahá'í en curso.
 */
function proposeFor(
  audience: ReportAudience,
  presets: PeriodPreset[],
  today: string,
  lastPublished: LastPublishedByAudience
): Proposal {
  const last = lastPublished[audience];
  if (last) {
    const from = addDays(last.to, 1);
    if (from <= today) {
      const exact = presets.find((p) => p.from === from && p.to === today);
      const current = presets.find(isMonthPreset);
      return {
        from,
        to: today,
        subtitle: exact?.subtitle ?? current?.subtitle ?? "",
        presetKey: exact?.key ?? "custom",
      };
    }
  }

  const fallback =
    (audience === "balance"
      ? presets.find((p) => p.key.startsWith("statutory-"))
      : presets.find(isMonthPreset)) ?? presets[0];
  return fallback
    ? {
        from: fallback.from,
        to: fallback.to,
        subtitle: fallback.subtitle,
        presetKey: fallback.key,
      }
    : { from: today, to: today, subtitle: "", presetKey: "custom" };
}

/**
 * Elegir el período del informe.
 *
 * Al elegir el destinatario, las fechas se completan solas: desde el día
 * siguiente al último informe emitido para ese destinatario hasta hoy.
 * Los atajos son los meses bahá'ís del año (el informe se presenta en la
 * Fiesta que abre el mes siguiente, así que el mes bahá'í es el corte
 * natural), y las fechas quedan editables a mano, porque en la práctica
 * la Fiesta se celebra unos días después de la fecha oficial y el
 * tesorero corre el cierre hasta ese día.
 */
export function PeriodPicker({
  presets,
  today,
  lastPublished,
  defaultTitle,
}: {
  presets: PeriodPreset[];
  today: string;
  lastPublished: LastPublishedByAudience;
  defaultTitle: string;
}) {
  const initial = proposeFor("comunidad", presets, today, lastPublished);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [subtitle, setSubtitle] = useState(initial.subtitle);
  const [presetKey, setPresetKey] = useState(initial.presetKey);
  const [audience, setAudience] = useState<ReportAudience>("comunidad");
  const [title, setTitle] = useState(defaultTitle);

  function applyProposal(p: Proposal) {
    setFrom(p.from);
    setTo(p.to);
    setSubtitle(p.subtitle);
    setPresetKey(p.presetKey);
  }

  function applyPreset(key: string) {
    setPresetKey(key);
    const preset = presets.find((p) => p.key === key);
    if (!preset) return;
    setFrom(preset.from);
    setTo(preset.to);
    setSubtitle(preset.subtitle);
  }

  /** Al cambiar el destinatario se proponen el período de su serie y el
   *  título de ese formato; el título solo si el tesorero no lo tocó: no
   *  le pisamos lo que escribió. */
  function applyAudience(next: ReportAudience) {
    setAudience(next);
    const suggestions = Object.values(DEFAULT_TITLE);
    if (title === "" || suggestions.includes(title)) {
      setTitle(DEFAULT_TITLE[next]);
    }
    applyProposal(proposeFor(next, presets, today, lastPublished));
  }

  // La nota bajo las fechas se deriva del estado, no se guarda: si el
  // tesorero corre el "desde", deja de ser cierto que continúa al anterior.
  const last = lastPublished[audience];
  const continues = last && from === addDays(last.to, 1);
  const upToDate = last && addDays(last.to, 1) > today;

  return (
    <>
      <Field
        label="Destinatario"
        help={TREASURY_HELP.fields.destinatario}
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
        <Field label="Desde" name="period_from" required help={TREASURY_HELP.fields.periodoInforme}>
          <DateInput
            id="period_from"
            name="period_from"
            required
            max={today}
            value={from}
            onValueChange={(v) => {
              setFrom(v);
              setPresetKey("custom");
            }}
          />
        </Field>
        <Field label="Hasta" name="period_to" required>
          <DateInput
            id="period_to"
            name="period_to"
            required
            value={to}
            onValueChange={(v) => {
              setTo(v);
              setPresetKey("custom");
            }}
          />
        </Field>
      </div>

      {last && (
        <p className="mt-2 text-[11.5px] leading-snug text-muted">
          {continues ? (
            <>
              Sigue al último informe emitido para este destinatario
              {last.title ? ` («${last.title}»)` : ""}, que llegó hasta el{" "}
              {formatDate(last.to)}.
            </>
          ) : upToDate ? (
            <>
              El último informe emitido para este destinatario
              {last.title ? ` («${last.title}»)` : ""} ya llega hasta el{" "}
              {formatDate(last.to)}.
            </>
          ) : (
            <>
              El último informe emitido para este destinatario llegó hasta el{" "}
              {formatDate(last.to)}.
            </>
          )}
        </p>
      )}

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
