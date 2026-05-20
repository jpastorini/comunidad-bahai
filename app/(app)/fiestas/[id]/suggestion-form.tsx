"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { submitSuggestionAction } from "./actions";

type Props = {
  feastId: string;
  feastName: string;
};

export function SuggestionForm({ feastId, feastName }: Props) {
  const search = useSearchParams();
  const sent = search.get("sent") === "1";
  const [showThanks, setShowThanks] = useState(sent);

  useEffect(() => {
    if (sent) {
      setShowThanks(true);
      const t = setTimeout(() => setShowThanks(false), 4500);
      return () => clearTimeout(t);
    }
  }, [sent]);

  return (
    <form
      action={submitSuggestionAction}
      className="rounded-2xl bg-card p-4 shadow-card-soft"
    >
      <input type="hidden" name="feast_id" value={feastId} />

      <div className="mb-2 text-[11px] text-muted">
        Tu sugerencia será leída por los miembros de la Asamblea Local en su
        próxima reunión administrativa.
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5 text-[10.5px] text-muted">
        <span className="rounded bg-bg px-2 py-0.5">
          Fiesta: <strong className="text-dark">{feastName}</strong>
        </span>
        <span className="rounded bg-bg px-2 py-0.5">
          Fecha: <strong className="text-dark">{new Date().toLocaleDateString("es-MX")}</strong>
        </span>
      </div>

      <textarea
        name="detail"
        required
        rows={4}
        placeholder="Escribe tu sugerencia, comentario o propuesta para la Asamblea..."
        className="w-full rounded-xl border border-black/10 bg-bg px-3.5 py-2.5 font-body text-[13px] leading-[1.5] text-dark outline-none placeholder:text-muted focus:border-terra"
      />

      <button
        type="submit"
        className="tap mt-3 w-full rounded-xl bg-terra px-4 py-2.5 text-[13px] font-semibold text-white shadow-card-soft"
      >
        Enviar sugerencia
      </button>

      {showThanks && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">
          ¡Gracias! Tu sugerencia fue enviada a la Asamblea.
        </div>
      )}
    </form>
  );
}
