// Construye public/citas.json — el corpus de citas de Escritos Sagrados que
// alimenta la "Cita del día" y (a futuro) el pool de profundización.
//
// Fuente: "La Fuente de Todo Bien" — compilación temática de Reed Chandler
// para la Asamblea Espiritual Nacional de los Bahá'ís de Chile (1991).
// https://bahai-library.com/reed_fuente_todo_bien
//
// A diferencia de scripts/extract-deepening.mjs (que tomaba solo 20 temas y
// 3 citas de cada uno), este script extrae TODOS los temas y TODAS las citas.
//
// Uso:
//   curl -sL https://bahai-library.com/reed_fuente_todo_bien -o fuente.html
//   node scripts/build-citas.mjs fuente.html > public/citas.json

import { readFileSync } from "node:fs";

const SOURCE_PATH = process.argv[2] ?? process.env.SOURCE_HTML;
if (!SOURCE_PATH) {
  console.error("Falta la ruta al HTML. Uso: node scripts/build-citas.mjs <archivo.html>");
  process.exit(1);
}

// El pie de bahai-library.com (bloque "METADATA" con vistas, colecciones y
// navegación del sitio) queda pegado a la última cita si no se corta acá.
const rawHtml = readFileSync(SOURCE_PATH, "utf8");
const metadataAt = rawHtml.indexOf("METADATA");
const html = metadataAt > 0 ? rawHtml.slice(0, metadataAt) : rawHtml;

const NAMED_ENTITIES = {
  nbsp: " ",
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "'",
  rsquo: "'",
  ldquo: '"',
  rdquo: '"',
};

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

function slugify(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’‘]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Corta el HTML en secciones {heading, body} usando los <h3> como límite. */
function splitSections(source) {
  const parts = [];
  const re = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  let match;
  const heads = [];
  while ((match = re.exec(source)) !== null) {
    heads.push({ raw: match[1], start: match.index, end: re.lastIndex });
  }
  for (let i = 0; i < heads.length; i++) {
    const nextStart = i + 1 < heads.length ? heads[i + 1].start : source.length;
    const heading = decodeEntities(heads[i].raw.replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim()
      // Los títulos vienen con numeración inconsistente: "Amor", "2 Amabilidad",
      // "6. Castidad". Sacamos el prefijo numérico.
      .replace(/^\d+\s*\.?\s*/, "")
      .trim();
    parts.push({ heading, body: source.slice(heads[i].end, nextStart) });
  }
  return parts;
}

// El texto original tiene ruido de OCR en los nombres de autor
// ("Bahá 'u 'lláh", "Shoghi Effend4"). Se normalizan para que la referencia
// se vea prolija y para poder agrupar por autor.
const AUTHOR_PATTERNS = [
  [/Bah[aá]\s*'?\s*u\s*'?\s*ll[aá]h/i, "Bahá'u'lláh"],
  [/[‘']?Abdu\s*'?\s*l[- ]?Bah[aá]/i, "‘Abdu'l-Bahá"],
  [/Shoghi\s*Effend\w*/i, "Shoghi Effendi"],
  [/El\s+B[aá]b/i, "El Báb"],
  [/Casa\s+Universal(\s+de\s+Justicia)?/i, "La Casa Universal de Justicia"],
];

function canonicalAuthor(reference) {
  for (const [re, name] of AUTHOR_PATTERNS) {
    if (re.test(reference)) return name;
  }
  return reference.split(",")[0].trim();
}

function fixOcr(reference) {
  let out = reference;
  for (const [re, name] of AUTHOR_PATTERNS) {
    out = out.replace(re, name);
  }
  // "Shoghi Effendi MVB, pág. 70" → "Shoghi Effendi, MVB, pág. 70"
  return out.replace(/^(Bahá'u'lláh|‘Abdu'l-Bahá|Shoghi Effendi|El Báb) (?=[A-Z])/, "$1, ");
}

/**
 * Parsea el cuerpo de una sección en citas individuales.
 * Formato del original:
 *   1. Texto de la cita <br>
 *   Autor, Obra, pág. XX <br><br>
 */
function parseQuotes(sectionHtml) {
  const cleaned = decodeEntities(
    sectionHtml
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|tr|li)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  );

  // Cada cita arranca con "N." al comienzo de un párrafo.
  const blocks = cleaned
    .split(/\n\s*(?=\d+\.\s)/g)
    .map((b) => b.trim())
    .filter((b) => /^\d+\.\s/.test(b));

  const quotes = [];
  for (const block of blocks) {
    const lines = block
      .replace(/^\d+\.\s*/, "")
      .split("\n")
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (lines.length === 0) continue;

    // La atribución es la última línea que menciona autor o página.
    let attribIdx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (
        /\bp[áa]gs?\b/i.test(lines[i]) ||
        /\b(Bah[aá]'?u'?ll[aá]h|Abdu'?l[- ]?Bah[aá]|Shoghi|El B[aá]b|Casa Universal)\b/i.test(
          lines[i]
        )
      ) {
        attribIdx = i;
        break;
      }
    }
    if (attribIdx <= 0) continue; // sin texto o sin referencia → se descarta

    const text = lines.slice(0, attribIdx).join(" ").trim();
    const reference = lines
      .slice(attribIdx)
      .join(" ")
      .trim()
      .replace(/\s*\bt\s*$/, ""); // ruido de OCR al final de algunas referencias

    if (text.length < 25) continue; // fragmentos sueltos, no son citas
    quotes.push({
      text,
      reference: fixOcr(reference),
      author: canonicalAuthor(reference),
    });
  }
  return quotes;
}

const topics = [];
const seen = new Set();

for (const section of splitSections(html)) {
  if (!section.heading) continue;
  const quotes = parseQuotes(section.body);
  // Una sección es un tema si rindió al menos 2 citas. Así se descartan
  // encabezados sueltos (índice, notas, abreviaturas).
  if (quotes.length < 2) {
    console.error(`— descartado: "${section.heading}" (${quotes.length} citas)`);
    continue;
  }
  const id = slugify(section.heading);
  if (seen.has(id)) {
    console.error(`— duplicado: "${section.heading}"`);
    continue;
  }
  seen.add(id);
  topics.push({
    id,
    name: section.heading,
    quotes: quotes.map((q, i) => ({ id: `${id}-${i + 1}`, ...q })),
  });
  console.error(`✓ ${section.heading}: ${quotes.length} citas`);
}

const total = topics.reduce((n, t) => n + t.quotes.length, 0);
console.error(`\nTotal: ${topics.length} temas, ${total} citas.`);

const out = {
  source:
    "La Fuente de Todo Bien — compilación de Reed Chandler para la Asamblea Espiritual Nacional de los Bahá'ís de Chile (1991).",
  sourceUrl: "https://bahai-library.com/reed_fuente_todo_bien",
  generatedAt: new Date().toISOString().slice(0, 10),
  topicCount: topics.length,
  quoteCount: total,
  topics,
};

process.stdout.write(JSON.stringify(out, null, 1));
