/**
 * Plantilla por defecto para Fiestas de los Diecinueve Días.
 *
 * Las oraciones que siguen son textos autoritativos de Bahá'u'lláh y
 * ʻAbdu'l-Bahá, obtenidos de bahaiprayers.app (categoría "Asamblea
 * Espiritual" + apertura general). Son las oraciones que la propia
 * literatura bahá'í recomienda para reuniones espirituales.
 *
 * Fuente: https://www.bahaiprayers.app/?l=es
 * Si encuentras una traducción más reciente o autorizada, actualiza este
 * archivo o pide a la Asamblea que edite el texto en la app antes de la
 * Fiesta.
 *
 * El tema y contenido de profundización se dejan vacíos a propósito: cada
 * Asamblea debe elegir un texto de los Escritos o de las cartas de la
 * Casa Universal de Justicia para reflexionar en cada Fiesta.
 */

export type TemplatePrayer = {
  title: string;
  reference: string;
  body: string;
};

export const TEMPLATE_PRAYERS: TemplatePrayer[] = [
  {
    title: "Bendito es el sitio",
    reference: "Bahá'u'lláh",
    body:
      "Bendito es el sitio, y la casa, y el lugar, y la ciudad, y el corazón, " +
      "y la montaña, y el refugio, y la cueva, y el valle, y la tierra, y el " +
      "mar, y la isla y la pradera, donde se ha hecho mención de Dios y se " +
      "ha glorificado Su alabanza.",
  },
  {
    title: "Para reuniones espirituales — apertura",
    reference: "ʻAbdu'l-Bahá",
    body:
      "¡Oh Señor del Reino! Aunque nuestros cuerpos están aquí reunidos, " +
      "nuestros corazones cautivos se ven transportados por Tu amor, y nos " +
      "sentimos extasiados por los rayos de Tu faz resplandeciente. Aunque " +
      "somos débiles, esperamos las revelaciones de Tu fuerza y Tu poder. " +
      "Aunque somos pobres, sin bienes ni recursos, recibimos riqueza de los " +
      "tesoros de Tu Reino. Aunque somos gotas, nos surtimos de las " +
      "profundidades de Tu océano. Aunque somos motas de polvo, brillamos en " +
      "la gloria de Tu Sol radiante.\n\n" +
      "¡Oh Tú que eres nuestro Proveedor! Haz descender Tu ayuda para que " +
      "cada uno de los aquí reunidos se convierta en un cirio encendido, " +
      "cada uno llegue a ser un centro de atracción, un emplazador a Tus " +
      "reinos celestiales, hasta que finalmente hagamos de este mundo " +
      "inferior el reflejo fiel de Tu Paraíso.",
  },
  {
    title: "Oración consultiva — para entrar en la cámara del consejo",
    reference: "ʻAbdu'l-Bahá",
    body:
      "Cuando entréis en la cámara del consejo, recitad esta oración con el " +
      "corazón palpitante de amor a Dios y la lengua purificada de todo lo " +
      "que no sea Su recuerdo, para que el Todopoderoso os ayude " +
      "bondadosamente a lograr la victoria suprema.\n\n" +
      "¡Oh Dios, mi Dios! Somos siervos Tuyos que nos hemos vuelto con " +
      "devoción hacia Tu Santo Rostro, y nos hemos desprendido de todo menos " +
      "de Ti en este glorioso Día. Nos hemos reunido en esta Asamblea " +
      "Espiritual, unidos en nuestros pareceres y pensamientos, armonizando " +
      "nuestros propósitos para exaltar Tu Palabra entre la humanidad. ¡Oh " +
      "Señor, nuestro Dios! Haz de nosotros señales de Tu Guía divina, " +
      "estandartes de Tu exaltada Fe entre las gentes, siervos de Tu " +
      "poderosa Alianza, oh nuestro Altísimo Señor, manifestaciones de Tu " +
      "divina Unidad en Tu Reino de Abhá y estrellas resplandecientes que " +
      "brillan sobre todas las regiones. ¡Señor! Ayúdanos a convertirnos en " +
      "mares que se agitan con las olas de Tu maravillosa Gracia, arroyos " +
      "que fluyen desde Tus Alturas todogloriosas, frutos excelentes del " +
      "Árbol de Tu Causa empírea, árboles que se mecen en Tu Viña celestial " +
      "con las brisas de Tu Munificencia. ¡Oh Dios! Haz que nuestras almas " +
      "dependan de los Versículos de Tu divina Unidad, que nuestros " +
      "corazones se regocijen con las efusiones de Tu Gracia, para que nos " +
      "unamos como las olas de un solo mar y nos fundamos como los rayos de " +
      "Tu Luz resplandeciente; para que nuestros pensamientos, nuestros " +
      "pareceres y nuestros sentimientos se conviertan en una sola realidad " +
      "que manifieste el espíritu de unión por todo el mundo. Tú eres el " +
      "Magnánimo, el Munífico, el Conferidor, el Todopoderoso, el " +
      "Misericordioso, el Compasivo.",
  },
  {
    title: "Para reuniones espirituales — cierre",
    reference: "ʻAbdu'l-Bahá",
    body:
      "¡Oh Dios! ¡Oh Dios! Desde el reino invisible de Tu unicidad, henos " +
      "aquí reunidos en esta reunión espiritual, creyendo en Ti, confiando " +
      "en Tus señales, firmes en Tu Alianza y Testamento, atraídos hacia " +
      "Ti, encendidos con el fuego de Tu amor y leales a Tu Causa. Somos " +
      "siervos de Tu viña, propagadores de Tu religión, fieles adoradores " +
      "de Tu semblante, humildes ante Tus amados, sumisos ante Tu puerta, " +
      "implorándote que nos confirmes en el servicio a Tus elegidos, que " +
      "nos sostengas con Tus huestes invisibles, nos fortalezcas en Tu " +
      "servidumbre y nos conviertas en siervos sumisos y devotos en " +
      "comunión contigo.\n\n" +
      "¡Oh Señor nuestro! Somos débiles y Tú eres el Fuerte, el Poderoso. " +
      "Estamos sin vida, y Tú eres el gran Espíritu vivificador. Estamos " +
      "necesitados, y Tú eres el Sustentador, el Poderoso.\n\n" +
      "¡Oh Señor nuestro! Vuelve nuestros rostros hacia Tu semblante " +
      "compasivo, aliméntanos de Tu mesa celestial con Tu abundante gracia, " +
      "ayúdanos con las huestes de Tus ángeles supremos y confírmanos " +
      "mediante los seres santos del Reino de Abhá.\n\n" +
      "Verdaderamente, Tú eres el Generoso, el Misericordioso. Tú eres el " +
      "Poseedor de gran munificencia y, en verdad, Tú eres el Clemente y " +
      "el Magnánimo.",
  },
];

/** Tema de profundización: vacío a propósito — cada Asamblea debe elegir
 *  un texto de los Escritos para reflexionar en cada Fiesta. */
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
