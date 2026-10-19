import "server-only";
import type { FigureName, ItemIcon } from "@/components/ensenanza/FolletoFigures";
import { getCitasData, type Cita } from "./citas";

/**
 * El folleto "Qué es la Fe Bahá'í": el contenido de la pantalla pública
 * `/la-fe` y del segmento La Fe del hub Enseñanza. Es contenido estático,
 * en código, sin tabla ni panel: cambia poco y lo revisa el usuario.
 *
 * La estructura sigue la del portal bahai.org (Bahá'u'lláh y Su Alianza ·
 * Lo que creen los bahá'ís · Lo que hacen); el texto es propio, escrito
 * para esta app, porque el de bahai.org es de la Comunidad Internacional
 * Bahá'í y no se copia.
 *
 * ⚠️ Las citas NO se escriben acá: se nombran por su id en el corpus de
 * la Lectura de hoy (`public/citas.json`, compilación "La Fuente de Todo
 * Bien") y se resuelven al armar el folleto. Es la regla de la casa:
 * ningún pasaje de los Escritos se escribe de memoria. Si un id no está
 * en el corpus, el bloque se omite y se loguea.
 */

/** Una foto del folleto. Todas vienen del Banco de Medios Bahá'í
 *  (media.bahai.org, © Comunidad Internacional Bahá'í, uso no comercial),
 *  bajadas reducidas a 1000–1200 px a `public/la-fe/`: las originales
 *  pesan varios MB y esto se lee en un celular con datos. */
export type FolletoPhoto = {
  src: string;
  alt: string;
  /** Pie de foto visible. */
  caption?: string;
  /** object-position, para que el recorte no corte lo importante. */
  position?: string;
  /** Relación de aspecto del marco (CSS), default "3 / 2"; "3 / 4" para un retrato. */
  aspect?: string;
};

export type ListItem = {
  title: string;
  text: string;
  icon?: ItemIcon;
  /** Foto al lado del ítem (la Alianza: ‘Abdu'l-Bahá, la Casa de Justicia). */
  photo?: FolletoPhoto;
};

export type FolletoBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: ListItem[] }
  | { kind: "quote"; cita: Cita }
  | { kind: "photo"; photo: FolletoPhoto }
  /** Fila de fotos con pie, para las cuatro actividades. */
  | { kind: "gallery"; items: Array<FolletoPhoto & { icon?: ItemIcon }> }
  /** Línea de tiempo que se dibuja al entrar. */
  | { kind: "timeline"; items: Array<{ year: string; title: string; text: string }> }
  /** Una ilustración SVG animada, sola. */
  | { kind: "figure"; name: FigureName };

export type FolletoChapter = {
  slug: string;
  /** Rótulo corto para el índice y la navegación. */
  short: string;
  title: string;
  lead: string;
  /** Foto de portada del capítulo. */
  hero: FolletoPhoto;
  /** Ilustración que acompaña la portada (marca de agua animada). */
  figure: FigureName;
  blocks: FolletoBlock[];
};

type Draft = Omit<FolletoChapter, "blocks"> & {
  blocks: Array<Exclude<FolletoBlock, { kind: "quote" }> | { kind: "quote"; id: string }>;
};

export const PHOTO_CREDIT = "Fotos: Comunidad Internacional Bahá'í · media.bahai.org";

const CHAPTERS: Draft[] = [
  {
    slug: "una-fe-para-este-tiempo",
    hero: { src: "/la-fe/santuario-bab.jpg", alt: "El Santuario del Báb en Haifa, con su cúpula dorada entre jardines", caption: "El Santuario del Báb, en el Monte Carmelo (Haifa)." },
    figure: "estrella",
    short: "La Fe",
    title: "Una Fe para este tiempo",
    lead:
      "La Fe Bahá'í es una religión mundial, independiente, fundada hace poco más de un siglo y medio. Su mensaje central es sencillo: la humanidad es una sola familia y ha llegado el momento de su unidad.",
    blocks: [
      {
        kind: "p",
        text: "Los bahá'ís creen que Dios es uno, que todas las grandes religiones vienen de la misma Fuente y que la humanidad entera es un solo pueblo. Creen que Bahá'u'lláh, el Fundador de la Fe, es el Mensajero de Dios para esta época, en la misma línea de Abraham, Krishna, Moisés, Zoroastro, Buda, Jesús y Muḥammad.",
      },
      {
        kind: "p",
        text: "Hay comunidades bahá'ís en prácticamente todos los países del mundo, formadas por personas de todos los orígenes, culturas y clases sociales. No hay clero: la vida de la comunidad la sostienen los propios creyentes y la guían instituciones elegidas.",
      },
      { kind: "quote", id: "la-meta-final-2" },
      {
        kind: "p",
        text: "Este folleto es una introducción breve. Al final hay links para seguir leyendo y una forma de ponerse en contacto con la comunidad.",
      },
    ],
  },
  {
    slug: "bahaullah",
    hero: { src: "/la-fe/bahji.jpg", alt: "Los jardines de Bahjí, con el Santuario de Bahá'u'lláh al fondo", caption: "El Santuario de Bahá'u'lláh y sus jardines, en Bahjí, cerca de ‘Akká." },
    figure: "alianza",
    short: "Bahá'u'lláh",
    title: "Bahá'u'lláh y Su Alianza",
    lead:
      "La historia de la Fe empieza en Persia en 1844 y pasa por tres Figuras centrales, unidas por una Alianza que mantiene a la comunidad unida hasta hoy.",
    blocks: [
      {
        kind: "list",
        items: [
          {
            title: "El Báb (1819–1850)",
            text: "En 1844, en Shiraz, un joven comerciante que tomó el título de «el Báb» («la Puerta») anunció que se acercaba la venida de un nuevo Mensajero de Dios y llamó a prepararse para recibirlo. Su mensaje se extendió con rapidez y fue perseguido con dureza. Fue ejecutado públicamente en Tabriz en 1850.",
          },
          {
            title: "Bahá'u'lláh (1817–1892)",
            text: "Bahá'u'lláh («la Gloria de Dios») fue uno de los primeros en abrazar la causa del Báb. Encarcelado y despojado de sus bienes, pasó cuarenta años en destierro y prisión: Bagdad, Constantinopla, Adrianópolis y finalmente la ciudad-prisión de ‘Akká, en la actual Israel. Desde allí reveló los Escritos que forman la base de la Fe, y escribió a los reyes y gobernantes de su tiempo llamándolos a la justicia y a la paz. Falleció en 1892 cerca de ‘Akká, en Bahjí, donde está su Santuario.",
          },
          {
            title: "‘Abdu'l-Bahá (1844–1921)",
            photo: { src: "/la-fe/abdul-baha.jpg", alt: "Fotografía antigua de ‘Abdu'l-Bahá joven junto a su hermano Mírzá Mihdí", caption: "‘Abdu'l-Bahá (derecha) con su hermano Mírzá Mihdí, en Edirne, c. 1864–1868." , aspect: "3 / 4" },
            text: "Hijo mayor de Bahá'u'lláh, designado por Él como intérprete de Sus enseñanzas y centro de Su Alianza. Compartió el destierro de su padre y, liberado en 1908, viajó por Egipto, Europa y América del Norte explicando la Fe. Los bahá'ís lo consideran el ejemplo perfecto de cómo vivir las enseñanzas.",
          },
          {
            title: "Shoghi Effendi y la Casa Universal de Justicia",
            photo: { src: "/la-fe/casa-justicia.jpg", alt: "La Sede de la Casa Universal de Justicia, un edificio blanco de columnas entre jardines", caption: "La Sede de la Casa Universal de Justicia, en Haifa." },
            text: "‘Abdu'l-Bahá nombró a su nieto Shoghi Effendi como Guardián de la Fe (1921–1957), quien organizó la comunidad en todo el mundo. En 1963 se eligió por primera vez la Casa Universal de Justicia, el cuerpo que gobierna la comunidad bahá'í mundial, con sede en Haifa. Así la Fe se mantuvo unida, sin divisiones ni sectas.",
          },
        ],
      },
      {
        kind: "timeline",
        items: [
          { year: "1844", title: "La Declaración del Báb", text: "En Shiraz, el Báb anuncia Su misión. Empieza la era bahá'í." },
          { year: "1863", title: "Bahá'u'lláh declara Su misión", text: "En el Jardín de Riḍván, en Bagdad, antes de partir al destierro." },
          { year: "1892", title: "Fallece Bahá'u'lláh", text: "En Bahjí. ‘Abdu'l-Bahá queda como centro de la Alianza." },
          { year: "1921", title: "Shoghi Effendi, Guardián", text: "Organiza la comunidad mundial durante 36 años." },
          { year: "1963", title: "La Casa Universal de Justicia", text: "Se elige por primera vez, en Haifa. Gobierna la comunidad hasta hoy." },
        ],
      },
      { kind: "quote", id: "la-meta-final-4" },
    ],
  },
  {
    slug: "lo-que-creemos",
    hero: { src: "/la-fe/hero.jpg", alt: "Las terrazas iluminadas del Monte Carmelo al anochecer, sobre la ciudad de Haifa", caption: "Las terrazas del Santuario del Báb, al anochecer.", position: "70% 40%" },
    figure: "unidad",
    short: "Creemos",
    title: "Lo que creemos",
    lead:
      "Tres unidades resumen la visión bahá'í del mundo: un solo Dios, una sola religión que se renueva, una sola humanidad.",
    blocks: [
      { kind: "figure", name: "unidad" },
      {
        kind: "list",
        items: [
          {
            title: "Un solo Dios",
            text: "Hay una sola Realidad divina, incognoscible en Su esencia, que se da a conocer a través de Sus Mensajeros. Los distintos nombres con que los pueblos han llamado a Dios nombran al mismo Creador.",
          },
          {
            title: "Una sola religión",
            text: "Las grandes religiones son capítulos de una misma historia: la educación progresiva de la humanidad por parte de Dios. Cada Mensajero trajo enseñanzas espirituales eternas y leyes sociales adecuadas a su tiempo. Bahá'u'lláh es el más reciente de esos Mensajeros, no el último.",
          },
          {
            title: "Una sola humanidad",
            text: "Todos los seres humanos fuimos creados por el mismo Dios, con la misma dignidad y el mismo propósito. Las diferencias de raza, nación, clase o credo no son razón de división sino de riqueza.",
          },
        ],
      },
      { kind: "quote", id: "amor-1" },
      {
        kind: "p",
        text: "El propósito de la vida, para un bahá'í, es conocer y amar a Dios, desarrollar las virtudes del alma y contribuir al progreso de la civilización. La oración, la meditación, el estudio de los Escritos y el servicio a los demás son el camino. El alma es inmortal y sigue su viaje después de la muerte del cuerpo.",
      },
      { kind: "quote", id: "la-fuerza-de-la-unidad-1" },
    ],
  },
  {
    slug: "principios",
    hero: { src: "/la-fe/circulo.jpg", alt: "Dos personas estudian juntas en la mesa de una cocina", caption: "Un círculo de estudio en Montero, Bolivia." },
    figure: "principios",
    short: "Principios",
    title: "Principios para una sociedad nueva",
    lead:
      "Bahá'u'lláh enseñó que la unidad de la humanidad exige transformar tanto el corazón de las personas como las estructuras de la sociedad. Estos son algunos de los principios que la comunidad bahá'í procura poner en práctica.",
    blocks: [
      {
        kind: "list",
        items: [
          {
            title: "Investigación independiente de la verdad",
            icon: "lupa",
            text: "Cada persona tiene el deber y el derecho de buscar la verdad por sí misma, sin aceptar a ciegas lo que heredó ni lo que le dicen.",
          },
          {
            title: "Eliminación de todos los prejuicios",
            icon: "manos",
            text: "De raza, de religión, de nación, de clase, de género. El prejuicio es la raíz de la mayoría de los conflictos.",
          },
          {
            title: "Igualdad de la mujer y el hombre",
            icon: "balanza",
            text: "La humanidad tiene dos alas; mientras una esté más débil que la otra, no puede volar. La educación de las niñas es prioritaria.",
          },
          {
            title: "Armonía entre la ciencia y la religión",
            icon: "atomo",
            text: "La verdad es una. Una religión contraria a la razón es superstición; una ciencia sin espíritu se vuelve materialismo.",
          },
          {
            title: "Educación universal",
            icon: "libro",
            text: "Todo niño y toda niña tiene derecho a educarse, en lo espiritual, lo intelectual y lo práctico.",
          },
          {
            title: "Eliminación de los extremos de riqueza y pobreza",
            icon: "monedas",
            text: "Por medios espirituales y también por medidas sociales y económicas justas.",
          },
          {
            title: "Un idioma auxiliar universal",
            icon: "globo",
            text: "Que cada pueblo conserve el suyo y toda la humanidad comparta además una lengua común.",
          },
          {
            title: "La paz universal",
            icon: "paloma",
            text: "Sostenida por una federación de las naciones y una justicia que alcance a todos. La paz no es solo la ausencia de guerra: es la unidad.",
          },
        ],
      },
      { kind: "quote", id: "prejuicio-5" },
      {
        kind: "p",
        text: "Los bahá'ís no participan en política partidaria y obedecen a los gobiernos de los países donde viven, pero trabajan activamente por la justicia social, la educación y el desarrollo de sus comunidades.",
      },
    ],
  },
  {
    slug: "lo-que-hacemos",
    hero: { src: "/la-fe/ninos.jpg", alt: "Niños juegan en una clase al aire libre en un pueblo del altiplano", caption: "Una clase para niños en Machacamarca, Bolivia." },
    figure: "actividades",
    short: "Hacemos",
    title: "Lo que hacemos",
    lead:
      "La vida de una comunidad bahá'í se construye en los barrios y pueblos, con actividades abiertas a todos, bahá'ís o no.",
    blocks: [
      {
        kind: "list",
        items: [
          {
            title: "Reuniones devocionales",
            icon: "vela",
            text: "Encuentros sencillos en casas o espacios de la comunidad, donde se leen oraciones y pasajes de los Escritos de distintas religiones, se comparte y se conversa. No tienen ritual fijo y cualquiera puede participar o ser anfitrión.",
          },
          {
            title: "Clases para niños",
            icon: "ninos",
            text: "Clases de educación espiritual y moral para niños, centradas en las virtudes (la veracidad, la generosidad, la justicia, el amor) por medio de historias, canciones, juegos y arte.",
          },
          {
            title: "Grupos de prejóvenes",
            icon: "jovenes",
            text: "Para chicos de entre 11 y 14 años: un espacio para desarrollar la capacidad de expresarse, pensar con claridad y servir a su comunidad, acompañados por jóvenes un poco mayores.",
          },
          {
            title: "Círculos de estudio",
            icon: "circulo",
            text: "Grupos pequeños que estudian juntos los Escritos y aprenden a llevar las enseñanzas a la práctica, con los materiales del Instituto Ruhi. Es el camino habitual para quien quiere conocer la Fe en profundidad.",
          },
        ],
      },
      {
        kind: "gallery",
        items: [
          { src: "/la-fe/devocional.jpg", alt: "Una familia reza junta en la sala de su casa", caption: "Reunión devocional · Puerto Tejada, Colombia", icon: "vela" },
          { src: "/la-fe/ninos.jpg", alt: "Niños en una clase al aire libre", caption: "Clase para niños · Machacamarca, Bolivia", icon: "ninos" },
          { src: "/la-fe/prejovenes.jpg", alt: "Dos adolescentes leen juntas un cuaderno y sonríen", caption: "Grupo de prejóvenes · Montero, Bolivia", icon: "jovenes" },
          { src: "/la-fe/circulo.jpg", alt: "Dos adultos estudian en la mesa de una cocina", caption: "Círculo de estudio · Montero, Bolivia", icon: "circulo" },
        ],
      },
      { kind: "quote", id: "servicio-5" },
      {
        kind: "p",
        text: "Cada diecinueve días la comunidad local se reúne en la Fiesta de Diecinueve Días, con una parte devocional, una de consulta sobre los asuntos de la comunidad y una social. Los asuntos de la comunidad los administran Asambleas Espirituales de nueve personas, elegidas cada año por voto secreto, sin candidaturas ni campañas.",
      },
      {
        kind: "p",
        text: "Los bahá'ís también procuran participar en la vida de la sociedad: en los debates públicos sobre los problemas de su tiempo, en proyectos de desarrollo social y económico, y en la colaboración con personas e instituciones que buscan el bien común.",
      },
    ],
  },
  {
    slug: "en-uruguay",
    hero: { src: "/la-fe/templo-santiago.jpg", alt: "La Casa de Adoración de Sudamérica al atardecer, con una persona mirando el valle", caption: "La Casa de Adoración Bahá'í de Sudamérica, en Santiago de Chile: el templo de nuestro continente.", position: "50% 60%" },
    figure: "uruguay",
    short: "Uruguay",
    title: "La comunidad bahá'í en Uruguay",
    lead:
      "En Uruguay hay comunidades bahá'ís en varias ciudades, cada una con su Asamblea Espiritual Local, y una Asamblea Espiritual Nacional que coordina la vida de la comunidad en todo el país.",
    blocks: [
      { kind: "figure", name: "uruguay" },
      {
        kind: "p",
        text: "Las actividades están abiertas a todas las personas: reuniones devocionales, clases para niños, grupos de prejóvenes y círculos de estudio funcionan en distintos barrios y localidades. No hace falta ser bahá'í para participar, ni hay ningún compromiso por acercarse.",
      },
      {
        kind: "p",
        text: "Quien quiera conocer más puede visitar bahai.uy, el sitio de la comunidad uruguaya, o bahai.org, el sitio internacional, donde están los Escritos completos en español. Y puede dejar sus datos al final de este folleto para que alguien de la comunidad lo contacte.",
      },
      { kind: "quote", id: "una-verdadera-familia-3" },
    ],
  },
];

/** Links del folleto y de Compartir: los mismos en los dos lugares. */
export const LA_FE_LINKS = {
  bahaiOrg: "https://www.bahai.org/es/",
  bahaiUy: "https://www.bahai.uy/",
} as const;

let cache: FolletoChapter[] | null = null;

/** El folleto con las citas resueltas desde el corpus. */
export function getFolleto(): FolletoChapter[] {
  if (cache) return cache;
  const byId = new Map<string, Cita>();
  for (const topic of getCitasData().topics) {
    for (const q of topic.quotes) byId.set(q.id, q);
  }
  cache = CHAPTERS.map((ch) => ({
    slug: ch.slug,
    short: ch.short,
    title: ch.title,
    lead: ch.lead,
    hero: ch.hero,
    figure: ch.figure,
    blocks: ch.blocks.flatMap<FolletoBlock>((b) => {
      if (b.kind !== "quote") return [b];
      const cita = byId.get(b.id);
      if (!cita) {
        console.warn(`[la-fe] cita ${b.id} no está en el corpus; se omite`);
        return [];
      }
      return [{ kind: "quote", cita }];
    }),
  }));
  return cache;
}
