/**
 * Pool de 40 oraciones bahá'ís autoritativas, apropiadas para la
 * porción devocional de la Fiesta de los Diecinueve Días.
 *
 * Fuente: https://www.bahaiprayers.app/?l=es
 * Categorías incluidas: Asamblea Espiritual, Reuniones, Agradecimiento
 * y alabanza, Triunfo de la Causa, Iluminación, Cualidades Espirituales,
 * Constancia, Firmeza en la Alianza, Jóvenes, Ayuda, Generales.
 *
 * Los textos pertenecen a Bahá'u'lláh, ʻAbdu'l-Bahá y el Báb, traducidos
 * al español por la Comunidad Internacional Bahá'í. La Asamblea Local
 * puede editar/refinar cada oración antes de cada Fiesta.
 */

export type PoolPrayer = {
  /** ID en bahaiprayers.app, útil para referencia/actualización. */
  sourceId: string;
  title: string;
  reference: "Bahá'u'lláh" | "ʻAbdu'l-Bahá" | "el Báb";
  body: string;
};

export const PRAYER_POOL: PoolPrayer[] = [
  {
    sourceId: "20200000",
    title: "Bendito es el sitio",
    reference: "Bahá'u'lláh",
    body:
      "Bendito es el sitio, y la casa, y el lugar, y la ciudad, y el corazón, " +
      "y la montaña, y el refugio, y la cueva, y el valle, y la tierra, y el " +
      "mar, y la isla y la pradera, donde se ha hecho mención de Dios y se ha " +
      "glorificado Su alabanza.",
  },
  {
    sourceId: "20200010",
    title: "Entona, oh Mi siervo",
    reference: "Bahá'u'lláh",
    body:
      "Entona, oh Mi siervo, los versículos de Dios que has recibido, como son " +
      "entonados por aquellos que se han acercado a Él, para que la dulzura de " +
      "tu melodía encienda tu propia alma y atraiga los corazones de todos. " +
      "Siempre que alguien recite en la intimidad de su aposento los versículos " +
      "que Dios ha revelado, los ángeles esparcidores del Todopoderoso difundirán " +
      "por doquier la fragancia de las palabras emanadas de su boca, y harán que " +
      "palpite el corazón de toda persona recta. Aunque al principio permanezca " +
      "inconsciente de su efecto, sin embargo, la virtud de la gracia que le ha " +
      "sido concedida debe necesariamente ejercer tarde o temprano influencia " +
      "sobre su alma. Así han sido decretados los misterios de la Revelación de " +
      "Dios en virtud de la Voluntad de Aquel que es la Fuente de poder y sabiduría.",
  },
  {
    sourceId: "20302000",
    title: "Para la cámara del consejo",
    reference: "ʻAbdu'l-Bahá",
    body:
      "Cuando entréis en la cámara del consejo, recitad esta oración con el " +
      "corazón palpitante de amor a Dios y la lengua purificada de todo lo que " +
      "no sea Su recuerdo, para que el Todopoderoso os ayude bondadosamente a " +
      "lograr la victoria suprema.\n\n" +
      "¡Oh Dios, mi Dios! Somos siervos Tuyos que nos hemos vuelto con devoción " +
      "hacia Tu Santo Rostro, y nos hemos desprendido de todo menos de Ti en este " +
      "glorioso Día. Nos hemos reunido en esta Asamblea Espiritual, unidos en " +
      "nuestros pareceres y pensamientos, armonizando nuestros propósitos para " +
      "exaltar Tu Palabra entre la humanidad. ¡Oh Señor, nuestro Dios! Haz de " +
      "nosotros señales de Tu Guía divina, estandartes de Tu exaltada Fe entre " +
      "las gentes, siervos de Tu poderosa Alianza, oh nuestro Altísimo Señor, " +
      "manifestaciones de Tu divina Unidad en Tu Reino de Abhá y estrellas " +
      "resplandecientes que brillan sobre todas las regiones. ¡Señor! Ayúdanos a " +
      "convertirnos en mares que se agitan con las olas de Tu maravillosa Gracia, " +
      "arroyos que fluyen desde Tus Alturas todogloriosas, frutos excelentes del " +
      "Árbol de Tu Causa empírea, árboles que se mecen en Tu Viña celestial con " +
      "las brisas de Tu Munificencia. ¡Oh Dios! Haz que nuestras almas dependan " +
      "de los Versículos de Tu divina Unidad, que nuestros corazones se regocijen " +
      "con las efusiones de Tu Gracia, para que nos unamos como las olas de un " +
      "solo mar y nos fundamos como los rayos de Tu Luz resplandeciente; para que " +
      "nuestros pensamientos, nuestros pareceres y nuestros sentimientos se " +
      "conviertan en una sola realidad que manifieste el espíritu de unión por " +
      "todo el mundo. Tú eres el Magnánimo, el Munífico, el Conferidor, el " +
      "Todopoderoso, el Misericordioso, el Compasivo.",
  },
  {
    sourceId: "20302010",
    title: "Al concluir la reunión",
    reference: "ʻAbdu'l-Bahá",
    body:
      "¡Oh Dios! ¡Oh Dios! Desde el reino invisible de Tu unicidad, henos aquí " +
      "reunidos en esta reunión espiritual, creyendo en Ti, confiando en Tus " +
      "señales, firmes en Tu Alianza y Testamento, atraídos hacia Ti, encendidos " +
      "con el fuego de Tu amor y leales a Tu Causa. Somos siervos de Tu viña, " +
      "propagadores de Tu religión, fieles adoradores de Tu semblante, humildes " +
      "ante Tus amados, sumisos ante Tu puerta, implorándote que nos confirmes en " +
      "el servicio a Tus elegidos, que nos sostengas con Tus huestes invisibles, " +
      "nos fortalezcas en Tu servidumbre y nos conviertas en siervos sumisos y " +
      "devotos en comunión contigo.\n\n" +
      "¡Oh Señor nuestro! Somos débiles y Tú eres el Fuerte, el Poderoso. Estamos " +
      "sin vida, y Tú eres el gran Espíritu vivificador. Estamos necesitados, y " +
      "Tú eres el Sustentador, el Poderoso.\n\n" +
      "¡Oh Señor nuestro! Vuelve nuestros rostros hacia Tu semblante compasivo, " +
      "aliméntanos de Tu mesa celestial con Tu abundante gracia, ayúdanos con las " +
      "huestes de Tus ángeles supremos y confírmanos mediante los seres santos " +
      "del Reino de Abhá.\n\n" +
      "Verdaderamente, Tú eres el Generoso, el Misericordioso. Tú eres el Poseedor " +
      "de gran munificencia y, en verdad, Tú eres el Clemente y el Magnánimo.",
  },
  {
    sourceId: "20302020",
    title: "¡Oh Señor del Reino!",
    reference: "ʻAbdu'l-Bahá",
    body:
      "¡Oh Señor del Reino! Aunque nuestros cuerpos están aquí reunidos, nuestros " +
      "corazones cautivos se ven transportados por Tu amor, y nos sentimos " +
      "extasiados por los rayos de Tu faz resplandeciente. Aunque somos débiles, " +
      "esperamos las revelaciones de Tu fuerza y Tu poder. Aunque somos pobres, " +
      "sin bienes ni recursos, recibimos riqueza de los tesoros de Tu Reino. " +
      "Aunque somos gotas, nos surtimos de las profundidades de Tu océano. Aunque " +
      "somos motas de polvo, brillamos en la gloria de Tu Sol radiante.\n\n" +
      "¡Oh Tú que eres nuestro Proveedor! Haz descender Tu ayuda para que cada " +
      "uno de los aquí reunidos se convierta en un cirio encendido, cada uno " +
      "llegue a ser un centro de atracción, un emplazador a Tus reinos celestiales, " +
      "hasta que finalmente hagamos de este mundo inferior el reflejo fiel de Tu " +
      "Paraíso.",
  },
  {
    sourceId: "20225010",
    title: "¡Oh divina Providencia!",
    reference: "ʻAbdu'l-Bahá",
    body:
      "¡Oh divina Providencia! Esta asamblea está compuesta por Tus amigos, que " +
      "están atraídos por Tu belleza y encendidos con el fuego de Tu amor. " +
      "Convierte a estas almas en ángeles celestiales, resucítalas mediante el " +
      "hálito de Tu Espíritu Santo, concédeles lengua elocuente y corazón " +
      "resuelto, confiéreles poder celestial y sentimientos piadosos, haz que " +
      "lleguen a ser los difusores de la unicidad del género humano y causa de " +
      "amor y concordia en el mundo de la humanidad, para que la peligrosa " +
      "oscuridad del prejuicio ignorante se desvanezca con la luz del Sol de la " +
      "Verdad, este lóbrego mundo se ilumine, este dominio material absorba los " +
      "rayos del mundo del espíritu, estos colores diferentes se fundan en un " +
      "solo color, y la melodía de la alabanza se eleve hacia el reino de Tu " +
      "santidad. ¡Verdaderamente, Tú eres el Omnipotente y el Todopoderoso!",
  },
  {
    sourceId: "20225020",
    title: "Verdaderamente, estos siervos se vuelven hacia Ti",
    reference: "ʻAbdu'l-Bahá",
    body:
      "¡Oh mi Dios! ¡Oh mi Dios! Verdaderamente, estos siervos se vuelven hacia " +
      "Ti, suplicantes ante Tu reino de misericordia. Verdaderamente, están " +
      "atraídos por Tu santidad y encendidos con el fuego de Tu amor, buscando " +
      "la confirmación de Tu reino maravilloso y esperando alcanzar Tu dominio " +
      "celestial. Verdaderamente, anhelan el descenso de Tus dádivas y desean " +
      "iluminación del Sol de la Realidad. ¡Oh Señor! Haz de ellos lámparas " +
      "resplandecientes, emblemas de misericordia, árboles fructíferos y estrellas " +
      "luminosas. Haz que puedan levantarse para servirte y estar unidos a Ti con " +
      "los vínculos y lazos de Tu amor, anhelando las luces de Tu favor. ¡Oh " +
      "Señor! Haz de ellos señales de guía, estandartes de Tu reino inmortal, " +
      "olas del océano de Tu misericordia, espejos de la luz de Tu majestad. " +
      "Verdaderamente, Tú eres el Generoso. Verdaderamente, Tú eres el " +
      "Misericordioso. Verdaderamente, Tú eres el Apreciado, el Amado.",
  },
  {
    sourceId: "20225030",
    title: "Oración por las plantas de Su jardín",
    reference: "ʻAbdu'l-Bahá",
    body:
      "¡Oh bondadoso Señor! Estos son Tus siervos que han concurrido a esta " +
      "reunión, se han vuelto hacia Tu reino y necesitan Tus dádivas y " +
      "bendiciones. ¡Oh Dios! Manifiesta y haz evidentes las señales de Tu " +
      "unicidad que han sido depositadas en todas las realidades de la vida. " +
      "Revela y despliega las virtudes que has dejado latentes y ocultas en estas " +
      "realidades humanas.\n\n" +
      "¡Oh Dios! Nosotros somos como plantas y Tu generosidad es como la lluvia; " +
      "refresca y haz crecer estas plantas mediante Tu favor. Somos Tus siervos; " +
      "líbranos de las cadenas de la existencia física. Somos ignorantes; haznos " +
      "sabios. Estamos muertos; vivifícanos. Somos de materia; dótanos de espíritu. " +
      "Estamos excluidos; haznos los confidentes de Tus misterios. Estamos " +
      "necesitados; enriquécenos y bendícenos con Tu tesoro ilimitado. ¡Oh Dios! " +
      "Resucítanos; danos vista; danos oído; familiarízanos con los misterios de " +
      "la vida, para que los secretos de Tu reino nos sean revelados en este mundo " +
      "de la existencia y podamos confesar Tu unicidad. Toda dádiva emana de Ti; " +
      "toda bendición es Tuya.\n\n" +
      "Tú eres fuerte. Tú eres poderoso. Tú eres el Donador y Tú eres el Siempre " +
      "Munífico.",
  },
  {
    sourceId: "20225040",
    title: "Estos siervos se han reunido",
    reference: "ʻAbdu'l-Bahá",
    body:
      "¡Oh Dios misericordioso! ¡Oh Tú que eres fuerte y poderoso! ¡Oh " +
      "bondadosísimo Padre! Estos siervos se han reunido y se han vuelto hacia " +
      "Ti, ofreciendo súplicas ante Tu umbral, deseando los dones infinitos " +
      "procedentes de Tu gran seguridad. No tienen otro propósito más que Tu " +
      "agrado. No tienen otra intención más que servir al mundo de la humanidad.\n\n" +
      "¡Oh Dios! Haz radiante a esta asamblea. Haz compasivos los corazones. " +
      "Confiere los dones del Espíritu Santo. Dótalos con un poder procedente del " +
      "cielo. Bendícelos con mentes celestiales. Aumenta su sinceridad, para que " +
      "con toda humildad y contrición se vuelvan hacia Tu reino y se ocupen en el " +
      "servicio al mundo de la humanidad. Que cada uno llegue a ser una lámpara " +
      "radiante. Que cada uno se convierta en una estrella brillante. Que cada " +
      "uno adquiera hermosos colores y aromas perfumados en el reino de Dios.\n\n" +
      "¡Oh Padre bondadoso! Otorga Tus bendiciones. No consideres nuestras faltas. " +
      "Cobíjanos bajo Tu protección. No tengas presente nuestros pecados. Cúranos " +
      "con Tu misericordia. Somos débiles; Tú eres fuerte. Somos pobres; Tú eres " +
      "rico. Estamos enfermos; Tú eres el Médico. Estamos necesitados; Tú eres " +
      "muy generoso.\n\n" +
      "¡Oh Dios! Concédenos Tu providencia. Tú eres el Poderoso. Tú eres el " +
      "Donador. Tú eres el Benéfico.",
  },
  {
    sourceId: "20225050",
    title: "¡Oh Dios perdonador!",
    reference: "ʻAbdu'l-Bahá",
    body:
      "¡Oh Dios perdonador! Estos siervos se vuelven hacia Tu reino en busca de " +
      "Tu gracia y generosidad. ¡Oh Dios! Haz buenos y puros sus corazones para " +
      "que lleguen a ser merecedores de Tu amor. Purifica y santifica los " +
      "espíritus para que la luz del Sol de la Realidad brille sobre ellos. " +
      "Purifica y santifica los ojos para que puedan percibir Tu luz. Purifica y " +
      "santifica los oídos para que puedan oír el llamado de Tu reino.\n\n" +
      "¡Oh Señor! Verdaderamente, somos débiles, pero Tú eres fuerte. " +
      "Verdaderamente, somos pobres, pero Tú eres rico. Somos buscadores y Tú " +
      "eres Aquel a Quien buscamos. ¡Oh Señor! Ten compasión de nosotros y " +
      "perdónanos; confiérenos tal capacidad y receptividad que nos haga dignos " +
      "de Tus favores y nos atraiga a Tu reino, que bebamos en abundancia del " +
      "agua de vida, seamos encendidos con el fuego de Tu amor y resucitemos por " +
      "medio de los hálitos del Espíritu Santo que soplan en este siglo radiante.\n\n" +
      "¡Oh Dios, mi Dios! Dirige las miradas de Tu cariñosa bondad sobre esta " +
      "reunión. Resguarda a todos y a cada uno bajo Tu custodia y Tu protección. " +
      "Haz descender sobre estas almas Tus bendiciones celestiales. Sumérgelas en " +
      "el océano de Tu misericordia, y vivifícalas con los hálitos del Espíritu " +
      "Santo.",
  },
  {
    sourceId: "20225060",
    title: "¡Oh Proveedor amoroso!",
    reference: "ʻAbdu'l-Bahá",
    body:
      "¡Oh Proveedor amoroso! Estas almas han prestado oído al llamamiento del " +
      "Reino y han contemplado la gloria del Sol de la Verdad. Se han elevado " +
      "hacia los reconfortantes cielos del amor; están enamorados de Tu esencia y " +
      "adoran Tu belleza. Se han vuelto hacia Ti, hablando entre sí de Ti, en pos " +
      "de Tu morada, y sedientos de los arroyos de Tu dominio celestial. Tú eres " +
      "el Donador, el Otorgador, el Siempre Amoroso.",
  },
  {
    sourceId: "20225070",
    title: "¡Disipa todo lo que sea causa de discordia!",
    reference: "ʻAbdu'l-Bahá",
    body:
      "¡Oh Dios! ¡Disipa todo lo que sea causa de discordia y provéenos de todo " +
      "aquello que sea causa de unidad y acuerdo! ¡Oh Dios! ¡Haz que descienda " +
      "sobre nosotros la Fragancia Celestial, y transforma esta reunión en una " +
      "reunión del Cielo! Concédenos todo bien y todo sustento. ¡Prepáranos el " +
      "manjar del Amor! ¡Danos el alimento del Conocimiento! ¡Otórganos el pan de " +
      "la Iluminación celestial!",
  },
  {
    sourceId: "20201000",
    title: "Alabanza ante Tu sublimidad",
    reference: "Bahá'u'lláh",
    body:
      "¡Alabado seas, oh Señor mi Dios! Cada vez que intento hacer mención de Ti " +
      "me lo impide la sublimidad de Tu posición y la irresistible grandeza de Tu " +
      "poder, pues si Te alabara a lo largo de la extensión de Tu dominio y la " +
      "duración de Tu soberanía, descubriría que mi alabanza a Ti tan solo " +
      "corresponde a los que son semejantes a mí, quienes son ellos mismos Tus " +
      "criaturas y han sido generados mediante el poder de Tu decreto y creados " +
      "mediante la potencia de Tu voluntad. Te suplico, oh mi Señor, por Tu Más " +
      "Grande Nombre, mediante el cual separaste la luz del fuego y la verdad de " +
      "la negación, que hagas descender sobre mí y sobre aquellos de mis amados " +
      "que se encuentran en mi compañía el bien de este mundo y del venidero. " +
      "Provéenos, pues, con Tus maravillosos dones que están ocultos a los ojos " +
      "de todos. Tú eres, en verdad, el Modelador de toda la creación. No hay " +
      "Dios sino Tú, el Todopoderoso, el Todoglorioso, el Altísimo.",
  },
  {
    sourceId: "20201010",
    title: "¡En el Nombre de Dios, el Altísimo!",
    reference: "Bahá'u'lláh",
    body:
      "¡En el Nombre de Dios, el Altísimo! ¡Alabado y glorificado eres Tú, Señor, " +
      "Dios Omnipotente, ante Cuya sabiduría el sabio está falto de conocimiento " +
      "y fracasa, ante Cuyo conocimiento el erudito confiesa su ignorancia, ante " +
      "Cuyo poder el fuerte se debilita, ante Cuya riqueza el rico atestigua su " +
      "pobreza, ante Cuya luz el iluminado está perdido en la oscuridad, hacia el " +
      "templo de Cuyo conocimiento se vuelve la esencia de todo entendimiento, y " +
      "en torno al santuario de Cuya presencia circulan las almas de toda la " +
      "humanidad!\n\n" +
      "Toda alabanza y gloria sean para Ti, de Quien todas las cosas han " +
      "atestiguado que Tú eres uno, y que no hay otro Dios sino Tú, Quien, desde " +
      "siempre, has estado por encima de todo igual o semejante y lo seguirás " +
      "estando eternamente. Todos los reyes no son más que siervos Tuyos, y nada " +
      "son ante Ti todos los seres visibles e invisibles. No hay otro Dios salvo " +
      "Tú, el Bondadoso, el Poderoso, el Altísimo.",
  },
  {
    sourceId: "20201020",
    title: "Por haberme separado de Tus enemigos",
    reference: "Bahá'u'lláh",
    body:
      "¡Glorificado eres Tú, oh Señor mi Dios! Te doy gracias por haberme " +
      "permitido reconocer a la Manifestación de Ti mismo, por haberme separado " +
      "de Tus enemigos y haber expuesto ante mi vista sus maldades y perversas " +
      "acciones en Tus días, y por haberme librado de todo apego a ellos, y por " +
      "hacer que me vuelva completamente hacia Tu gracia y Tus generosos favores. " +
      "Te doy gracias, asimismo, por haberme enviado, desde las nubes de Tu " +
      "voluntad, aquello que me ha purificado de tal modo de las insinuaciones de " +
      "los infieles y las alusiones de los incrédulos que he fijado el corazón " +
      "firmemente en Ti y he huido de aquellos que han negado la luz de Tu " +
      "semblante. Te agradezco también que me hayas facultado para ser firme en " +
      "Tu amor, proclamar Tu alabanza y ensalzar Tus virtudes. Y Te doy gracias " +
      "por cuanto me has dado de beber del cáliz de Tu misericordia que ha " +
      "superado todo lo visible y lo invisible. Tú eres el Todopoderoso, el Más " +
      "Exaltado, el Todoglorioso, el Amoroso.",
  },
  {
    sourceId: "20201025",
    title: "Te doy gracias en todo momento",
    reference: "Bahá'u'lláh",
    body:
      "¡Él es Dios! ¡Exaltado es Él, el Señor de la fuerza y la grandeza!\n\n" +
      "¡Oh Dios, mi Dios! Te doy gracias en todo momento y Te ofrezco alabanza " +
      "en toda condición.\n\n" +
      "En la prosperidad, toda alabanza es para Ti, oh Señor de los mundos, y en " +
      "su ausencia, toda gratitud es para contigo, oh Deseo de quienes Te han " +
      "reconocido.\n\n" +
      "En la adversidad, todo honor es Tuyo, oh Adorado de todos cuantos están en " +
      "el cielo y en la tierra, y en la aflicción, toda gloria es Tuya, oh " +
      "Encantador de los corazones de quienes suspiran por Ti.\n\n" +
      "En la desdicha, toda alabanza es para Ti, oh Tú, Objetivo de todos cuantos " +
      "Te buscan, y en el bienestar, toda acción de gracias es para Ti, oh Tú " +
      "cuyo recuerdo atesoran los corazones de quienes están próximos a Ti.\n\n" +
      "En la alegría, toda gloria es para ti, oh Tú, fuera de Quien no hay otro " +
      "Dios, y en la tristeza, toda belleza es Tuya, oh Tú, fuera de Quien no hay " +
      "otro Dios.\n\n" +
      "Toda generosidad es Tuya, oh Tú que eres el Señor de la generosidad, y el " +
      "Soberano de la generosidad, y el Rey de la generosidad! Atestiguo que Tú " +
      "has de ser alabado por Tus hechos, oh Tú, Fuente de la generosidad, y " +
      "obedecido en Tus mandatos, oh Tú, Océano de la generosidad, Aquel de Quien " +
      "procede toda generosidad, Aquel a Quien retorna toda generosidad.",
  },
  {
    sourceId: "20201030",
    title: "Toda majestad y gloria",
    reference: "el Báb",
    body:
      "Toda majestad y gloria, oh mi Dios, y todo dominio, luz, grandeza y " +
      "esplendor sean para Ti. Tú otorgas soberanía a quien quieres y se la " +
      "niegas a quien deseas. No hay Dios sino Tú, Quien todo lo posee, el " +
      "Exaltadísimo. Tú eres Quien crea de la nada el universo y a todos cuantos " +
      "lo habitan. No existe nada digno de Ti salvo Tú mismo, mientras que todos " +
      "los demás son como proscritos ante Tu santa presencia y son como la nada " +
      "comparados con la gloria de Tu propio Ser.\n\n" +
      "Gloria sea a Ti; Tú estás muy por encima de la descripción de nadie fuera " +
      "de Ti, ya que más allá de la concepción humana está el magnificar " +
      "convenientemente Tus virtudes o comprender la realidad íntima de Tu " +
      "Esencia. Yo Te he conocido, oh mi Dios, porque Tú Te has dado a conocer a " +
      "mí, pues si no Te hubieras revelado a mí, no Te habría conocido. Te rindo " +
      "culto gracias a que Tú me has llamado, pues, de no haber sido por Tu " +
      "llamamiento, yo no Te habría adorado.",
  },
  {
    sourceId: "20226000",
    title: "Haz victoriosos en Tus días a Tus siervos",
    reference: "el Báb",
    body:
      "¡Oh Señor! Haz victoriosos en Tus días a Tus sufridos siervos y concédeles " +
      "un merecido triunfo, por cuanto han anhelado el martirio en Tu camino. Haz " +
      "descender sobre ellos lo que alivie su mente, alegre su ser interior, dé " +
      "seguridad a sus corazones y tranquilidad a sus cuerpos, y permita que sus " +
      "almas asciendan a la presencia de Dios, el Exaltadísimo, y alcancen el " +
      "supremo Paraíso y los retiros de gloria que Tú has destinado para las " +
      "personas de virtud y verdadero conocimiento. En verdad, Tú sabes todas las " +
      "cosas, mientras que nosotros no somos más que Tus siervos, Tus cautivos, " +
      "Tus vasallos y Tus necesitados. A ningún otro Señor invocamos salvo a Ti, " +
      "oh Dios, nuestro Señor, ni imploramos bendiciones o gracia a nadie fuera " +
      "de Ti, oh Tú que eres el Dios de misericordia para este mundo y el " +
      "venidero. ¡Oh Señor! Convierte nuestra recompensa en aquello que sea digno " +
      "de Ti de entre todo el bien de este mundo y del venidero. Verdaderamente, " +
      "Tú eres nuestro Señor y el Señor de todas las cosas.",
  },
  {
    sourceId: "20226010",
    title: "El Árbol de Tu divina Unidad",
    reference: "el Báb",
    body:
      "¡Oh Señor! Haz posible el rápido crecimiento del Árbol de Tu divina " +
      "Unidad; riégalo, pues, oh Señor, con las aguas corrientes de Tu favor y " +
      "haz que, ante las revelaciones de Tu divina seguridad, dé frutos como los " +
      "que Tú deseas para Tu glorificación y exaltación, para Tu alabanza y el " +
      "agradecimiento a Ti, y magnifique Tu Nombre, alabe la unicidad de Tu " +
      "Esencia y Te rinda culto, ya que todo esto está a Tu alcance, y no al " +
      "alcance de ningún otro.\n\n" +
      "Grande es la bienaventuranza de aquellos cuya sangre has escogido para " +
      "regar el Árbol de Tu afirmación, y exaltar así Tu santa e inmutable Palabra.",
  },
  {
    sourceId: "20226020",
    title: "Que ningún ser creado quede fuera",
    reference: "el Báb",
    body:
      "¡Oh Señor! Permite que todos los pueblos de la tierra sean admitidos en el " +
      "Paraíso de Tu Fe para que ningún ser creado quede fuera de los límites de " +
      "Tu complacencia. Desde tiempo inmemorial, Tú has sido potente para hacer " +
      "Tu voluntad, y libre de hacer cuanto deseas.",
  },
  {
    sourceId: "20226040",
    title: "Estos son siervos Tuyos que han percibido Tu Voz",
    reference: "ʻAbdu'l-Bahá",
    body:
      "¡Oh Señor, mi Dios, mi Bienamado! Estos son siervos Tuyos que han " +
      "percibido Tu Voz, han escuchado Tu Palabra y han prestado oído a Tu " +
      "Llamado. Han creído en Ti, han presenciado Tus maravillas, han reconocido " +
      "Tu prueba y han atestiguado Tu evidencia. Han caminado por Tus senderos, " +
      "han seguido Tu guía, han descubierto Tus misterios, han comprendido los " +
      "secretos de Tu Libro, los versículos de Tus Pergaminos y las buenas " +
      "nuevas de Tus Epístolas y Tablas. Se han aferrado al borde de Tu vestidura " +
      "y se han asido fuertemente del manto de Tu luz y Tu grandeza.\n\n" +
      "¡Señor! Enciende en su corazón la llama de Tu divina atracción y haz que " +
      "cante en su pecho el ave del amor y la comprensión. Permite que sean como " +
      "señales poderosas, enseñas radiantes, y perfectos como Tu Palabra. Exalta " +
      "Tu Causa por medio de ellos, despliega Tus estandartes y difunde Tus " +
      "maravillas por doquier. Haz triunfante Tu Palabra mediante ellos, y " +
      "fortalece las espaldas de Tus amados.\n\n" +
      "¡Señor! Somos débiles, fortalécenos para difundir las fragancias de Tu " +
      "Santidad; somos pobres, enriquécenos con los tesoros de Tu divina Unidad; " +
      "estamos desnudos, vístenos con el manto de Tu generosidad; somos " +
      "pecadores, perdona nuestros pecados mediante Tu gracia, Tu favor y Tu " +
      "perdón. Tú eres, en verdad, el Auxiliador, el Socorredor, el Magnánimo, " +
      "el Potente, el Poderoso.\n\n" +
      "La gloria de las glorias sea con aquellos que son fieles y firmes.",
  },
  {
    sourceId: "20226050",
    title: "Aviva este fuego día tras día",
    reference: "ʻAbdu'l-Bahá",
    body:
      "¡Oh Dios, mi Dios! Alabado seas por haber encendido el fuego del amor " +
      "divino en el Árbol Santo que se encuentra en la cima del monte más " +
      "elevado; ese Árbol que «no es del Oriente ni del Occidente», ese fuego que " +
      "ardió hasta que su llama se remontó hacia el Concurso de lo alto, y de él " +
      "esas realidades captaron la luz de la guía y exclamaron: «Verdaderamente, " +
      "hemos percibido un fuego en la ladera del Monte Sinaí».\n\n" +
      "¡Oh Dios, mi Dios! Aviva este fuego día tras día, hasta que su estruendo " +
      "ponga en movimiento a toda la tierra. ¡Oh mi Señor! Enciende la llama de " +
      "Tu amor en todos los corazones, infunde en las almas el espíritu de Tu " +
      "conocimiento, alegra los pechos con los versículos de Tu unicidad. Llama " +
      "a la vida a los que habitan en sus tumbas, amonesta a los orgullosos, haz " +
      "feliz al mundo entero, haz descender Tus aguas cristalinas y, en la " +
      "asamblea de esplendores manifiestos, haz pasar esa copa que ha sido " +
      "«templada en la fuente del alcanfor».\n\n" +
      "Verdaderamente, Tú eres el Donador, el Perdonador, el Eterno Conferidor. " +
      "Verdaderamente, Tú eres el Misericordioso, el Compasivo.",
  },
  {
    sourceId: "20226080",
    title: "No permitas que me quede alejado",
    reference: "Bahá'u'lláh",
    body:
      "No permitas, oh Dios, mi Dios, que me quede alejado del cielo de Tus " +
      "dádivas y del sol de Tus favores. Te imploro, por aquella Palabra mediante " +
      "la cual Tú has subyugado a todas las cosas visibles e invisibles, que me " +
      "ayudes a mí y a Tus escogidos a lograr aquello que exalte Tu Causa en " +
      "medio de Tus siervos y por todas Tus regiones. Ordena, pues, para mí todo " +
      "lo bueno que has enviado en Tu Libro. Verdaderamente, Tú eres el " +
      "Todopoderoso, Quien siempre perdona, el Más Generoso.",
  },
  {
    sourceId: "20215010",
    title: "Toda alabanza sea para Ti",
    reference: "Bahá'u'lláh",
    body:
      "Toda alabanza sea para Ti, oh mi Dios, Quien eres la Fuente de toda gloria " +
      "y majestad, de grandeza y honor, de soberanía y dominio, de sublimidad y " +
      "gracia, de reverencia y poder. A quien Tú quieres le haces acercarse al " +
      "Grandísimo Océano y a quien deseas le confieres el honor de reconocer Tu " +
      "Muy Antiguo Nombre. De todos los que están en el cielo y en la tierra, " +
      "nadie puede resistir la acción de Tu soberana Voluntad. Desde toda la " +
      "eternidad, Tú has regido la creación entera, y por siempre continuarás " +
      "ejerciendo Tu dominio sobre todo lo creado. No hay otro Dios más que Tú, " +
      "el Omnipotente, el Exaltadísimo, el Todopoderoso, el Sapientísimo.\n\n" +
      "Ilumina, oh Señor, los rostros de Tus siervos para que puedan verte, y " +
      "limpia sus corazones para que puedan volverse hacia la corte de Tus " +
      "favores celestiales y reconocer a Aquel que es la Manifestación de Tu Ser " +
      "y la Aurora de Tu Esencia. Verdaderamente, Tú eres el Señor de todos los " +
      "mundos. No hay Dios sino Tú, el Libre, Quien todo lo subyuga.",
  },
  {
    sourceId: "20215020",
    title: "Tú me ves, oh mi Dios",
    reference: "Bahá'u'lláh",
    body:
      "Tú me ves, oh mi Dios, desprendido de todo salvo de Ti y aferrándome a Ti. " +
      "Guíame pues, en todos mis asuntos, hacia aquello que me favorezca para la " +
      "gloria de Tu Causa y la grandeza de la posición de Tus amados.",
  },
  {
    sourceId: "20214010",
    title: "Somos siervos de Tu umbral",
    reference: "ʻAbdu'l-Bahá",
    body:
      "¡Oh bondadoso Señor! ¡Oh Tú que eres generoso y misericordioso! Somos " +
      "siervos de Tu umbral y estamos reunidos a la sombra protectora de Tu " +
      "divina unidad. El sol de Tu misericordia brilla sobre todos y las nubes de " +
      "Tu generosidad derraman su lluvia sobre todos. Tus dádivas abarcan a todos, " +
      "Tu amorosa providencia mantiene a todos, Tu protección envuelve a todos y " +
      "la mirada de Tu favor se dirige hacia todos. ¡Oh Señor! Otorga Tus " +
      "infinitos dones y haz resplandecer la luz de Tu guía. Ilumina los ojos, " +
      "alegra los corazones con felicidad perdurable. Confiere un espíritu nuevo " +
      "a todas las gentes y concédeles vida eterna. Abre las puertas del " +
      "verdadero entendimiento y permite que brille resplandeciente la luz de la " +
      "fe. Reúne a todas las gentes al amparo de Tu generosidad y haz que se " +
      "unan en armonía, para que lleguen a ser como los rayos de un solo sol, " +
      "como las olas de un mismo océano y como el fruto de un solo árbol. Que " +
      "beban del mismo manantial. Que se refresquen con la misma brisa. Que " +
      "obtengan iluminación de la misma fuente de luz. Tú eres el Donador, el " +
      "Misericordioso, el Omnipotente.",
  },
  {
    sourceId: "20205020",
    title: "Rey Cuya palabra imperativa",
    reference: "Bahá'u'lláh",
    body:
      "¡Oh mi Dios, Dios de munificencia y misericordia! Tú eres aquel Rey Cuya " +
      "palabra imperativa ha dado la existencia a toda la creación; y Tú eres " +
      "aquel Ser Todogeneroso a Quien las acciones de Sus siervos nunca Le han " +
      "impedido mostrar Su gracia ni han frustrado las revelaciones de Su " +
      "munificencia. Permite, Te lo suplico, que este siervo alcance lo que sea " +
      "causa de su salvación en cada mundo de Tus mundos. Tú eres, verdaderamente, " +
      "el Todopoderoso, el Omnipotente, el Omnisciente, el Sapientísimo.",
  },
  {
    sourceId: "20206000",
    title: "Crea en mí un corazón puro",
    reference: "Bahá'u'lláh",
    body:
      "Crea en mí un corazón puro, oh mi Dios, y renueva una conciencia tranquila " +
      "dentro de mí, oh mi Esperanza. Por medio del espíritu del poder, confírmame " +
      "en Tu Causa, oh mi Bienamado, y con la luz de Tu gloria, revélame Tu " +
      "camino, oh Tú que eres el Objeto de mi deseo. Mediante la fuerza de Tu " +
      "transcendente poder, elévame hasta el cielo de Tu santidad, oh Fuente de " +
      "mi ser, y con las brisas de Tu eternidad, alégrame, oh Tú que eres mi " +
      "Dios. Haz que Tus eternas melodías me inspiren tranquilidad, oh mi " +
      "Compañero, y que las riquezas de Tu antiguo semblante me libren de todo " +
      "salvo de Ti, oh mi Maestro, y que las nuevas de la revelación de Tu " +
      "incorruptible Esencia me traigan alegría, oh Tú que eres el más manifiesto " +
      "de lo manifiesto y el más oculto de lo oculto.",
  },
  {
    sourceId: "20206030",
    title: "Este siervo Tuyo ha avanzado hacia Ti",
    reference: "ʻAbdu'l-Bahá",
    body:
      "¡Oh mi Dios, oh mi Dios! Este siervo Tuyo ha avanzado hacia Ti, vaga " +
      "apasionado por el desierto de Tu amor, camina por el sendero de Tu " +
      "servicio, espera Tus favores, anhela Tu munificencia, confía en Tu reino y " +
      "está embriagado con el vino de Tu dádiva. ¡Oh mi Dios! Aumenta el fervor " +
      "de su devoción por Ti, la constancia de su alabanza de Ti y el ardor de su " +
      "amor por Ti. Verdaderamente, Tú eres el Más Generoso, el Señor de gracia " +
      "abundante. No hay otro Dios más que Tú, el Perdonador, el Misericordioso.",
  },
  {
    sourceId: "20206040",
    title: "Esta es una lámpara encendida",
    reference: "ʻAbdu'l-Bahá",
    body:
      "¡Oh mi Señor! ¡Oh mi Señor! Esta es una lámpara encendida con el fuego de " +
      "Tu amor, que arde con la llama prendida en el árbol de Tu misericordia. " +
      "¡Oh mi Señor! Aviva su luz, su calor y su llama con el fuego que arde en " +
      "el Sinaí de Tu Manifestación. Verdaderamente, Tú eres el Confirmador, el " +
      "Auxiliador, el Poderoso, el Generoso, el Amoroso.",
  },
  {
    sourceId: "20205040",
    title: "¡Oh Proveedor!",
    reference: "ʻAbdu'l-Bahá",
    body:
      "¡Oh Proveedor! Tú has exhalado sobre los amigos de Occidente la perfumada " +
      "fragancia del Espíritu Santo y, con la luz de la guía divina, has " +
      "iluminado el cielo del Oeste. Has hecho que se acerquen a Ti quienes " +
      "otrora se hallaban alejados; has convertido a los extraños en amigos " +
      "amorosos; has despertado a aquellos que dormían; has vuelto conscientes a " +
      "los desatentos.\n\n" +
      "¡Oh Proveedor! Ayuda a estos nobles amigos a ganarse Tu complacencia, y " +
      "hazlos bienquerientes de extraños y de amigos por igual. Condúcelos al " +
      "mundo que perdura por siempre; otórgales una parte de la gracia celestial; " +
      "haz que sean bahá'ís verdaderos, entregados sinceramente a Dios; guárdalos " +
      "de las apariencias y afiánzalos firmemente en la verdad. Hazlos signos y " +
      "señales del Reino, estrellas luminosas en los horizontes de esta vida " +
      "inferior. Haz que sean un consuelo y un solaz para el género humano, y " +
      "sirvientes de la paz del mundo. Alégralos con el vino de Tu consejo, y " +
      "permite que todos ellos sigan el camino de Tus mandamientos.\n\n" +
      "¡Oh Proveedor! El más caro deseo de este siervo de Tu Umbral es contemplar " +
      "a los amigos de Oriente y Occidente en un estrecho abrazo; presenciar a " +
      "todos los miembros de la sociedad humana reunidos con amor en una única " +
      "gran asamblea, como gotas de agua recogidas en un mar inmenso; verlos a " +
      "todos como aves en un mismo jardín de rosas, como perlas de un mismo " +
      "océano, como hojas de un mismo árbol, como rayos de un mismo sol.\n\n" +
      "Tú eres el Fuerte, el Poderoso, y Tú eres el Dios de fuerza, el " +
      "Omnipotente, Quien todo lo ve.",
  },
  {
    sourceId: "20206050",
    title: "Mi Refugio en la aflicción",
    reference: "ʻAbdu'l-Bahá",
    body:
      "¡Oh Señor, mi Dios y mi Refugio en la aflicción! ¡Mi Escudo y mi Amparo en " +
      "mis desdichas! ¡Mi Asilo y Protección en momentos de necesidad y, en mi " +
      "soledad, mi Compañero! ¡En mi angustia, mi Consuelo, y en mi desamparo, " +
      "un Amigo cariñoso! ¡El que elimina el dolor de mis tristezas y el que " +
      "perdona mis pecados!\n\n" +
      "Hacia Ti me vuelvo por completo, implorándote fervientemente con todo mi " +
      "corazón, mi mente y mi voz que me protejas de todo cuanto sea contrario a " +
      "Tu voluntad en este ciclo de Tu divina unidad, y me purifiques de toda " +
      "contaminación que me impida buscar, limpio e inmaculado, la sombra del " +
      "árbol de Tu gracia.\n\n" +
      "Haz que mi corazón rebose de amor por Tus criaturas, y permite que me " +
      "convierta en señal de Tu misericordia, en símbolo de Tu gracia, en " +
      "promotor de concordia entre Tus amados, consagrado a Ti, conmemorándote y " +
      "olvidándome de mí mismo, pero siempre atento a lo que es Tuyo.\n\n" +
      "Tú eres, verdaderamente, el Benévolo, el Glorificado, el Poderoso, el " +
      "Omnipotente.",
  },
  {
    sourceId: "20212000",
    title: "Me he vuelto arrepentido hacia Ti",
    reference: "Bahá'u'lláh",
    body:
      "¡Oh Dios, mi Dios! Me he vuelto arrepentido hacia Ti y, verdaderamente, Tú " +
      "eres el Perdonador, el Compasivo. ¡Oh Dios, mi Dios! He regresado a Ti y, " +
      "verdaderamente, Tú eres Quien siempre perdona, el Bondadoso. ¡Oh Dios, mi " +
      "Dios! Me he aferrado a la cuerda de Tu munificencia, y contigo se " +
      "encuentra todo cuanto hay en el cielo y en la tierra. ¡Oh Dios, mi Dios! " +
      "He acudido presuroso a Ti y, verdaderamente, Tú eres el Perdonador, el " +
      "Señor de abundante gracia. ¡Oh Dios, mi Dios! Estoy sediento del vino " +
      "celestial de Tu gracia y, verdaderamente, Tú eres el Donador, el Munífico, " +
      "el Bondadoso, el Todopoderoso. ¡Oh Dios, mi Dios! Doy testimonio de que Tú " +
      "has revelado Tu Causa, has cumplido Tu promesa y has enviado, desde el " +
      "cielo de Tu gracia, aquello que ha atraído hacia Ti los corazones de Tus " +
      "favorecidos.",
  },
  {
    sourceId: "20212040",
    title: "Haz que se aproxime rápidamente el día",
    reference: "el Báb",
    body:
      "¡Alabado y glorificado eres Tú, oh Dios! Haz que se aproxime rápidamente " +
      "el día de la llegada a Tu santa presencia. Alegra nuestros corazones " +
      "mediante la fuerza de Tu amor y Tu complacencia, y concédenos firmeza " +
      "para que nos sometamos gustosos a Tu Voluntad y Tu Decreto. Verdaderamente, " +
      "Tu conocimiento abarca todas las cosas que has creado o hayas de crear, y " +
      "Tu poder celestial trasciende todo cuanto has traído o hayas de traer a la " +
      "existencia. No hay nadie a quien rendir culto sino a Ti; no hay nadie a " +
      "quien desear excepto a Ti; no hay nadie a quien adorar fuera de Ti, y nada " +
      "que amar excepto Tu complacencia. En verdad, Tú eres el Gobernante Supremo, " +
      "la Verdad Soberana, Quien ayuda en el peligro, Quien subsiste por Sí mismo.",
  },
  {
    sourceId: "20212060",
    title: "Ayuda a Tus amados a ser firmes",
    reference: "ʻAbdu'l-Bahá",
    body:
      "¡Oh Señor, mi Dios! Ayuda a Tus amados a ser firmes en Tu Fe, a caminar " +
      "por Tus senderos y a ser constantes en Tu Causa. Concédeles Tu gracia para " +
      "resistir los asaltos del egoísmo y la pasión, y seguir la luz de la guía " +
      "divina. Tú eres el Poderoso, el Bondadoso, Quien subsiste por Sí mismo, el " +
      "Donador, el Compasivo, el Todopoderoso, el Todogeneroso.",
  },
  {
    sourceId: "20212100",
    title: "Te doy gracias por haberme despertado",
    reference: "ʻAbdu'l-Bahá",
    body:
      "¡Oh Dios compasivo! Te doy gracias por haberme despertado y hecho " +
      "consciente. Tú me has dado ojos que ven y me has favorecido con oídos que " +
      "oyen, me has conducido a Tu reino y me has guiado hacia Tu sendero. Me has " +
      "indicado el camino correcto y me has hecho entrar en el arca de la " +
      "liberación.\n\n" +
      "¡Oh Dios! Mantenme constante y hazme firme y leal. Protégeme de pruebas " +
      "violentas, resguárdame y ampárame en la fortaleza sólidamente amurallada " +
      "de Tu Alianza y Testamento. Tú eres el Poderoso. Tú eres el que ve. Tú " +
      "eres el que oye.\n\n" +
      "¡Oh Dios compasivo! Concédeme un corazón que, como el cristal, se ilumine " +
      "con la luz de Tu amor, y confiéreme pensamientos que cambien este mundo en " +
      "un jardín de rosas, mediante las efusiones de la gracia celestial.\n\n" +
      "Tú eres el Compasivo, el Misericordioso. Tú eres el Gran Dios Benéfico.",
  },
  {
    sourceId: "20216020",
    title: "Alas celestiales para los pajarillos",
    reference: "ʻAbdu'l-Bahá",
    body:
      "¡Oh bondadoso Señor! Confiere, por Tu gracia, un par de alas celestiales a " +
      "cada uno de estos pajarillos, y concédeles poder espiritual para que " +
      "levanten el vuelo por este espacio ilimitado y se remonten a las alturas " +
      "del Reino de Abhá. ¡Oh Señor! Fortalece estas delicadas plantas para que " +
      "cada una de ellas llegue a ser un árbol fructífero, verde y floreciente. " +
      "Haz victoriosas a estas almas mediante la potencia de Tus huestes " +
      "celestiales, para que puedan aplastar las fuerzas del error y la " +
      "ignorancia y desplegar el estandarte de la fraternidad y de la guía entre " +
      "las gentes; para que, cual brisas vivificantes de la primavera, refresquen " +
      "y reanimen los árboles de las almas humanas y, como lluvias vernales, " +
      "tornen verdes y fértiles los prados de esa región. Tú eres el Fuerte y el " +
      "Poderoso; Tú eres el Conferidor y el Amoroso.",
  },
  {
    sourceId: "20216040",
    title: "Retoño selecto en las praderas",
    reference: "ʻAbdu'l-Bahá",
    body:
      "¡Alabanza y gloria sean para Ti, oh Señor, mi Dios! Este es un retoño " +
      "selecto que has plantado en las praderas de Tu amor y has nutrido con los " +
      "dedos de Tu Señorío. Lo has regado con el manantial de la vida eterna que " +
      "brota en los jardines de Tu unicidad, y has hecho que las nubes de Tu " +
      "tierna misericordia derramen sobre él Tus favores.\n\n" +
      "¡Oh Señor! Haz que este retoño se vuelva verde, lozano y floreciente " +
      "mediante las efusiones de Tu especial munificencia y favor, con las cuales " +
      "has dotado los tabernáculos de la santidad en Tu Reino eterno y has " +
      "adornado las esencias de la unidad en el campo de la reunión.\n\n" +
      "¡Oh Señor! Asístele con Tu gracia fortalecedora proveniente de Tu Reino " +
      "invisible, ayúdale con las huestes ocultas a los ojos de Tus siervos, y " +
      "confiérele una posición segura en Tu presencia. Desata su lengua para que " +
      "haga mención de Ti, y alegra su corazón para que celebre Tu alabanza. " +
      "Ilumina su rostro en Tu Reino, hazle prosperar en el dominio de lo alto, " +
      "y confírmale generosamente en el servicio a Tu Causa.\n\n" +
      "Tú eres el Todopoderoso, el Todoglorioso, el Omnipotente.",
  },
  {
    sourceId: "20203010",
    title: "Loado sea Tu Nombre",
    reference: "el Báb",
    body:
      "¡Loado sea Tu Nombre, oh Señor nuestro Dios! Tú eres, en verdad, el " +
      "Conocedor de lo invisible. Ordena para nosotros todo el bien que determine " +
      "Tu conocimiento que todo lo abarca. Tú eres el supremo Señor, el " +
      "Todopoderoso, el Bienamado.\n\n" +
      "¡Toda alabanza sea para Ti, oh Señor! Pediremos Tu gracia en el Día " +
      "señalado y pondremos toda nuestra confianza en Ti, que eres nuestro Señor. " +
      "¡Glorificado eres, oh Dios! Concédenos aquello que sea bueno y apropiado " +
      "para que podamos prescindir de todo excepto de Ti. Verdaderamente, Tú eres " +
      "el Señor de todos los mundos.\n\n" +
      "¡Oh Dios! Recompensa a quienes resisten con paciencia en Tus días, y " +
      "fortalece sus corazones para que sigan el camino de la Verdad sin " +
      "desviarse. Otórgales, pues, oh Señor, dádivas tan excelentes que les " +
      "permitan acceder a Tu gozoso Paraíso. Exaltado eres, oh Señor, Dios. Haz " +
      "descender Tus bendiciones celestiales sobre hogares cuyos moradores han " +
      "creído en Ti. En verdad, insuperable eres Tú en conceder bendiciones " +
      "divinas.",
  },
  {
    sourceId: "20203070",
    title: "Concede Tu favor y Tu bendición",
    reference: "ʻAbdu'l-Bahá",
    body:
      "¡Oh Dios! Concede Tu favor y Tu bendición. Otorga Tu gracia y una porción " +
      "de Tu generosidad. Permite a estas almas atestiguar este año el " +
      "cumplimiento de sus esperanzas. Haz descender Tu lluvia celestial con " +
      "copiosa abundancia. Tú eres el Poderoso, el Fuerte.",
  },
];

/**
 * Devuelve `count` oraciones del pool elegidas al azar (sin repetir).
 * Por defecto `count = 4` para llenar la sección devocional de una Fiesta.
 *
 * Se usa Fisher-Yates simple sobre una copia del pool — el orden del pool
 * fuente permanece intacto.
 */
export function pickRandomPrayers(count = 4): PoolPrayer[] {
  const copy = PRAYER_POOL.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(count, copy.length));
}
