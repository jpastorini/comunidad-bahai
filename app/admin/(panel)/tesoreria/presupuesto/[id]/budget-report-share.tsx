"use client";

import { useRef, useState } from "react";
import { BahaiStar } from "@/components/BahaiStar";
import { categoryMeta, fmtUYU } from "@/lib/budget";
import { shareNodeAsImage } from "@/lib/share-image";

export type ReportItem = {
  id: string;
  category: string;
  icon: string;
  planned: number;
  spent: number;
};

type Props = {
  localityName: string;
  period: string;
  items: ReportItem[];
};

export function BudgetReportShare({ localityName, period, items }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  // Solo categorías presupuestadas este año.
  const budgeted = items.filter((i) => i.planned > 0);
  const totalThisYear = budgeted.reduce((s, i) => s + i.planned, 0);
  const totalLastYear = budgeted.reduce((s, i) => s + i.spent, 0);

  const today = new Date().toLocaleDateString("es-UY", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  async function handleShare() {
    if (!cardRef.current || busy) return;
    setBusy(true);
    await shareNodeAsImage(cardRef.current, {
      filename: `presupuesto-${period.replace(/\s+/g, "-").toLowerCase()}.png`,
      title: "Presupuesto",
      text: `Presupuesto ${period} · ${localityName}`,
    });
    setBusy(false);
  }

  if (budgeted.length === 0) {
    return (
      <p className="text-[12px] text-muted">
        Definí y guardá al menos una categoría con presupuesto para poder
        compartir el reporte.
      </p>
    );
  }

  return (
    <div>
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
              Presupuesto
            </h2>
            <div className="relative mt-0.5 text-[12px] text-white/80">
              {period}
            </div>
          </div>

          {/* Totales */}
          <div className="flex items-end justify-between gap-3 border-b border-black/[0.06] px-6 py-4">
            <div>
              <div className="text-[11px] text-muted">Presupuesto este año</div>
              <div className="font-display text-[24px] font-bold leading-tight text-dark">
                {fmtUYU(totalThisYear)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10.5px] text-muted">Año pasado (ref.)</div>
              <div className="text-[14px] font-semibold text-muted">
                {fmtUYU(totalLastYear)}
              </div>
            </div>
          </div>

          {/* Categorías */}
          <div className="flex flex-col gap-3 px-6 py-5">
            {budgeted.map((it) => {
              const meta = categoryMeta(it.icon);
              return (
                <div key={it.id} className="flex items-start gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[17px]"
                    style={{ background: `${meta.color}12` }}
                  >
                    {meta.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-semibold text-dark">
                      {it.category}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted">
                      Año pasado {fmtUYU(it.spent)}
                    </div>
                  </div>
                  <div
                    className="shrink-0 font-display text-[15px] font-bold"
                    style={{ color: meta.color }}
                  >
                    {fmtUYU(it.planned)}
                  </div>
                </div>
              );
            })}
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
