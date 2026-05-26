/**
 * Lógica de dominio del presupuesto de Tesorería, compartida entre el
 * editor admin (app/admin/.../presupuesto) y la vista de miembros
 * (app/(app)/tesoreria).
 *
 * La columna `icon` de treasury_budget_items guarda una clave semántica
 * (ej. "ensenanza"), no un emoji, para que la UI pueda cambiar el ícono
 * sin migrar datos. Acá mapeamos esa clave a label/emoji/color/hint.
 *
 * Las categorías personalizadas se guardan con icon = "default".
 */

export type BudgetCategoryMeta = {
  label: string;
  emoji: string;
  color: string;
  hint: string;
};

export const CATEGORY_META: Record<string, BudgetCategoryMeta> = {
  ensenanza: {
    label: "Enseñanza",
    emoji: "📖",
    color: "#2A3F8F",
    hint: "Plan, campañas de enseñanza, viajes",
  },
  mantenimiento: {
    label: "Mantenimiento",
    emoji: "🏠",
    color: "#6A8B5F",
    hint: "Ḥaẓíratu'l-Quds, Centro Bahá'í, alquiler, servicios",
  },
  administrativas: {
    label: "Tareas Administrativas",
    emoji: "📋",
    color: "#96790E",
    hint: "Papelería, correo, impresiones, sellos",
  },
  ayuda_social: {
    label: "Ayuda Social",
    emoji: "🤝",
    color: "#C2185B",
    hint: "Asistencia a miembros, acciones humanitarias",
  },
  fondo_nacional: {
    label: "Aporte al Fondo Nacional",
    emoji: "🏛️",
    color: "#7E44B8",
    hint: "Contribución periódica a la AEN",
  },
  fondo_local: {
    label: "Reserva Fondo Local",
    emoji: "🏦",
    color: "#00796B",
    hint: "Fondo de reserva / emergencia",
  },
  default: {
    label: "Categoría",
    emoji: "📌",
    color: "#607D8B",
    hint: "Categoría personalizada",
  },
};

export function categoryMeta(icon: string | null | undefined): BudgetCategoryMeta {
  return CATEGORY_META[icon ?? "default"] ?? CATEGORY_META.default;
}

/** Formato de moneda uruguaya, sin decimales (consistente con Tesorería). */
export function fmtUYU(n: number): string {
  return n.toLocaleString("es-UY", {
    style: "currency",
    currency: "UYU",
    maximumFractionDigits: 0,
  });
}
