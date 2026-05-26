"use client";

import { useRef, useState } from "react";
import { BahaiStar } from "@/components/BahaiStar";
import { shareNodeAsImage } from "@/lib/share-image";

type Props = {
  localityName: string;
  period: string;
  goalAmount: number;
  currentAmount: number;
  contributions: { label: string; amount: number }[];
  methods: { type: string; description: string; letter: string }[];
};

const fmt = (n: number) =>
  n.toLocaleString("es-UY", {
    style: "currency",
    currency: "UYU",
    maximumFractionDigits: 0,
  });

export function MonthlyReportShare({
  localityName,
  period,
  goalAmount,
  currentAmount,
  contributions,
  methods,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const pct =
    goalAmount > 0
      ? Math.max(0, Math.min(100, Math.round((currentAmount / goalAmount) * 100)))
      : 0;
  const r = 34;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  const today = new Date().toLocaleDateString("es-UY", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  async function handleShare() {
    if (!cardRef.current || busy) return;
    setBusy(true);
    await shareNodeAsImage(cardRef.current, {
      filename: `tesoreria-${period.replace(/\s+/g, "-").toLowerCase()}.png`,
      title: "Reporte de Tesorería",
      text: `Reporte de Tesorería · ${localityName} · ${period}`,
    });
    setBusy(false);
  }

  return (
    <div>
      {/* Tarjeta capturada */}
      <div className="mx-auto w-full max-w-[400px]">
        <div
          ref={cardRef}
          className="overflow-hidden rounded-[20px] bg-card shadow-card"
        >
          {/* Header dorado */}
          <div className="relative overflow-hidden bg-gold-grad px-6 pb-6 pt-7 text-white">
            <div className="pointer-events-none absolute -right-5 top-1 opacity-[0.12]">
              <BahaiStar size={120} color="#fff" />
            </div>
            <div className="relative text-[10px] font-semibold uppercase tracking-[2.5px] text-white/70">
              {localityName}
            </div>
            <h2 className="relative mt-1 font-display text-[24px] font-bold leading-tight">
              Reporte de Tesorería
            </h2>
            <div className="relative mt-0.5 text-[12px] text-white/80">
              {period}
            </div>
          </div>

          {/* Cuerpo */}
          <div className="px-6 py-5">
            {/* Progreso del fondo */}
            <div className="flex items-center gap-4">
              <svg width="84" height="84" className="shrink-0">
                <circle cx="42" cy="42" r={r} fill="none" stroke="#7E44B818" strokeWidth="8" />
                <circle
                  cx="42"
                  cy="42"
                  r={r}
                  fill="none"
                  stroke="#7E44B8"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  strokeDashoffset={offset}
                  transform="rotate(-90 42 42)"
                />
                <text
                  x="42"
                  y="42"
                  textAnchor="middle"
                  dy="0.35em"
                  fill="#2A2833"
                  fontSize="16"
                  fontWeight="800"
                >
                  {pct}%
                </text>
              </svg>
              <div className="min-w-0">
                <div className="font-display text-[22px] font-bold leading-tight text-dark">
                  {fmt(currentAmount)}
                </div>
                <div className="text-[12px] text-muted">
                  de {fmt(goalAmount)} · meta del fondo
                </div>
              </div>
            </div>

            {/* Movimientos del mes */}
            {contributions.length > 0 && (
              <div className="mt-5">
                <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-gold-dark">
                  Movimientos del mes
                </h3>
                <div className="rounded-xl bg-bg/50 px-3.5 py-1">
                  {contributions.map((row, i) => (
                    <div
                      key={`${row.label}-${i}`}
                      className={`flex items-center justify-between py-2 ${
                        i < contributions.length - 1
                          ? "border-b border-black/[0.05]"
                          : ""
                      }`}
                    >
                      <span className="text-[12px] text-dark">{row.label}</span>
                      <span className="text-[12.5px] font-semibold text-dark">
                        {fmt(row.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cómo aportar */}
            {methods.length > 0 && (
              <div className="mt-5">
                <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-gold-dark">
                  Cómo aportar
                </h3>
                <div className="flex flex-col gap-2">
                  {methods.map((m, i) => (
                    <div key={`${m.type}-${i}`} className="flex items-start gap-2.5">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display text-[14px] font-bold text-terra"
                        style={{ background: "#2A3F8F12" }}
                      >
                        {m.letter}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-semibold text-dark">
                          {m.type}
                        </div>
                        <div className="text-[11px] leading-snug text-muted">
                          {m.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-black/[0.06] px-6 py-3">
            <span className="text-[10px] text-muted">Generado el {today}</span>
            <span className="flex items-center gap-1 text-[10px] font-semibold text-gold-dark">
              <BahaiStar size={11} color="#96790E" />
              Comunidad Bahá'í
            </span>
          </div>
        </div>
      </div>

      {/* Acción */}
      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={handleShare}
          disabled={busy}
          className="tap inline-flex items-center gap-2 rounded-xl bg-terra px-5 py-2.5 text-[13px] font-semibold text-white shadow-card-soft transition hover:bg-terra-light disabled:opacity-60"
        >
          {busy ? "Generando…" : "Compartir imagen"}
        </button>
      </div>
    </div>
  );
}
