// Verifica las garantías de la "Cita del día" sobre public/citas.json.
//
//   node scripts/check-citas.mjs     (o: npm run check:citas)
//
// Comprueba que:
//   1. El pool del sorteo no tenga dos veces el mismo texto.
//   2. En NINGUNA ventana de 7 días consecutivos se repita una cita,
//      recorriendo un ciclo entero desde varias fechas de arranque.
//   3. El paso multiplicativo sea coprimo con el total (si no, la
//      secuencia se cerraría antes de recorrer todo el corpus).
//
// Correrlo después de regenerar el corpus con scripts/build-citas.mjs:
// si cambia la cantidad de citas, cambian las tres cosas de arriba.
//
// La lógica está duplicada a propósito respecto de lib/citas.ts (que es
// TypeScript y server-only): sirve de contraverificación independiente.

import { readFileSync } from "node:fs";

const VENTANA = 7;
const data = JSON.parse(readFileSync(new URL("../public/citas.json", import.meta.url), "utf8"));

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const seen = new Set();
const pool = [];
const descartadas = [];
for (const topic of data.topics) {
  for (const cita of topic.quotes) {
    const key = normalizeText(cita.text);
    if (seen.has(key)) {
      descartadas.push({ topic: topic.name, text: cita.text.slice(0, 60) });
      continue;
    }
    seen.add(key);
    pool.push({ key, topic: topic.name, text: cita.text });
  }
}

const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
function step(total) {
  let s = 389;
  while (s > 1 && gcd(s, total) !== 1) s--;
  return Math.max(1, s);
}

const N = pool.length;
const S = step(N);
const fallos = [];

console.log(`Corpus: ${data.quoteCount} citas en ${data.topicCount} temas.`);
console.log(`Pool del sorteo: ${N} textos únicos (${descartadas.length} repetidos entre temas).`);
console.log(`Paso: ${S} — ciclo completo: ${(N / 365.25).toFixed(1)} años.`);

// 1. Textos únicos en el pool.
if (new Set(pool.map((p) => p.key)).size !== N) {
  fallos.push("El pool tiene textos duplicados.");
}

// 2. Coprimalidad.
if (gcd(S, N) !== 1) {
  fallos.push(`El paso ${S} no es coprimo con ${N}: la secuencia no recorre todo el corpus.`);
}

// 3. Ventana deslizante sobre un ciclo entero, desde varios arranques.
for (const arranque of [0, 20_000, 20_500, 21_000]) {
  for (let k = 0; k < N; k++) {
    const ventana = new Set();
    for (let j = 0; j < VENTANA; j++) {
      ventana.add(pool[((arranque + k + j) * S) % N].key);
    }
    if (ventana.size !== VENTANA) {
      fallos.push(`Repetición dentro de ${VENTANA} días (arranque ${arranque}, día ${k}).`);
      break;
    }
  }
}

// 4. Cobertura: la secuencia toca todas las citas del pool.
const tocadas = new Set();
for (let k = 0; k < N; k++) tocadas.add((k * S) % N);
if (tocadas.size !== N) {
  fallos.push(`La secuencia solo recorre ${tocadas.size} de ${N} citas.`);
}

if (fallos.length > 0) {
  console.error("\n✗ FALLA:");
  for (const f of fallos) console.error("  - " + f);
  process.exit(1);
}

console.log(`\n✓ Sin repeticiones en ninguna ventana de ${VENTANA} días, y la secuencia recorre las ${N}.`);
