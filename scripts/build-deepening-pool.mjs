// Lee el JSON extraído y genera lib/feast-deepening-pool.ts con preguntas
// de reflexión por tema.
//
// Uso: node scripts/build-deepening-pool.mjs <ruta-json> > lib/feast-deepening-pool.ts

import { readFileSync } from "node:fs";

const jsonPath = process.argv[2]
  ?? "C:/Users/jorge/AppData/Local/Temp/extracted.json";
const data = JSON.parse(readFileSync(jsonPath, "utf8"));

// Preguntas de reflexión por tema — ejemplos sugeridos.
const REFLECTION_PROMPTS = {
  "Amor": [
    "¿Cómo podemos manifestar este amor en nuestras interacciones diarias dentro y fuera de la comunidad?",
    "¿Qué prácticas concretas nos ayudan a cultivar amor genuino, incluso con personas con quienes tenemos diferencias?",
  ],
  "Buen Carácter": [
    "¿Qué cualidades de carácter percibimos como más necesarias en nuestra comunidad ahora?",
    "¿Cómo educamos a niños y prejuniors en el desarrollo de un carácter santificado?",
  ],
  "Cercanía a Dios": [
    "¿Qué actividades de nuestra vida personal y comunitaria nos acercan más a Dios?",
    "¿Cómo enriquecemos la dimensión devocional de nuestras reuniones?",
  ],
  "Conciencia Espiritual": [
    "¿Cómo cultivamos la conciencia espiritual en medio de las exigencias del mundo material?",
    "¿Qué papel cumple la oración y la meditación en este proceso?",
  ],
  "Conocimiento": [
    "¿Qué tipo de conocimiento es más necesario para el progreso de nuestra comunidad?",
    "¿Cómo fortalecemos el estudio sistemático de los Escritos en cada hogar?",
  ],
  "Consulta": [
    "¿Cómo aplicamos los principios de consulta bahá'í en las decisiones familiares y comunitarias?",
    "¿Qué obstáculos encontramos al consultar y cómo los superamos?",
  ],
  "Cooperación": [
    "¿En qué iniciativas de la comunidad podemos cooperar más estrechamente?",
    "¿Cómo balanceamos el servicio personal con la acción colectiva?",
  ],
  "Coraje": [
    "¿En qué situaciones de la vida comunitaria se requiere coraje espiritual?",
    "¿Cómo apoyamos a quienes enfrentan dificultades al servir a la Causa?",
  ],
  "Cortesía": [
    "¿Cómo se manifiesta la cortesía en nuestras Fiestas y reuniones?",
    "¿Qué pequeños gestos pueden transformar el ambiente de un encuentro?",
  ],
  "Desprendimiento": [
    "¿De qué cosas nos cuesta desprendernos para servir mejor a la Causa?",
    "¿Cómo cultivamos el desprendimiento sin caer en la indiferencia?",
  ],
  "Devoción": [
    "¿Cómo enriquecemos la porción devocional de nuestras Fiestas?",
    "¿Qué espacios devocionales podemos abrir a familiares y vecinos?",
  ],
  "Equidad": [
    "¿Cómo aseguramos que toda voz sea escuchada con equidad en nuestras consultas?",
    "¿Qué prejuicios sutiles debemos vigilar?",
  ],
  "Esperanza": [
    "¿Qué señales de esperanza vemos en el progreso reciente de la comunidad?",
    "¿Cómo mantenemos viva la esperanza en momentos difíciles?",
  ],
  "Fe": [
    "¿Cómo se profundiza nuestra fe a través del servicio y del estudio?",
    "¿Qué experiencias personales han fortalecido nuestra fe?",
  ],
  "Generosidad": [
    "¿Más allá del aporte al Fondo, en qué otras formas podemos ser generosos?",
    "¿Cómo enseñamos generosidad a los niños?",
  ],
  "Gratitud": [
    "¿Por qué bendiciones específicas damos gracias hoy como comunidad?",
    "¿Cómo cultivamos una actitud diaria de gratitud?",
  ],
  "Humildad": [
    "¿Cómo se manifiesta la humildad sin convertirse en falsa modestia?",
    "¿Qué nos enseña la humildad sobre el servicio a la Causa?",
  ],
  "Justicia": [
    "¿Cómo aplicamos el principio de justicia en nuestras decisiones cotidianas?",
    "¿Qué injusticias en nuestro entorno podemos abordar con acción comunitaria?",
  ],
  "Paciencia": [
    "¿En qué áreas de la vida comunitaria se nos pide ser más pacientes?",
    "¿Cómo distinguimos paciencia activa de pasividad?",
  ],
  "Participación": [
    "¿Cómo invitamos a más personas a participar en la vida de la comunidad?",
    "¿Qué barreras existen para la participación y cómo las removemos?",
  ],
};

// Limpieza adicional del texto: colapsa espacios, corrige tildes ASCII.
function cleanText(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

// Convierte "Bahá'u'lláh, TB, pág. 161" → atribución más natural.
function cleanRef(ref) {
  return cleanText(ref).replace(/^\.\s*/, "");
}

function escapeBacktick(s) {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

const topics = Object.keys(REFLECTION_PROMPTS);

let out = `/**
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
`;

for (const topic of topics) {
  const quotes = data[topic] ?? [];
  if (quotes.length === 0) continue;
  out += `  {\n    topic: ${JSON.stringify(topic)},\n    quotes: [\n`;
  for (const q of quotes) {
    out += `      {\n`;
    out += `        text: \`${escapeBacktick(cleanText(q.text))}\`,\n`;
    out += `        reference: ${JSON.stringify(cleanRef(q.ref))},\n`;
    out += `      },\n`;
  }
  out += `    ],\n    reflectionPrompts: [\n`;
  for (const p of REFLECTION_PROMPTS[topic]) {
    out += `      ${JSON.stringify(p)},\n`;
  }
  out += `    ],\n  },\n`;
}

out += `];

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
        \`\${i + 1}. \\u201c\${q.text}\\u201d\\n   — \${q.reference}\`
    )
    .join("\\n\\n");

  const prompts = topic.reflectionPrompts
    .map((p, i) => \`\${i + 1}. \${p}\`)
    .join("\\n");

  const content =
    \`\${quotesText}\\n\\n\` +
    \`PREGUNTAS DE REFLEXIÓN (sugeridas — la Asamblea puede adaptarlas):\\n\${prompts}\`;

  return { theme: topic.topic, content };
}
`;

process.stdout.write(out);
