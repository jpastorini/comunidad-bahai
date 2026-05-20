/**
 * Plantilla por defecto para Fiestas de los Diecinueve Días.
 * Cuando una Asamblea Local nueva (o cualquiera) crea una Fiesta,
 * puede cargar esta plantilla como punto de partida.
 *
 * Las oraciones son breves selecciones de uso común en la comunidad
 * bahá'í. El admin puede editarlas, agregar o quitar antes de la Fiesta.
 */

export type TemplatePrayer = {
  title: string;
  reference: string;
  body: string;
};

export const TEMPLATE_PRAYERS: TemplatePrayer[] = [
  {
    title: "Oración de apertura",
    reference: "Bahá'u'lláh",
    body:
      "¡Oh Tú, oh Señor mío! Te doy gracias porque me has identificado " +
      "con Tu Causa y me has permitido beber de los manantiales de Tu " +
      "santidad. Concédeme que pueda ser firme en Tu Convenio y constante " +
      "en Tu servicio.",
  },
  {
    title: "Oración por la unidad",
    reference: "ʻAbdu'l-Bahá",
    body:
      "¡Oh Tú, Señor amantísimo! Une a todos. Que las religiones concuerden " +
      "y las naciones se hagan una sola, para que se vean unos a otros como " +
      "una familia y a toda la Tierra como un solo hogar.",
  },
  {
    title: "Oración por la humanidad",
    reference: "Bahá'u'lláh",
    body:
      "¡Oh Señor mío, Bienamado mío! Manifiesta, te suplico, lo que has " +
      "ocultado en los tesoros de Tu sabiduría y en los receptáculos de Tu " +
      "conocimiento, para que Tus siervos puedan reconocerte y comprenderte.",
  },
  {
    title: "Oración de despedida",
    reference: "ʻAbdu'l-Bahá",
    body:
      "¡Oh Dios! Refresca y alegra mi espíritu. Purifica mi corazón. " +
      "Ilumina mis poderes. Pongo todos mis asuntos en Tus manos. " +
      "Tú eres mi Guía y mi Refugio.",
  },
];

export const TEMPLATE_DEEPENING_THEME =
  "La Fiesta de los Diecinueve Días — corazón espiritual de la comunidad";

export const TEMPLATE_DEEPENING_CONTENT =
  "La Fiesta de los Diecinueve Días, instituida por Bahá'u'lláh y elaborada " +
  "por ʻAbdu'l-Bahá, es el corazón espiritual de la vida comunitaria bahá'í. " +
  "Tres partes la conforman: devocional, administrativa y social. Es un " +
  "espacio donde la comunidad se nutre de las palabras del Bienamado, " +
  "consulta sobre los asuntos del Plan, y comparte la fraternidad.\n\n" +
  "Reflexionemos: ¿Cómo podemos cada uno contribuir a que nuestra Fiesta " +
  "sea cada vez más rica espiritualmente y más unida?";

export const TEMPLATE_INTERNATIONAL_REPORTS_PLACEHOLDER =
  "Noticias internacionales de la Comunidad Bahá'í — pendiente actualización.\n\n" +
  "Sugerencia: visita https://news.bahai.org/ y resume las 3 noticias más " +
  "recientes para compartir con la comunidad.";

export const TEMPLATE_NATIONAL_REPORTS_PLACEHOLDER =
  "Informes de la Asamblea Espiritual Nacional — pendiente actualización.";

export const TEMPLATE_LOCAL_REPORTS_PLACEHOLDER =
  "Informes de la Asamblea Espiritual Local — pendiente actualización.\n\n" +
  "Incluir: progreso del Plan, actividades nucleares (estudio, devocionales, " +
  "clases de niños, prejuniors), preparativos para eventos próximos.";
