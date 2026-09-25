"use client";

import { Select } from "@/components/admin/ui";

/**
 * Varios rubros del libro para una línea del presupuesto (067) o una meta
 * (068): chapitas que se sacan con × y un desplegable que AGREGA (y vuelve
 * a "Agregar un rubro…").
 *
 * Por qué así y no otra cosa: un <select multiple> nativo es inusable en
 * el celular, y un desplegable que REEMPLAZA su valor cambia de rubro con
 * la rueda del mouse sin que nadie lo note — es justo como las líneas del
 * presupuesto 183 quedaron vinculadas a rubros sin gastos.
 *
 * Referencias: "fund:<id>", "cat:<id>", "sub:<id>". Cada una viaja en un
 * hidden `name` con el valor `<prefix>|<ref>`.
 *
 * Con `funds`, se mide por FONDOS o por RUBROS, nunca las dos cosas (un
 * gasto que está en el fondo y en la categoría se contaría dos veces): al
 * elegir de un grupo, el otro deja de ofrecerse.
 */

export type LedgerPickerOptions = {
  funds?: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  subcategories: { id: string; name: string; category_id: string }[];
};

export function LedgerLinksPicker({
  refs,
  onChange,
  options,
  name,
  prefix,
  label = "Se ejecuta con",
  hint = "movimientos del libro · uno o varios",
  emptyNote,
}: {
  refs: string[];
  onChange: (refs: string[]) => void;
  options: LedgerPickerOptions;
  name: string;
  prefix: string;
  label?: string;
  hint?: string;
  emptyNote?: string;
}) {
  const fundName = new Map((options.funds ?? []).map((f) => [f.id, f.name]));
  const catName = new Map(options.categories.map((c) => [c.id, c.name]));
  const subs = new Map(options.subcategories.map((s) => [s.id, s]));
  const chosen = new Set(refs);
  const chosenCats = new Set(refs.filter((r) => r.startsWith("cat:")).map((r) => r.slice(4)));

  const hasFunds = refs.some((r) => r.startsWith("fund:"));
  const hasRubros = refs.some((r) => r.startsWith("cat:") || r.startsWith("sub:"));
  const offerFunds = Boolean(options.funds) && !hasRubros;
  const offerRubros = !hasFunds;

  const describe = (ref: string) => {
    const id = ref.slice(ref.indexOf(":") + 1);
    if (ref.startsWith("fund:")) return { name: fundName.get(id) ?? "Fondo ya no disponible", note: "fondo" };
    if (ref.startsWith("cat:")) return { name: catName.get(id) ?? "Rubro ya no disponible", note: "categoría entera" };
    const sub = subs.get(id);
    return {
      name: sub?.name ?? "Rubro ya no disponible",
      note: sub ? (catName.get(sub.category_id) ?? "") : "",
    };
  };

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-semibold text-dark">{label}</span>
        <span className="text-[10.5px] text-muted">{hint}</span>
      </div>

      {refs.map((ref) => (
        <input key={ref} type="hidden" name={name} value={`${prefix}|${ref}`} />
      ))}

      {refs.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {refs.map((ref) => {
            const d = describe(ref);
            const sub = ref.startsWith("sub:") ? subs.get(ref.slice(4)) : undefined;
            // Una subcategoría de una categoría ya elegida no suma nada:
            // sus movimientos ya están en la categoría.
            const redundant = Boolean(sub && chosenCats.has(sub.category_id));
            return (
              <span
                key={ref}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] ${
                  redundant
                    ? "border-amber-300 bg-amber-50 text-amber-800"
                    : "border-terra/20 bg-terra/[0.06] text-dark"
                }`}
                title={redundant ? "Ya está incluida en la categoría elegida" : undefined}
              >
                <span className="font-medium">{d.name}</span>
                {d.note && <span className="text-[10.5px] text-muted">{d.note}</span>}
                <button
                  type="button"
                  aria-label={`Quitar ${d.name}`}
                  className="ml-0.5 text-[14px] leading-none text-muted hover:text-rose-700"
                  onClick={() => onChange(refs.filter((r) => r !== ref))}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      <Select
        value=""
        onChange={(e) => {
          const v = e.target.value;
          if (v && !chosen.has(v)) onChange([...refs, v]);
        }}
      >
        <option value="">{refs.length > 0 ? "+ Agregar otro…" : "+ Agregar un rubro…"}</option>
        {offerFunds && (
          <optgroup label="Fondos">
            {(options.funds ?? [])
              .filter((f) => !chosen.has(`fund:${f.id}`))
              .map((f) => (
                <option key={f.id} value={`fund:${f.id}`}>
                  {f.name}
                </option>
              ))}
          </optgroup>
        )}
        {offerRubros && (
          <optgroup label="Categorías enteras">
            {options.categories
              .filter((c) => !chosen.has(`cat:${c.id}`))
              .map((c) => (
                <option key={c.id} value={`cat:${c.id}`}>
                  {c.name}
                </option>
              ))}
          </optgroup>
        )}
        {offerRubros &&
          options.categories.map((c) => {
            const children = options.subcategories.filter(
              (s) => s.category_id === c.id && !chosen.has(`sub:${s.id}`)
            );
            if (children.length === 0) return null;
            return (
              <optgroup key={c.id} label={c.name}>
                {children.map((s) => (
                  <option key={s.id} value={`sub:${s.id}`}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            );
          })}
      </Select>

      {options.funds && (hasFunds || hasRubros) && (
        <p className="mt-1 text-[11px] text-muted">
          {hasFunds
            ? "Se mide por fondos. Para medir por categorías, quitá los fondos."
            : "Se mide por categorías. Para medir por fondos, quitá las categorías."}
        </p>
      )}
      {refs.length === 0 && emptyNote && (
        <p className="mt-1 text-[11px] italic text-muted">{emptyNote}</p>
      )}
    </div>
  );
}
