/**
 * Pool de 20 temas de profundización para la Fiesta de los Diecinueve Días.
 *
 * Fuente: "Fuente de Todo Bien, La" — compilación de Reed Chandler
 * para la Asamblea Espiritual Nacional de los Bahá'ís de Chile (1991).
 * https://bahai-library.com/reed_fuente_todo_bien
 *
 * Cada tema incluye 3 citas autoritativas + preguntas de reflexión
 * sugeridas. La Asamblea Local puede editar todo después de cargar.
 *
 * Abreviaturas usadas en las referencias:
 *   TB   = Tabletas de Bahá'u'lláh
 *   PEB  = Pasajes de los Escritos de Bahá'u'lláh
 *   PO   = Palabras Ocultas
 *   DAV  = Día Avisado / Día Prometido
 *   MVB  = Mensajes a la Voluntad de los Bahá'ís
 *   SEAB = Selecciones de los Escritos de ʻAbdu'l-Bahá
 *   TAB  = Tablas de ʻAbdu'l-Bahá
 *   AB   = ʻAbdu'l-Bahá
 *   BL   = Bahá'í Life
 */

export type DeepeningQuote = {
  text: string;
  reference: string;
};

export type DeepeningTopic = {
  topic: string;
  quotes: DeepeningQuote[];
  reflectionPrompts: string[];
};

export const DEEPENING_POOL: DeepeningTopic[] = [
  {
    topic: "Amor",
    quotes: [
      {
        text: `No cometáis lo que contamine la límpida corriente del amor o destruya la dulce fragancia de la amistad. ¡Por la rectitud del Señor! Habéis sidos creados para mostrar amor el uno por el otro y no perversidad y rencor. No os enorgullezcáis en el amor por vosotros mismos sino en el amor por vuestros congéneros. No os gloriéis en el amor a vuestra patria, sino en el amor por toda la humanidad.`,
        reference: "Bahá'u'lláh, TB, pág. 161",
      },
      {
        text: `Levantaos y aferraos firmemente a la Causa de Dios. Sed muy amorosos el uno al otro. Quemad el velo del yo con la llama del Fuego inextinguible por amor del Bienamado, y asociaos con vuestro prójimo con rostros alegres y radiante de luz.`,
        reference: "Bahá'u'lláh, PEB, pág. 210",
      },
      {
        text: `¡Oh vosotros, bienamados del Señor! En esta sagrada Dispensación, el conflicto y la disputa no se permiten bajo ninguna circunstancia. Todo agresor se priva a sí mismo de la gracia de Dios. Incumbe a todos mostrar el mayor amor, rectitud de conducta, franqueza y sincera bondad a todos los pueblos y razas del mundo, sean amigos o extraños....el afecto y bondad de los siervos del Dios Único y Verdadero deben ser extendidos generosa y universalmente, a toda la humanidad.`,
        reference: "Bahá'u'lláh, DAV; pág. 156",
      },
    ],
    reflectionPrompts: [
      "¿Cómo podemos manifestar este amor en nuestras interacciones diarias dentro y fuera de la comunidad?",
      "¿Qué prácticas concretas nos ayudan a cultivar amor genuino, incluso con personas con quienes tenemos diferencias?",
    ],
  },
  {
    topic: "Buen Carácter",
    quotes: [
      {
        text: `El tercer Taráz concierne al buen carácter. Un buen carácter es, en verdad, el mejor manto de Dios para los hombres....¡Por mi vida! La luz de un carácter bondadoso sobrepasa a la luz del sol y su resplandor. Quienquiera lo haya logrado es considerado como una joya entre los hombres.`,
        reference: "Bahá'u'lláh, TB, pág. 39",
      },
      {
        text: `Un carácter bondadoso es un medio por el cual los hombres son guiados al recto Sendero y son conducidos hacia el Gran Anuncio. Bienaventurado quien esté adornado con el carácter y los santos atributos del Concurso en lo Alto.`,
        reference: "Bahá'u'lláh, TB, pág. 39",
      },
      {
        text: `Su objetivo es cubrir a cada hombre con el manto de un carácter santificado y adornarlo con el ornamento de acciones buenas y santas.`,
        reference: "Bahá'u'lláh, PEB, págs. 198-199",
      },
    ],
    reflectionPrompts: [
      "¿Qué cualidades de carácter percibimos como más necesarias en nuestra comunidad ahora?",
      "¿Cómo educamos a niños y prejuniors en el desarrollo de un carácter santificado?",
    ],
  },
  {
    topic: "Cercanía a Dios",
    quotes: [
      {
        text: `¡Oh Hijo del Hombre! No te aflijas a menos que estés lejos de Nosotros. Y no te regocijes a menos que te acerques y vuelvas a Nosotros.`,
        reference: "Bahá'u'lláh, PO, Árabe, #35",
      },
      {
        text: `Es el rebeldía del corazón que lo aparta de Dios y lo condena a estar lejos de Él... aquellos corazones que son conscientes de su Presencia, están cerca de Él y deben considerarse como que se han aproximado a su trono.`,
        reference: "Bahá'u'lláh, PEB, pág. 123",
      },
      {
        text: `¡El Dios único y verdadero es mi testigo! Este muy grande, este insondable y ondeante océano está cerca, asombrosamente cerca de vosotros. ¡Ved, está más próximo a vosotros que vuestra vena vital!`,
        reference: "Bahá'u'lláh, PEB, pág. 217",
      },
    ],
    reflectionPrompts: [
      "¿Qué actividades de nuestra vida personal y comunitaria nos acercan más a Dios?",
      "¿Cómo enriquecemos la dimensión devocional de nuestras reuniones?",
    ],
  },
  {
    topic: "Conciencia Espiritual",
    quotes: [
      {
        text: `Camina en lo alto sobre el mundo del ser a través del poder del Más Grande Nombre, para que puedas tomar conciencia de los misterios inmemoriales, y estés enterado de lo que nadie se ha enterado.`,
        reference: "Bahá'u'lláh, TB, pág. 166",
      },
      {
        text: `Quien hoy crea firmemente en el renacimiento del hombre y esté plenamente consciente de que Dios, el Exaltadísimo, esgrime una ascendencia suprema y una autoridad absoluta sobre esta nueva creación, ciertamente, tal hombre es contado entre aquellos que están dotados de perspicacia en esta grandísima Revelación.`,
        reference: "Bahá'u'lláh, TB, pág. 166",
      },
      {
        text: `...el hombre se distingue muy por encima de los otros reinos. Además de que posee todas las virtudes de los reinos inferiores, él está dotado, también, con la facultad espiritual, la gracia celestial de la conciencia.`,
        reference: "‘Abdu'l-Bahá, FUM, pág. 156",
      },
    ],
    reflectionPrompts: [
      "¿Cómo cultivamos la conciencia espiritual en medio de las exigencias del mundo material?",
      "¿Qué papel cumple la oración y la meditación en este proceso?",
    ],
  },
  {
    topic: "Conocimiento",
    quotes: [
      {
        text: `El conocimiento equivale a alas para la vida del hombre y a una escalera para su ascenso. Su adquisición incumbe a todos.`,
        reference: "Bahá'u'lláh, EHL, pág. 25",
      },
      {
        text: `El espíritu que anima al corazón humano es el conocimiento de Dios.`,
        reference: "Bahá'u'lláh, PEB, pág. 193",
      },
      {
        text: `Por tanto, sé agradecido a Dios, por que te ha fortalecido para ayudar a Su Causa, porque ha hecho que las flores del conocimiento y la comprensión broten en el jardín de tu corazón.`,
        reference: "Bahá'u'lláh, PEB, pág. 201",
      },
    ],
    reflectionPrompts: [
      "¿Qué tipo de conocimiento es más necesario para el progreso de nuestra comunidad?",
      "¿Cómo fortalecemos el estudio sistemático de los Escritos en cada hogar?",
    ],
  },
  {
    topic: "Consulta",
    quotes: [
      {
        text: `La consulta confiere mayor comprensión y trasmuta la conjetura en certeza. Es una luz brillante, la cual, en un mundo oscuro, señala el camino y guía. Para todas las cosas existe y continuará existiendo una posición de perfección y madurez. La madurez del don de la comprensión se manifiesta a través de la consulta.`,
        reference: "Bahá'u'lláh, LC, pág. 6",
      },
      {
        text: `En todas las cosas es necesaria la consulta. Este tema debe ser vigorosamente enfatizado, de modo que la consulta sea observada por todos.`,
        reference: "Bahá'u'lláh, LC, pág. 7",
      },
      {
        text: `La cuestión de la consulta es de suma importancia, y es uno de los más poderosos instrumentos conducentes a la tranquilidad y a la felicidad de los pueblos....La consulta, por tanto, es una de las ordenanzas explícitas del Señor de la humanidad.`,
        reference: "‘Abdu'l-Bahá, LC, págs. 18-19",
      },
    ],
    reflectionPrompts: [
      "¿Cómo aplicamos los principios de consulta bahá'í en las decisiones familiares y comunitarias?",
      "¿Qué obstáculos encontramos al consultar y cómo los superamos?",
    ],
  },
  {
    topic: "Cooperación",
    quotes: [
      {
        text: `Proceded uno con otro con extremo amor y armonía, con amistad y compañerismo.`,
        reference: "Bahá'u'lláh, PEB, pág. 191",
      },
      {
        text: `Sé digno de la confianza de tu prójimo, y mírale con rostro resplandeciente y amistoso.`,
        reference: "Bahá'u'lláh, EHL, pág. 87",
      },
      {
        text: `...todo desarrollo y progreso son los frutos de las luces de la virtud, de la cooperación y la concordia.`,
        reference: "‘Abdu'l-Bahá, SEAB, pág. 292",
      },
    ],
    reflectionPrompts: [
      "¿En qué iniciativas de la comunidad podemos cooperar más estrechamente?",
      "¿Cómo balanceamos el servicio personal con la acción colectiva?",
    ],
  },
  {
    topic: "Coraje",
    quotes: [
      {
        text: `...su agitación se convirtió en paz; su duda, en certeza; su timidez en coraje. ¡Tal es la fuerza del Elixir Divino, que, rápido como un abrir y cerrar de ojos, transmuta las almas de los hombres!`,
        reference: "Bahá'u'lláh, XI, pág. 99",
      },
      {
        text: `Para todo hay un signo. El signo del amor es la fortaleza ante mi decreto y la paciencia ante mis pruebas.`,
        reference: "Bahá'u'lláh, PO, Árabe, #48",
      },
      {
        text: `Todo lo que disminuye el temor aumenta el coraje.`,
        reference: "Bahá'u'lláh, EHL, pág. 30",
      },
    ],
    reflectionPrompts: [
      "¿En qué situaciones de la vida comunitaria se requiere coraje espiritual?",
      "¿Cómo apoyamos a quienes enfrentan dificultades al servir a la Causa?",
    ],
  },
  {
    topic: "Cortesía",
    quotes: [
      {
        text: `Nosotros, ciertamente, hemos escogido la cortesía, y la hemos hecho el distintivo verdadero de aquellos que están cerca de Él. La cortesía, en verdad, es un atavío que sienta bien a todos los hombres, ya sean jóvenes o ancianos. Bienaventurado aquel que adorne su sien con ella y, ¡ay!, de aquel que esté privado de esta gran munificencia.`,
        reference: "Bahá'u'lláh, EHL, pág. 48",
      },
      {
        text: `¡Oh pueblo de Dios! Os exhorto a practicar la cortesía, pues sobre todo lo demás, ella es la princesa de las virtudes. Bienaventurado quien sea iluminado con la luz de la cortesía, y esté ataviado con la vestidura de la rectitud`,
        reference: "Bahá'u'lláh, TB, pág. 101",
      },
      {
        text: `Quienquiera esté investido con cortesía, ha logrado por cierto una sublime posición. Se espera que este Agraviado y todos los demás puedan ser capaces de adquirirla, aferrarse a ella, practicarla, y fijar en ella su mirada. Este es el mandamiento obligatorio que ha emanado de la Pluma del Más Grande Nombre.`,
        reference: "Bahá'u'lláh, TB, pág. 101",
      },
    ],
    reflectionPrompts: [
      "¿Cómo se manifiesta la cortesía en nuestras Fiestas y reuniones?",
      "¿Qué pequeños gestos pueden transformar el ambiente de un encuentro?",
    ],
  },
  {
    topic: "Desprendimiento",
    quotes: [
      {
        text: `Bendito el hombre que se haya desprendido de todo salvo de Mí, que se haya remontado en la atmósfera de mi amor, ganado la admisión en mi Reino, contemplado mis dominios de gloria, que haya bebido a grandes tragos de las aguas vivientes de mi generosidad, y su porción del río celestial de mi amorosa providencia, enterado de mi Causa, comprendido aquello que he ocultado dentro del tesoro de mis Palabras, y brillado desde el horizonte del conocimiento divino, ocupado en mi alabanza y glorificación.`,
        reference: "Bahá'u'lláh, TB, págs. 18-19",
      },
      {
        text: `Apartaos de todo menos de mí, y volved vuestros rostros hacia mi rostro, pues esto es mejor para vosotros que todas las cosas que poseéis. La Lengua de Dios atestigua la verdad de mis palabras por mi propia Palabra, que habla la verdad, y abarca y comprende todas las cosas.`,
        reference: "Bahá'u'lláh, PEB, pág. 171",
      },
      {
        text: `Dios, sin duda, inspirará a quienquiera se desprenda de todo salvo de Él, y hará que de su corazón se viertan y fluyan copiosamente las aguas puras de la sabiduría y la prolación.`,
        reference: "Bahá'u'lláh, PEB, pág. 208",
      },
    ],
    reflectionPrompts: [
      "¿De qué cosas nos cuesta desprendernos para servir mejor a la Causa?",
      "¿Cómo cultivamos el desprendimiento sin caer en la indiferencia?",
    ],
  },
  {
    topic: "Devoción",
    quotes: [
      {
        text: `Sólo cuando la lámpara de la búsqueda, del esfuerzo ardiente, del deseo anhelante, de la devoción apasionada, del amor fervoroso...se haya encendido en el corazón del buscador...será disipada la oscuridad del error...`,
        reference: "Bahá'u'lláh, KI, pág. 122",
      },
      {
        text: `Aquellos que me siguen deben luchar en todas circunstancias para promover el bienestar de quienquiera que se levante para el triunfo de mi Causa y deben demostrar en todo momento su devoción y fidelidad hacia él.`,
        reference: "Bahá'u'lláh, PEB, pág. 137",
      },
      {
        text: `Quienquiera que recite retirado en su cámara los versos revelados por Dios, los ángeles esparcidores del Todopoderoso esparcirán por doquier la fragancia de las palabras pronunciadas por su boca.`,
        reference: "Bahá'u'lláh, BNE, pág. 94",
      },
    ],
    reflectionPrompts: [
      "¿Cómo enriquecemos la porción devocional de nuestras Fiestas?",
      "¿Qué espacios devocionales podemos abrir a familiares y vecinos?",
    ],
  },
  {
    topic: "Equidad",
    quotes: [
      {
        text: `La equidad es la más fundamental de las virtudes humanas. La evaluación de todas las cosas depende de ella.`,
        reference: "Bahá'u'lláh, MVB, pág. 56",
      },
      {
        text: `¡Sed equitativos en vuestro juicio, oh hombres de corazón compasivo! Aquél que es injusta carece de las características que distinguen la posición del hombre.`,
        reference: "Bahá'u'lláh, MVB, pág. 56",
      },
      {
        text: `¡Oh Dios, mi Dios! Atavía mi cabeza con la corona de la justicia, y mi sien con el ornamento de la equidad.`,
        reference: "Bahá'u'lláh, EHL, pág. 12",
      },
    ],
    reflectionPrompts: [
      "¿Cómo aseguramos que toda voz sea escuchada con equidad en nuestras consultas?",
      "¿Qué prejuicios sutiles debemos vigilar?",
    ],
  },
  {
    topic: "Esperanza",
    quotes: [
      {
        text: `No os entretengáis con las cosas del mundo y sus vanos ornamentos, ni tampoco pongáis vuestra esperanza en ellas.`,
        reference: "Bahá'u'lláh, PEB, pág. 84",
      },
      {
        text: `Las maravillas de Su munificencia nunca podrán cesar, ni la corriente de Su misericordiosa gracia podrá jamás ser detenida. El proceso de Su creación no ha tenido principio ni podrá tener fin.`,
        reference: "Bahá'u'lláh, PEB, pág. 39",
      },
      {
        text: `No obstruyas el luminoso manantial de tu alma con las zarzas de afectos inmoderados y vanos, y no impidas que fluyan las aguas vivas que manan de la fuente de tu corazón. Pon toda tu esperanza en Dios, y aférrate tenazmente a Su infalible misericordia.`,
        reference: "Bahá'u'lláh, PEB, pág. 215",
      },
    ],
    reflectionPrompts: [
      "¿Qué señales de esperanza vemos en el progreso reciente de la comunidad?",
      "¿Cómo mantenemos viva la esperanza en momentos difíciles?",
    ],
  },
  {
    topic: "Fe",
    quotes: [
      {
        text: `La esencia de fe es ser parco en palabras y abundante en hechos.`,
        reference: "Bahá'u'lláh, TB, pág. 182",
      },
      {
        text: `...la vida de la carne es común a hombres y animales, mientras que la vida del espíritu la poseen solamente los puros de corazón, quienes han bebido del océano de la fe.`,
        reference: "Bahá'u'lláh, KI, pág. 78",
      },
      {
        text: `Él hace claros sus signos, para que podáis tener fe firme en la Presencia de vuestro Señor.`,
        reference: "Bahá'u'lláh, EHL, pág. 108",
      },
    ],
    reflectionPrompts: [
      "¿Cómo se profundiza nuestra fe a través del servicio y del estudio?",
      "¿Qué experiencias personales han fortalecido nuestra fe?",
    ],
  },
  {
    topic: "Generosidad",
    quotes: [
      {
        text: `¡Oh Hijos del Polvo! Hablad a los ricos de los suspiros que profieren los pobres a medianoche; no sea que la negligencia los lleve al camino de la destrucción y los prive del Árbol de la Riqueza. Dar y ser generoso son atributos míos, dichoso aquel que se adorna con mis virtudes.`,
        reference: "Bahá'u'lláh, PO, Persa, #49",
      },
      {
        text: `¡Oh Ricos de la Tierra! Los pobres son mi depósito en medio de vosotros; cuidad mi depósito, y no estéis empeñados solamente de vuestro propio bienestar.`,
        reference: "Bahá'u'lláh, PO, Persa, #54",
      },
      {
        text: `Debiera socorrer al desposeído y nunca rehusar su favor al menesteroso.`,
        reference: "Bahá'u'lláh, PEB, pág. 176",
      },
    ],
    reflectionPrompts: [
      "¿Más allá del aporte al Fondo, en qué otras formas podemos ser generosos?",
      "¿Cómo enseñamos generosidad a los niños?",
    ],
  },
  {
    topic: "Gratitud",
    quotes: [
      {
        text: `Si los hombres descubrieran el propósito que motiva la Revelación de Dios, seguramente desecharían sus temores y con el corazón lleno de gratitud se regocijarían con gran alegría.`,
        reference: "Bahá'u'lláh, PEB, pág. 116",
      },
      {
        text: `Dad gracias a Dios, ya que habéis alcanzado el deseo de vuestros corazones y habéis sido unidos a Aquel quien es el Prometido de todas las naciones.`,
        reference: "Bahá'u'lláh, PEB, pág. 3",
      },
      {
        text: `Hemos hecho que los ríos de la prolación divina fluyan desde nuestro trono, para que las tiernas hierbas de sabiduría y entendimiento broten de la tierra de vuestros corazones. ¿Acaso no estaréis agradecidos?`,
        reference: "Bahá'u'lláh, PEB, pág. 27",
      },
    ],
    reflectionPrompts: [
      "¿Por qué bendiciones específicas damos gracias hoy como comunidad?",
      "¿Cómo cultivamos una actitud diaria de gratitud?",
    ],
  },
  {
    topic: "Humildad",
    quotes: [
      {
        text: `La humildad exalta al hombre al cielo de la gloria y poder mientras que el orgullo lo sumerge en las profundidades de la vileza y degradación.`,
        reference: "Bahá'u'lláh, MVB, pág. 24",
      },
      {
        text: `En este Día toda alma que camine humildemente con su Dios y se aferra a Él, se encontrará investida con el honor y gloria de todos los bellos nombres y posiciones.`,
        reference: "Bahá'u'lláh, PEB, pág. 105",
      },
      {
        text: `No debe nunca tratar de enaltecerse por encima de nadie, debe borrar de la tabla de su corazón toda huella de orgullo y vanagloria, debe asirse a la paciencia y resignación, guardar silencio y abstenerse de la conversación ociosa.`,
        reference: "Bahá'u'lláh, PEB, pág. 176",
      },
    ],
    reflectionPrompts: [
      "¿Cómo se manifiesta la humildad sin convertirse en falsa modestia?",
      "¿Qué nos enseña la humildad sobre el servicio a la Causa?",
    ],
  },
  {
    topic: "Justicia",
    quotes: [
      {
        text: `¡Oh hijo del espíritu! Ante mi vista lo más amado de todas las cosas es la Justicia; no te apartes de ella si Me deseas, y no la descuides para que confíe en ti....En verdad, la justicia es mi don para ti y el signo de mi amorosa bondad. Tenla pues ante tus ojos.`,
        reference: "Bahá'u'lláh, PO, Árabe, #2",
      },
      {
        text: `Estad alertas para que no hagáis injusticia a nadie, aunque sea como un grano de mostaza. Hollad el sendero de la justicia, porque éste es, ciertamente, el sendero recto.`,
        reference: "Bahá'u'lláh, PEB, pág. 166",
      },
      {
        text: `El propósito de la justicia es el surgimiento de la unión entre los hombres. Ningún resplandor puede compararse con aquel de la justicia. La organización del mundo y la tranquilidad de la humanidad dependen de ella.`,
        reference: "Bahá'u'lláh, AJD, pág. 44",
      },
    ],
    reflectionPrompts: [
      "¿Cómo aplicamos el principio de justicia en nuestras decisiones cotidianas?",
      "¿Qué injusticias en nuestro entorno podemos abordar con acción comunitaria?",
    ],
  },
  {
    topic: "Paciencia",
    quotes: [
      {
        text: `La primera es: El Valle de la Búsqueda. El corcel de este Valle es la paciencia; sin ella, en esta jornada el caminante no arribará a ningún lugar ni alcanzará meta alguna. No deberá jamás desanimarse; y si por cien años se esforzará y aún no lograse contemplar la belleza del Amigo, no deberá titubear.`,
        reference: "Bahá'u'lláh, SV; pág. 22",
      },
      {
        text: `Él, en verdad, aumentará la recompensa de aquellos que soportan con paciencia.`,
        reference: "Bahá'u'lláh, PEB, pág. 85",
      },
      {
        text: `¡Oh Hijo del Hombre! Para todo hay un signo. El signo del amor es la fortaleza ante mi decreto y la paciencia ante mis pruebas.`,
        reference: "Bahá'u'lláh, PO, Árabe, #48",
      },
    ],
    reflectionPrompts: [
      "¿En qué áreas de la vida comunitaria se nos pide ser más pacientes?",
      "¿Cómo distinguimos paciencia activa de pasividad?",
    ],
  },
  {
    topic: "Participación",
    quotes: [
      {
        text: `Quienquiera se levante a ayudar a nuestra Causa en este Día, y llame en su ayuda las huestes de un carácter loable y una conducta recta, la influencia que fluye de tal acción, ciertamente será difundida por todo el mundo.`,
        reference: "Bahá'u'lláh, PEB, págs. 190-191",
      },
      {
        text: `Glorificado sea el Todo Misericordioso, Quien le ha iluminado y le ha hecho levantarse y servir a su grande y poderosa Causa.`,
        reference: "Bahá'u'lláh, EHL, pág. 78",
      },
      {
        text: `...incumbe a todos los amigos ponerse en acción y levantarse con alma y corazón y de común acuerdo para difundir las fragancias de Dios, enseñar su Causa y promover su Fe. Les incumbe a éstos no descansar un instante, ni buscar reposo.`,
        reference: "‘Abdu'l-Bahá, RSE, pág. 25",
      },
    ],
    reflectionPrompts: [
      "¿Cómo invitamos a más personas a participar en la vida de la comunidad?",
      "¿Qué barreras existen para la participación y cómo las removemos?",
    ],
  },
];

/**
 * Devuelve un tema de profundización elegido al azar del pool.
 * Se invoca cada vez que el admin carga la plantilla de una Fiesta nueva,
 * garantizando rotación a lo largo de los ciclos.
 */
export function pickRandomDeepening(): DeepeningTopic {
  const idx = Math.floor(Math.random() * DEEPENING_POOL.length);
  return DEEPENING_POOL[idx];
}

/**
 * Formatea un tema completo como texto plano para guardar en el campo
 * de profundización de la Fiesta.
 */
export function formatDeepening(topic: DeepeningTopic): {
  theme: string;
  content: string;
} {
  const quotesText = topic.quotes
    .map(
      (q, i) =>
        `${i + 1}. \u201c${q.text}\u201d\n   — ${q.reference}`
    )
    .join("\n\n");

  const prompts = topic.reflectionPrompts
    .map((p, i) => `${i + 1}. ${p}`)
    .join("\n");

  const content =
    `${quotesText}\n\n` +
    `PREGUNTAS DE REFLEXIÓN (sugeridas — la Asamblea puede adaptarlas):\n${prompts}`;

  return { theme: topic.topic, content };
}
