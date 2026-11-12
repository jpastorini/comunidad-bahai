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
 *  - En los temas CLAROS `card` queda blanco.
 *
 * El OSCURO (etapa 2) vale solo en la app del creyente: su paleta se
 * define bajo `html[data-theme="oscuro"]:has(#app-shell)`, así que el
 * panel, el login, la bienvenida y los documentos siguen en clásico sin
 * envolverlos. Lo que hay que saber para no romperlo:
 *  - `dark` es el color del TEXTO y en oscuro se aclara. Un relleno
 *    oscuro fijo es `night`; un negro de verdad (velo de una hoja, visor
 *    de fotos, degradé sobre una foto) es `scrim`.
 *  - `black` de Tailwind también es variable: `border-black/10` y
 *    `bg-black/[0.04]` pasan a blanco translúcido. Por eso un velo NO se
 *    escribe `bg-black/50`.
 *  - Una superficie es `bg-card`, nunca `bg-white` (que queda blanco:
 *    sirve para el QR o la perilla de un interruptor).
 *  - Un color de categoría en hex (`style={{ color }}`) lleva `data-cat`
 *    para aclararse; un caso suelto se resuelve con la variante `dark:`.
 */

export const UI_THEME_COOKIE = "cb_theme";

export const UI_THEMES = [
  { id: "clasico", label: "Clásico" },
  { id: "sepia", label: "Sepia" },
  { id: "terracota", label: "Terracota" },
  { id: "oscuro", label: "Oscuro" },
] as const;

export type UiTheme = (typeof UI_THEMES)[number]["id"];

export const DEFAULT_UI_THEME: UiTheme = "clasico";

/** Devuelve un tema válido a partir del valor crudo de la cookie. */
export function parseUiTheme(raw: string | null | undefined): UiTheme {
  return UI_THEMES.find((t) => t.id === raw)?.id ?? DEFAULT_UI_THEME;
}
