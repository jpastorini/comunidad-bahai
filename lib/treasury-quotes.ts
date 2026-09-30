/**
 * Pasajes sobre los Fondos bahá'ís para el Manual del tesorero.
 *
 * ⚠️ TODOS salen de UNA fuente, copiados textualmente, sin recortar por
 * dentro ni "mejorar": la recopilación «Los Fondos y las contribuciones
 * bahá'ís», preparada por el Departamento de Investigación de la Casa
 * Universal de Justicia (enero de 1970, revisada en enero de 1989),
 * traducción del Panel Internacional de Traducción (29 de septiembre de
 * 2021) de bahai.org/library, que está cargada en la biblioteca de la app
 * (`corpus_chunks`, doc "Los Fondos y las contribuciones bahá'ís"). La
 * referencia va como la trae la recopilación. Salvo que se indique lo
 * contrario, son cartas escritas EN NOMBRE de Shoghi Effendi, y así se
 * atribuyen. Si hace falta otra cita, se toma de ahí o de otro texto del
 * corpus con su referencia; nunca de memoria.
 */

export const QUOTES_SOURCE =
  "Todos los pasajes están tomados textualmente de la recopilación «Los Fondos y las contribuciones bahá'ís», preparada por el Departamento de Investigación de la Casa Universal de Justicia (enero de 1970, revisada en enero de 1989), en la traducción del Panel Internacional de Traducción (2021) de la Biblioteca de Referencia Bahá'í, bahai.org/library. Salvo indicación, los extractos provienen de cartas escritas en nombre de Shoghi Effendi.";

export type TreasuryQuote = {
  key: string;
  text: string;
  /** Quién lo escribió, como lo atribuye la recopilación. */
  author: string;
  /** La referencia tal cual la trae la recopilación. */
  reference: string;
};

export const TREASURY_QUOTES: Record<string, TreasuryQuote> = {
  manantial: {
    key: "manantial",
    text:
      "Debemos ser como el manantial o el venero que se vacía constantemente de todo lo que tiene, y constantemente se llena de una fuente invisible. El ofrecer continuamente para el bien de nuestros semejantes, sin sentirnos intimidados por el miedo a la pobreza, y confiados en la infalible generosidad de la Fuente de toda riqueza y toda bondad: este es el secreto de una vida correcta.",
    author: "Shoghi Effendi",
    reference:
      "Citado en Directrices del Guardián (Terrassa: Editorial Bahá’í de España, 1976), n.º 118, pp. 75-76. Traducción de cita revisada en 2021.",
  },
  voluntarias: {
    key: "voluntarias",
    text:
      "Concerniente a la institución del Fondo Nacional y al sistema presupuestario recogido en las actas de la Asamblea Espiritual Nacional, me siento impelido a recordarles la necesidad de tener siempre presente el principio fundamental de que todas las contribuciones al Fondo deben ser pura y estrictamente voluntarias. Debería hacerse claro y evidente para todos que cualquier forma de coacción, por indirecta y suave que sea, ataca la raíz del principio que subyace a la formación del Fondo desde que fue establecido. Si bien en todas las circunstancias son bienvenidos los llamamientos de carácter general, redactados cuidadosamente y en un tono conmovedor y digno, debería quedar enteramente a la discreción de todo creyente consciente el decidir la naturaleza, el monto y la finalidad de su aportación para la propagación de la Causa.",
    author: "Shoghi Effendi",
    reference:
      "De una carta fechada el 10 de enero de 1926 a una Asamblea Espiritual Nacional, publicada en Bahá’í Administration, p. 101.",
  },
  privacion: {
    key: "privacion",
    text:
      "Respecto a su pregunta sobre las contribuciones destinadas al fondo del Templo, sin duda se debe alentar —e incluso instar— a los amigos a apoyar económicamente a esta institución, igual que a otras instituciones nacionales de la Causa. Sin embargo, bajo ninguna circunstancia se les debe exigir que lo hagan. En cuanto a la idea de «dar lo que uno pueda permitirse», esto de ninguna manera limita o excluye la posibilidad de realizar sacrificios. No puede haber límites a las contribuciones que uno pueda hacer al fondo nacional. Cuanto más se pueda dar, tanto mejor será, sobre todo cuando esos donativos requieran el sacrificio de otras necesidades y deseos por parte del donante. Por supuesto, cuanto más difícil sea el sacrificio, tanto más meritorio será a los ojos de Dios. Porque, al fin y al cabo, no es tanto la cantidad de la donación lo que importa, sino la medida de la privación que resulta de tal ofrecimiento. El espíritu, y no el mero hecho de contribuir, es lo que siempre deberíamos tener en cuenta al subrayar la necesidad de apoyar universal e incondicionalmente a los diversos fondos de la Causa.",
    author: "De una carta escrita en nombre de Shoghi Effendi",
    reference: "31 de diciembre de 1935, a un creyente, publicado en Bahá’í News, n.º 250, diciembre de 1951, p. 1.",
  },
  medida_de_fe: {
    key: "medida_de_fe",
    text:
      "Él desea especialmente que llamen la atención de los creyentes sobre la necesidad de mantener el flujo de sus contribuciones al Templo, y hagan hincapié también en la importancia de la institución del Fondo nacional bahá’í que, en esta etapa temprana del desarrollo administrativo de la Fe, es el medio imprescindible para lograr el crecimiento y la expansión del Movimiento. Las contribuciones a este fondo constituyen, además, una manera práctica y efectiva con la que cada creyente puede comprobar el grado y el carácter de su fe, y demostrar con acciones la intensidad de su devoción y apego a la Causa.",
    author: "De una carta escrita en nombre de Shoghi Effendi",
    reference:
      "25 de septiembre de 1934, a una Asamblea Espiritual Nacional, publicado en Bahá’í News, n.º 88, noviembre de 1934, pp. 1-2.",
  },
  confidencial: {
    key: "confidencial",
    text:
      "No hay objeción alguna a que la Asamblea Espiritual de […] registre los nombres de los contribuyentes y las cantidades recibidas; pero nunca se debe ejercer presión sobre los bahá’ís para que contribuyan; debe ser voluntario y debe considerarse confidencial, a no ser que los amigos mismos quieran mencionarlo abiertamente.",
    author: "De una carta escrita en nombre de Shoghi Effendi",
    reference: "26 de octubre de 1945, a un creyente.",
  },
  sin_deudas: {
    key: "sin_deudas",
    text:
      "Aunque Shoghi Effendi instaría a cada creyente a que sacrificara todo lo que le fuera posible con el fin de contribuir al fondo de la Asamblea Nacional, desaconsejaría que los amigos contrajesen deudas con dicho fin. Se nos pide que demos lo que tenemos, no lo que no poseemos; sobre todo, si esa acción causa sufrimiento a otras personas. En estos asuntos, debemos usar buen juicio y sabiduría, y consultar con franqueza con otros bahá’ís devotos.",
    author: "De una carta escrita en nombre de Shoghi Effendi",
    reference: "4 de mayo de 1932, a un creyente.",
  },
  sin_presion: {
    key: "sin_presion",
    text: "En lo que concierne a las contribuciones, no debemos emplear ningún tipo de coacción, y debemos cerciorarnos claramente del deseo del donante.",
    author: "De puño y letra de Shoghi Effendi",
    reference: "Anexado a una carta fechada el 9 de julio de 1926 escrita en su nombre a un creyente.",
  },
  administracion_juiciosa: {
    key: "administracion_juiciosa",
    text:
      "Las cuestiones económicas a las que la Causa hace frente son muy urgentes e importantes. Requieren una administración juiciosa y un plan de acción prudente. Deberíamos estudiar las necesidades de la Causa, encontrar el campo que rendirá la mayor cosecha, y luego asignar los fondos necesarios. Y esta tarea es ciertamente muy difícil y de muchísima responsabilidad.",
    author: "De una carta escrita en nombre de Shoghi Effendi",
    reference: "19 de diciembre de 1929, a un creyente.",
  },
  sabia_economia: {
    key: "sabia_economia",
    text:
      "Solo a través de una sabia economía, la eliminación de las cosas no esenciales, el enfoque sobre lo esencial y una cuidadosa supervisión, ha logrado el Guardián construir el Santuario y los Archivos Internacionales en el Centro Mundial, y rodear los Lugares Sagrados con lo que, a ojos del público, parecen lujosos jardines pero, en realidad, son el resultado de una planificación rigurosa y económica.",
    author: "De una carta escrita en nombre de Shoghi Effendi",
    reference: "8 de agosto de 1957, a una Asamblea Espiritual Nacional.",
  },
  flexibles: {
    key: "flexibles",
    text: "Debemos ser flexibles en los detalles y rigurosos en los principios; por consiguiente, no desea que su Asamblea emita declaraciones de índole vinculante, a no ser que sea absolutamente necesario.",
    author: "De una carta escrita en nombre de Shoghi Effendi",
    reference: "8 de mayo de 1947, a una Asamblea Espiritual Nacional, publicado en Dawn of a New Day, p. 123.",
  },
  solo_bahais: {
    key: "solo_bahais",
    text:
      "Él desea que les reitere que los creyentes no deben aceptar, bajo ninguna circunstancia, ayuda económica alguna procedente de quienes no son bahá’ís para usos relacionados con actividades administrativas específicas de la Fe, como el fondo de la construcción del Templo y otros fondos administrativos nacionales o locales bahá’ís. La razón de ello es doble: primero, porque las instituciones que los bahá’ís están construyendo paulatinamente son, por su naturaleza, dádivas de Bahá’u’lláh al mundo; y segundo, aceptar dinero de personas que no son creyentes para usos específicamente bahá’ís habrá de ocasionar a los bahá’ís, tarde o temprano, complicaciones y dificultades imprevistas con los demás, y producir así daños incalculables a la Causa.",
    author: "De una carta escrita en nombre de Shoghi Effendi",
    reference: "12 de julio de 1938, a un creyente.",
  },
  anonimos: {
    key: "anonimos",
    text:
      "En cuanto a su pregunta, los amigos pueden entregar sus contribuciones al tesorero, o bien, si desean permanecer anónimos y ofrecer cantidades pequeñas, se puede proporcionar un recipiente en el que depositarlas. La Asamblea Local puede decidir sobre este asunto.",
    author: "De una carta escrita en nombre de Shoghi Effendi",
    reference: "29 de septiembre de 1951, a un creyente.",
  },
  regularidad: {
    key: "regularidad",
    text:
      "... El Guardián aconsejaría a su Asamblea que continúe recalcando a los creyentes la necesidad de que contribuyan regularmente al fondo nacional, independientemente de si hay una emergencia a la que responder o no. Un flujo continuo de contribuciones a ese fondo es lo único que puede, de hecho, asegurar la estabilidad económica de la que debe depender ahora, inevitablemente, buena parte del progreso de las instituciones de la Fe.",
    author: "De una carta escrita en nombre de Shoghi Effendi",
    reference: "29 de julio de 1935, a una Asamblea Espiritual Nacional, publicado en Bahá’í News, n.º 95, octubre de 1935, p. 1.",
  },
};
