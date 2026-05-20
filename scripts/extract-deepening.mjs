// Extrae citas del compilatorio "Fuente de Todo Bien, La" desde el HTML descargado
// para construir el pool de profundización. Selecciona las primeras 3 citas
// representativas por cada tema elegido.
//
// Uso: node scripts/extract-deepening.mjs > /tmp/extracted-deepening.json

import { readFileSync } from "node:fs";

const SOURCE_PATH = process.env.SOURCE_HTML
  ?? "C:/Users/jorge/AppData/Local/Temp/bl/fuente.html";
const html = readFileSync(SOURCE_PATH, "utf8");

// 20 temas seleccionados — nombres tal como aparecen en los <h3>.
const TOPICS = [
  "Amor",
  "Buen Carácter",
  "Cercanía a Dios",
  "Conciencia Espiritual",
  "Conocimiento",
  "Consulta",
  "Cooperación",
  "Coraje",
  "Cortesía",
  "Desprendimiento",
  "Devoción",
  "Equidad",
  "Esperanza",
  "Fe",
  "Generosidad",
  "Gratitud",
  "Humildad",
  "Justicia",
  "Paciencia",
  "Participación",
];

// Encuentra el <h3> de un tema y devuelve el HTML que sigue hasta el próximo <h3>.
function extractSection(topic) {
  // El h3 puede tener prefijo numérico opcional. Normalizamos para matching.
  const escaped = topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `<h3>\\s*\\d*\\s*\\.?\\s*${escaped}\\s*(?:<br>)?\\s*</h3>([\\s\\S]*?)(?=<h3>|<\\/td>|<\\/table>)`,
    "i"
  );
  const m = html.match(regex);
  return m ? m[1] : null;
}

// Parsea un bloque de sección en citas individuales.
// Formato típico:
//   1. Texto de la cita <br>
//   Autor, Obra, pág. XX <br><br>
function parseQuotes(sectionHtml) {
  if (!sectionHtml) return [];

  // Divide por "<br><br>" o por números al inicio de línea
  const cleaned = sectionHtml
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "") // strip remaining tags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');

  // Cada cita empieza con "N." al inicio de párrafo
  const blocks = cleaned
    .split(/\n\s*(?=\d+\.\s)/g)
    .map((b) => b.trim())
    .filter((b) => /^\d+\./.test(b));

  return blocks.map((block) => {
    // Quita la numeración al inicio
    const noNum = block.replace(/^\d+\.\s*/, "");
    // Divide en líneas y separa texto + atribución
    // La atribución suele estar en las últimas líneas tras el último ".\n"
    const lines = noNum.split("\n").map((l) => l.trim()).filter(Boolean);

    // Heurística: la atribución tiene comas y mención de autor/página
    // Buscamos la última línea que matchee patrón típico de atribución.
    let attribIdx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (
        /\bp[áa]g/i.test(line) ||
        /\b(Bah[aá]'?u'?ll[aá]h|Abdu'?l[- ]?Bah[aá]|Shoghi|B[aá]b|Casa Universal)\b/i.test(line)
      ) {
        attribIdx = i;
        break;
      }
    }

    let text, ref;
    if (attribIdx >= 0) {
      text = lines.slice(0, attribIdx).join(" ").trim();
      ref = lines.slice(attribIdx).join(" ").trim();
    } else {
      text = lines.join(" ").trim();
      ref = "";
    }
    return { text, ref };
  });
}

const result = {};
for (const topic of TOPICS) {
  const section = extractSection(topic);
  const quotes = parseQuotes(section);
  // Toma las primeras 3 que tengan tanto texto como referencia
  const picked = quotes.filter((q) => q.text && q.ref).slice(0, 3);
  result[topic] = picked;
  console.error(`${topic}: ${quotes.length} citas, eligiendo ${picked.length}`);
}

process.stdout.write(JSON.stringify(result, null, 2));
