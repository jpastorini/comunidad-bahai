"use client";

import { useState } from "react";

/**
 * Filas dinámicas para captura múltiple. Empieza con 5; el usuario puede
 * añadir más con un botón. Las filas vacías se filtran al guardar en el
 * server action.
 */
export function BulkRows() {
  const [count, setCount] = useState(5);

  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="grid gap-3 rounded-xl border border-black/[0.06] bg-bg/40 p-3 md:grid-cols-[180px,1fr]"
        >
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-dark">
              Autor (opcional)
            </label>
            <input
              type="text"
              name="author_name[]"
              placeholder="Familia García"
              className="w-full rounded-lg border border-black/10 bg-card px-3 py-2 text-[13px] outline-none focus:border-terra"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-dark">
              Sugerencia {i + 1}
            </label>
            <textarea
              name="detail[]"
              rows={2}
              placeholder="Proponen organizar una salida al parque para los niños el próximo sábado..."
              className="w-full resize-none rounded-lg border border-black/10 bg-card px-3 py-2 font-body text-[13px] leading-snug outline-none focus:border-terra"
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setCount((c) => c + 3)}
        className="tap self-start rounded-lg border border-dashed border-black/15 px-4 py-2 text-[12px] font-semibold text-muted hover:border-terra hover:bg-bg hover:text-terra"
      >
        + Agregar 3 filas más
      </button>
    </div>
  );
}
