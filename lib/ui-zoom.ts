/**
 * Tamaño de letra global ("zoom de la app").
 *
 * Pedido de los creyentes que no ven claro el UI: una preferencia que
 * agrande TODA la app, no solo las lecturas. Se implementa con `zoom` en
 * <html> (ver globals.css) y no con font-size, porque hay cientos de
 * clases con píxeles fijos que no escalarían, y porque agrandar solo el
 * texto dentro de botones que no crecen rompe más de lo que arregla.
 * `zoom` escala letra, íconos y zonas de toque en proporción, que es lo
 * que hace el ajuste "Tamaño de pantalla" del propio celular.
 *
 * La preferencia es POR DISPOSITIVO (decisión del usuario, 2026-09-06):
 * viaja en una cookie de un año que el layout raíz lee en el servidor
 * para renderizar ya escalado, sin salto al cargar. El cliente la cambia
 * al instante con la variable CSS y reescribe la cookie.
 *
 * ⚠️ `zoom` también escala las unidades de viewport: `100dvh` a zoom
 * 1.3 mide 130 % de la pantalla. Por eso todo vh/dvh de la app va
 * dividido por `var(--ui-zoom, 1)`, igual que las variables de zona
 * segura. Si agregás una altura en vh, dividila.
 */

export const UI_ZOOM_COOKIE = "cb_ui_zoom";

export const UI_ZOOM_LEVELS = [
  { zoom: 1, label: "Normal" },
  { zoom: 1.15, label: "Grande" },
  { zoom: 1.3, label: "Muy grande" },
] as const;

export const DEFAULT_UI_ZOOM = 1;

/** Devuelve un nivel válido a partir del valor crudo de la cookie. */
export function parseUiZoom(raw: string | null | undefined): number {
  const n = Number(raw);
  return UI_ZOOM_LEVELS.some((l) => l.zoom === n) ? n : DEFAULT_UI_ZOOM;
}
