import { IconSearch } from "@/components/Icons";

/**
 * El cuadro de búsqueda de la Biblioteca, arriba de los segmentos
 * Mensajes / Materiales. Es un formulario GET a /buscar: la persona
 * escribe acá, da Enter y cae en los resultados (la pantalla de búsqueda
 * arranca sola con `?q=`). Sin JavaScript propio, así se puede usar
 * desde una página de servidor.
 */
export function BibliotecaSearchBox() {
  return (
    <form action="/buscar" method="get" className="shrink-0 px-4 pb-1 pt-3">
      <label className="flex items-center gap-2 rounded-2xl bg-card px-3.5 py-2 shadow-card-soft ring-1 ring-black/[0.06] focus-within:ring-gold/40">
        <IconSearch size={16} className="shrink-0 text-muted" />
        <input
          type="search"
          name="q"
          placeholder="Buscar en los Escritos y los mensajes…"
          enterKeyHint="search"
          autoComplete="off"
          maxLength={200}
          minLength={3}
          required
          className="min-w-0 flex-1 bg-transparent py-1 font-body text-[14px] text-dark outline-none placeholder:text-muted/70"
        />
        <button
          type="submit"
          className="tap shrink-0 rounded-xl bg-terra px-3 py-1.5 text-[12px] font-semibold text-white"
        >
          Buscar
        </button>
      </label>
    </form>
  );
}
