/**
 * Tema de color de la app.
 *
 * La paleta de tailwind.config.ts ya no son hexadecimales: cada color es
 * una variable CSS (`--c-terra`, `--c-bg`…, definidas en globals.css como
 * tres canales RGB para que sigan andando los modificadores de opacidad,
 * `bg-terra/10`). Un tema es un bloque `[data-theme="…"]` que redefine
 * algunas de esas variables.
 *
 * Igual que el tamaño de letra (lib/ui-zoom.ts), la preferencia es POR
 * DISPOSITIVO: cookie de un año que el layout raíz lee en el servidor
 * para pintar ya con el tema, sin parpadeo. El cliente la cambia al
 * instante con el atributo en <html> y reescribe la cookie.
 *
 * Reglas:
 *  - El DORADO no cambia en ningún tema: es la identidad de la app (y el
 *    color de la barra del sistema y del ícono).
 *  - El acento (`terra`) no puede ser verde pino: ese es el color de la
 *    Asamblea Nacional (tarjeta del comunicado nacional, 057).
 *  - Los documentos (recibos, informes, Libro de Caja, decks, folleto,
 *    boletín público) NO siguen el tema: sus layouts llevan
 *    `data-theme="clasico"`, que repone la paleta original. Si agregás un
 *    documento fuera de los grupos (app) y (panel), envolvelo igual.
 *  - Etapa 1 son temas CLAROS: `card` queda blanco en todos, porque hay
 *    cientos de `bg-white` escritos a mano. El oscuro es la etapa 2.
 */

export const UI_THEME_COOKIE = "cb_theme";

export const UI_THEMES = [
  { id: "clasico", label: "Clásico" },
  { id: "sepia", label: "Sepia" },
  { id: "terracota", label: "Terracota" },
] as const;

export type UiTheme = (typeof UI_THEMES)[number]["id"];

export const DEFAULT_UI_THEME: UiTheme = "clasico";

/** Devuelve un tema válido a partir del valor crudo de la cookie. */
export function parseUiTheme(raw: string | null | undefined): UiTheme {
  return UI_THEMES.find((t) => t.id === raw)?.id ?? DEFAULT_UI_THEME;
}
