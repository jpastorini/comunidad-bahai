/**
 * Plantilla por defecto para Fiestas de los Diecinueve Días.
 *
 * Las oraciones de la sección devocional se eligen al azar de un pool de
 * 40 oraciones autoritativas — ver `lib/feast-prayer-pool.ts`. Así cada
 * vez que una Asamblea carga la plantilla obtiene una combinación
 * diferente para evitar la rutina.
 *
 * Fuente del pool: https://www.bahaiprayers.app/?l=es
 *
 * El tema de profundización y los informes se dejan vacíos a propósito:
 * cada Asamblea debe elegir el texto apropiado para cada Fiesta.
 */

import { pickRandomPrayers, type PoolPrayer } from "./feast-prayer-pool";

export type TemplatePrayer = {
  title: string;
  reference: string;
  body: string;
};

/**
 * Selecciona 4 oraciones al azar del pool. Se invoca cada vez que el
 * admin presiona "Cargar plantilla", garantizando variedad.
 */
export function generateTemplatePrayers(count = 4): TemplatePrayer[] {
  return pickRandomPrayers(count).map((p: PoolPrayer) => ({
    title: p.title,
    reference: p.reference,
    body: p.body,
  }));
}

/**
 * @deprecated Conservado por compatibilidad con código antiguo.
 * Prefiere `generateTemplatePrayers()` para obtener selección al azar.
 */
export const TEMPLATE_PRAYERS: TemplatePrayer[] = generateTemplatePrayers(4);

/** Tema de profundización: vacío a propósito — cada Asamblea elige texto. */
export const TEMPLATE_DEEPENING_THEME = "";

export const TEMPLATE_DEEPENING_CONTENT =
  "[Sugerencia: la Asamblea elige un párrafo de los Escritos bahá'ís o " +
  "de las cartas de la Casa Universal de Justicia.\n\n" +
  "Fuentes recomendadas:\n" +
  "• https://www.bahai.org/es/library/authoritative-texts\n" +
  "• https://www.bahai.org/es/library/messages\n" +
  "• https://reference.bahai.org/es/\n\n" +
  "Borra este texto y reemplázalo con el pasaje elegido + las preguntas " +
  "guía para la reflexión comunitaria.]";

export const TEMPLATE_INTERNATIONAL_REPORTS_PLACEHOLDER =
  "[Resumen de las noticias más recientes de la Comunidad Bahá'í " +
  "Internacional.\n\nFuente sugerida: https://news.bahai.org/]";

export const TEMPLATE_NATIONAL_REPORTS_PLACEHOLDER =
  "[Mensajes y noticias de la Asamblea Espiritual Nacional.]";

export const TEMPLATE_LOCAL_REPORTS_PLACEHOLDER =
  "[Informes de la Asamblea Espiritual Local.\n\n" +
  "Sugerencias de qué incluir:\n" +
  "• Progreso del Plan en el ciclo actual\n" +
  "• Actividades nucleares (estudio, devocionales, clases de niños, prejuniors)\n" +
  "• Preparativos para eventos próximos\n" +
  "• Asuntos administrativos relevantes para la comunidad]";
