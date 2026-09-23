"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Finding, Severity } from "@/lib/treasury-audit";
import { remedyFor } from "@/lib/treasury-audit-remedies";
import { dispatchFindingAction, saveAuditRunAction } from "./actions";

export type FindingRow = Finding & {
  status: "pendiente" | "corregido" | "no_aplica";
  reason: string | null;
  decidedAt: string | null;
};

const SEVERITY_LABEL: Record<Severity, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

const SEVERITY_CHIP: Record<Severity, string> = {
  alta: "bg-rose-50 text-rose-700 border-rose-200",
  media: "bg-amber-50 text-amber-800 border-amber-200",
  baja: "bg-slate-100 text-slate-600 border-slate-200",
};

const SEVERITY_BAR: Record<Severity, string> = {
  alta: "bg-rose-400",
  media: "bg-amber-400",
  baja: "bg-slate-300",
};

/**
 * La lista de hallazgos, agrupada por gravedad, con el despacho de cada
 * uno. El orden lo decide el motor y es estable entre corridas, así que
 * dos auditorías del mismo libro se pueden comparar de arriba abajo.
 */
export function AuditoriaClient({
  pending,
  dispatched,
  counts,
  year,
  years,
  period,
  recent,
}: {
  pending: FindingRow[];
  dispatched: FindingRow[];
  counts: { alta: number; media: number; baja: number };
  year: number;
  years: number[];
  period: { from: string; to: string };
  recent: Array<{ id: string; at: string; total: number; alta: number }>;
}) {
  const router = useRouter();
  const [showDispatched, setShowDispatched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSaveError(null);
    const fd = new FormData();
    fd.set("year", String(year));
    const res = await saveAuditRunAction(fd);
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
    } else setSaveError(res.error);
  }

  const groups: Severity[] = ["alta", "media", "baja"];

  return (
    <div className="space-y-5">
      {/* ── Resumen y controles ── */}
      <div className="rounded-2xl border border-black/[0.04] bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-6">
            <Tally n={counts.alta} label="Alta" tone="text-rose-600" />
            <Tally n={counts.media} label="Media" tone="text-amber-600" />
            <Tally n={counts.baja} label="Baja" tone="text-slate-500" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {years.length > 1 &&
              years.map((y) => (
                <Link
                  key={y}
                  href={`/admin/tesoreria/auditoria?year=${y}`}
                  className={`rounded-full border px-3 py-1 text-[12px] font-semibold ${
                    y === year
                      ? "border-terra bg-terra/10 text-terra"
                      : "border-black/10 text-muted hover:border-terra/40"
                  }`}
                >
                  {y} E.B.
                </Link>
              ))}
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-full border border-black/10 px-3 py-1 text-[12px] font-semibold text-muted hover:border-terra/40 disabled:opacity-50"
            >
              {saving ? "Guardando…" : saved ? "Corrida guardada" : "Guardar esta corrida"}
            </button>
          </div>
        </div>
        <p className="mt-3 text-[12px] text-muted">
          Período auditado: {period.from} → {period.to}.
          {recent.length > 0 && (
            <> Última corrida archivada: {recent[0].at} ({recent[0].total} hallazgos).</>
          )}
        </p>
        {saveError && (
          <p className="mt-2 text-[12px] font-semibold text-rose-600">{saveError}</p>
        )}
      </div>

      {/* ── Hallazgos ── */}
      {pending.length === 0 ? (
        <div className="rounded-2xl border border-black/[0.04] bg-card p-5 shadow-card">
          <p className="py-6 text-center text-[13px] text-muted">
            {dispatched.length > 0
              ? "No queda ningún hallazgo pendiente: todos están despachados."
              : "El libro pasa todas las comprobaciones."}
          </p>
        </div>
      ) : (
        groups.map((sev) => {
          const list = pending.filter((f) => f.severity === sev);
          if (list.length === 0) return null;
          return (
            <section key={sev} className="space-y-2">
              <h2 className="flex items-baseline gap-2 text-[13px] font-semibold text-dark">
                Gravedad {SEVERITY_LABEL[sev].toLowerCase()}
                <span className="text-[12px] font-normal text-muted">
                  {list.length} hallazgo{list.length === 1 ? "" : "s"}
                </span>
              </h2>
              {list.map((f) => (
                <FindingCard key={f.key} f={f} onChanged={() => router.refresh()} />
              ))}
            </section>
          );
        })
      )}

      {/* ── Despachados ── */}
      {dispatched.length > 0 && (
        <section className="space-y-2">
          <button
            type="button"
            onClick={() => setShowDispatched((v) => !v)}
            className="text-[13px] font-semibold text-terra hover:underline"
          >
            {showDispatched ? "Ocultar" : "Ver"} despachados ({dispatched.length})
          </button>
          {showDispatched &&
            dispatched.map((f) => (
              <FindingCard key={f.key} f={f} onChanged={() => router.refresh()} />
            ))}
        </section>
      )}
    </div>
  );
}

function Tally({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div>
      <div className={`text-[26px] font-semibold leading-none tabular-nums ${tone}`}>{n}</div>
      <div className="mt-1 text-[11px] uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}

function FindingCard({ f, onChanged }: { f: FindingRow; onChanged: () => void }) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function dispatchTo(status: "pendiente" | "corregido" | "no_aplica") {
    if (status === "no_aplica" && reason.trim().length < 5) {
      setError("Escribí por qué este hallazgo no aplica.");
      return;
    }
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("key", f.key);
    fd.set("code", f.code);
    fd.set("status", status);
    if (status === "no_aplica") fd.set("reason", reason.trim());
    const res = await dispatchFindingAction(fd);
    setBusy(false);
    if (res.ok) {
      setAsking(false);
      setReason("");
      onChanged();
    } else setError(res.error);
  }

  const done = f.status !== "pendiente";
  // La nota de cómo se arregla es de la CLASE de problema y sale de un
  // mapa por código: un hallazgo despachado no la necesita más, así que
  // solo se muestra mientras está pendiente.
  const remedy = done ? null : remedyFor(f.code);

  return (
    <div
      className={`flex gap-0 overflow-hidden rounded-2xl border border-black/[0.04] bg-card shadow-card ${
        done ? "opacity-70" : ""
      }`}
    >
      <div className={`w-1 shrink-0 ${SEVERITY_BAR[f.severity]}`} />
      <div className="flex-1 p-4 md:p-5">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span
            className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${SEVERITY_CHIP[f.severity]}`}
          >
            {SEVERITY_LABEL[f.severity]}
          </span>
          <span className="rounded border border-black/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted">
            {f.basis}
          </span>
          <code className="font-mono text-[11px] text-terra">{f.code}</code>
        </div>

        <h3 className="text-[15px] font-semibold text-dark">{f.title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">{f.detail}</p>

        {f.entryIds.length > 0 && (
          <p className="mt-2 text-[12px] text-muted">
            Afecta a {f.entryIds.length} movimiento{f.entryIds.length === 1 ? "" : "s"}.{" "}
            <Link
              href={`/admin/tesoreria/libro?ids=${f.entryIds.slice(0, 60).join(",")}`}
              className="font-semibold text-terra hover:underline"
            >
              {f.entryIds.length === 1
                ? "Abrir el movimiento"
                : `Abrir los ${f.entryIds.length} movimientos`}
            </Link>
          </p>
        )}

        {remedy && (
          <div className="mt-3 rounded-xl border border-black/[0.06] bg-bg/50 px-3.5 py-2.5">
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted">
              Cómo se corrige
            </div>
            <p className="text-[12.5px] leading-relaxed text-dark">{remedy.fix}</p>
            {remedy.where && (
              <Link
                href={remedy.where.href}
                className="mt-1.5 inline-block text-[12px] font-semibold text-terra hover:underline"
              >
                {remedy.where.label} →
              </Link>
            )}
          </div>
        )}

        {done && (
          <p className="mt-2 text-[12px] text-muted">
            <strong>
              {f.status === "corregido" ? "Marcado como corregido" : "Marcado como que no aplica"}
            </strong>
            {f.decidedAt ? ` · ${f.decidedAt}` : ""}
            {f.reason ? ` · «${f.reason}»` : ""}
          </p>
        )}

        {/* ── Despacho ── */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {done ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => dispatchTo("pendiente")}
              className="rounded-full border border-black/10 px-3 py-1 text-[12px] font-semibold text-muted hover:border-terra/40 disabled:opacity-50"
            >
              Volver a pendiente
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => dispatchTo("corregido")}
                className="rounded-full border border-black/10 px-3 py-1 text-[12px] font-semibold text-muted hover:border-terra/40 disabled:opacity-50"
              >
                Corregido
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setAsking((v) => !v)}
                className="rounded-full border border-black/10 px-3 py-1 text-[12px] font-semibold text-muted hover:border-terra/40 disabled:opacity-50"
              >
                No aplica…
              </button>
            </>
          )}
        </div>

        {asking && !done && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Por qué no aplica"
              className="min-w-[220px] flex-1 rounded-lg border border-black/10 px-3 py-1.5 text-[13px]"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => dispatchTo("no_aplica")}
              className="rounded-full bg-terra px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
        )}

        {error && <p className="mt-2 text-[12px] font-semibold text-rose-600">{error}</p>}
      </div>
    </div>
  );
}
