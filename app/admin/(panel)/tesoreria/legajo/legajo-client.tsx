"use client";

import { useState } from "react";
import { Banner, Button, DateInput, Field, Select } from "@/components/admin/ui";
import { formatDate } from "@/lib/format";
import type { DossierFile, DossierManifest } from "@/lib/treasury-dossier";

export type PeriodOption = { key: string; label: string; from: string; to: string };

type Phase =
  | { step: "idle" }
  | { step: "manifest" }
  | { step: "download"; done: number; total: number; current: string }
  | { step: "zip" }
  | { step: "ready"; manifest: DossierManifest; failed: string[]; size: number }
  | { step: "error"; message: string };

const OTHER = "otro";
const CONCURRENCY = 4;

/**
 * Baja el manifiesto, después cada archivo (de a cuatro), comprime con
 * jszip y dispara la descarga. Lo que no se pudo bajar queda listado en
 * un ERRORES.txt dentro del ZIP y en pantalla: un legajo con un
 * comprobante menos sirve; uno que no se llega a bajar, no.
 */
export function LegajoClient({
  options,
  today,
  localityName,
}: {
  options: PeriodOption[];
  today: string;
  localityName: string;
}) {
  const [choice, setChoice] = useState(options[0]?.key ?? OTHER);
  const [from, setFrom] = useState(options[0]?.from ?? "");
  const [to, setTo] = useState(options[0]?.to ?? today);
  const [phase, setPhase] = useState<Phase>({ step: "idle" });

  const busy = phase.step === "manifest" || phase.step === "download" || phase.step === "zip";
  const range = choice === OTHER ? { from, to } : options.find((o) => o.key === choice) ?? { from, to };
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(range.from) && /^\d{4}-\d{2}-\d{2}$/.test(range.to) && range.from <= range.to;

  function pick(key: string) {
    setChoice(key);
    const o = options.find((x) => x.key === key);
    if (o) {
      setFrom(o.from);
      setTo(o.to);
    }
  }

  async function run() {
    if (!valid || busy) return;
    setPhase({ step: "manifest" });
    try {
      const res = await fetch(
        `/admin/tesoreria/legajo/manifest?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
        { credentials: "same-origin", cache: "no-store" }
      );
      const body = (await res.json()) as DossierManifest | { error: string };
      if (!res.ok || "error" in body) {
        setPhase({ step: "error", message: "error" in body ? body.error : `Error ${res.status}` });
        return;
      }
      const manifest = body;
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();

      const urls = manifest.files.filter((f): f is Extract<DossierFile, { kind: "url" }> => f.kind === "url");
      for (const f of manifest.files) {
        if (f.kind === "text") zip.file(f.path, f.content);
      }

      const failed: string[] = [];
      let done = 0;
      setPhase({ step: "download", done, total: urls.length, current: "" });
      const queue = [...urls];
      const worker = async () => {
        for (;;) {
          const f = queue.shift();
          if (!f) return;
          setPhase({ step: "download", done, total: urls.length, current: f.path.split("/").slice(1).join("/") });
          try {
            const r = await fetch(f.url, {
              credentials: f.url.startsWith("/") ? "same-origin" : "omit",
              cache: "no-store",
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            zip.file(f.path, await r.blob());
          } catch (e) {
            failed.push(`${f.path.split("/").slice(1).join("/")} — ${e instanceof Error ? e.message : "error"}`);
          } finally {
            done++;
            setPhase({ step: "download", done, total: urls.length, current: "" });
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length || 1) }, worker));

      if (failed.length > 0) {
        zip.file(
          `${manifest.folder}/ERRORES.txt`,
          "﻿" +
            [
              "Archivos que no se pudieron bajar al armar el legajo. Están en la app; volvé a armarlo o bajalos a mano.",
              "",
              ...failed,
            ].join("\r\n")
        );
      }

      setPhase({ step: "zip" });
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${manifest.folder}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
      setPhase({ step: "ready", manifest, failed, size: blob.size });
    } catch (e) {
      setPhase({ step: "error", message: e instanceof Error ? e.message : "No se pudo armar el legajo." });
    }
  }

  return (
    <div>
      <h2 className="font-display text-[20px] font-semibold text-dark">Preparar el legajo</h2>
      <p className="mt-1 text-[12.5px] text-muted">
        Elegí el período. El ZIP se arma en este navegador y se descarga solo; según cuántos
        comprobantes haya, puede tardar un minuto.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_170px_170px]">
        <Field label="Período" name="periodo">
          <Select id="periodo" value={choice} onChange={(e) => pick(e.target.value)} disabled={busy}>
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
            <option value={OTHER}>Otro rango de fechas…</option>
          </Select>
        </Field>
        <Field label="Desde" name="from">
          <DateInput id="from" value={range.from} onValueChange={(v) => { setChoice(OTHER); setFrom(v); }} disabled={busy} />
        </Field>
        <Field label="Hasta" name="to">
          <DateInput id="to" value={range.to} onValueChange={(v) => { setChoice(OTHER); setTo(v); }} disabled={busy} />
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={run} disabled={!valid || busy}>
          {busy ? "Armando…" : "Preparar y descargar el legajo"}
        </Button>
        {valid && (
          <span className="text-[12px] text-muted">
            {formatDate(range.from)} a {formatDate(range.to)} · {localityName}
          </span>
        )}
      </div>

      <div className="mt-4">
        {phase.step === "manifest" && <Progress label="Armando el índice y los CSV…" />}
        {phase.step === "download" && (
          <Progress
            label={`Bajando archivos: ${phase.done} de ${phase.total}${phase.current ? ` · ${phase.current}` : ""}`}
            ratio={phase.total ? phase.done / phase.total : 0}
          />
        )}
        {phase.step === "zip" && <Progress label="Comprimiendo…" ratio={1} />}
        {phase.step === "error" && <Banner tone="danger">{phase.message}</Banner>}
        {phase.step === "ready" && (
          <div className="flex flex-col gap-3">
            <Banner tone="info">
              <strong>Listo.</strong> {phase.manifest.folder}.zip ({(phase.size / 1024 / 1024).toFixed(1)} MB):{" "}
              {phase.manifest.counts.entries} movimientos, {phase.manifest.counts.months}{" "}
              {phase.manifest.counts.months === 1 ? "mes" : "meses"} de Libro de Caja,{" "}
              {phase.manifest.counts.attachments} comprobantes, {phase.manifest.counts.statements} extractos.
              Si la descarga no arrancó sola, revisá el bloqueo de descargas del navegador.
            </Banner>
            {phase.manifest.warnings.length > 0 && (
              <Banner tone="warning">
                <strong>Avisos del legajo</strong> (también están en el LEEME):
                <ul className="mt-1 list-disc pl-5">
                  {phase.manifest.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </Banner>
            )}
            {phase.failed.length > 0 && (
              <Banner tone="danger">
                <strong>{phase.failed.length === 1 ? "Un archivo no se pudo bajar" : `${phase.failed.length} archivos no se pudieron bajar`}</strong>{" "}
                y no están en el ZIP (quedaron listados en ERRORES.txt). Probá de nuevo o bajalos a mano desde el Libro.
                <ul className="mt-1 list-disc pl-5">
                  {phase.failed.slice(0, 10).map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </Banner>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Progress({ label, ratio }: { label: string; ratio?: number }) {
  return (
    <div>
      <div className="text-[12.5px] text-dark">{label}</div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
        <div
          className={`h-full rounded-full bg-terra transition-[width] ${ratio === undefined ? "w-1/4 animate-pulse" : ""}`}
          style={ratio === undefined ? undefined : { width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
    </div>
  );
}
