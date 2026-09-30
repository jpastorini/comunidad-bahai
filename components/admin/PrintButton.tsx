"use client";

/** Un botón que imprime la página (o la guarda como PDF desde el diálogo
 *  del navegador). La página decide qué se imprime con su propio CSS. */
export function PrintButton({ label = "Imprimir / Guardar PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="tap cb-noprint rounded-xl bg-terra px-4 py-2 text-[13px] font-semibold text-white shadow-card-soft hover:bg-terra-light"
    >
      {label}
    </button>
  );
}
