// @ts-nocheck
/**
 * Genera public/oraciones.json a partir del texto extraído del PDF oficial
 * de Oraciones Bahá'ís (Panel Internacional de Traducción, 8 ene 2020).
 *
 * Uso:
 *   pdftotext -layout -enc UTF-8 ORACIONES.pdf _oraciones_raw.txt
 *   node scripts/build-oraciones.mjs _oraciones_raw.txt
 *
 * Estrategia:
 *  1. Parsear el ÍNDICE → lista ordenada de nodos {name, level} donde
 *     level = "group" | "main" | "sub". La indentación distingue main/sub.
 *  2. Recorrer el cuerpo: los encabezados van en MAYÚSCULAS; se alinean
 *     posicionalmente contra los nodos del índice (resuelve nombres
 *     repetidos como "Bebés"/"Mujeres"). Las oraciones se cortan por la
 *     línea de autor (Bahá'u'lláh / ‘Abdu'l-Bahá / El Báb).
 *  3. Subcategorías → se pliegan dentro de su categoría main como `section`
 *     de cada oración. Título de cada oración = primeras ~7 palabras
 *     (o el nombre de la categoría si es la única de esa categoría).
 */

import { readFileSync, writeFileSync } from "node:fs";

const GROUPS = [
  "ORACIONES OBLIGATORIAS",
  "ORACIONES GENERALES",
  "ORACIONES ESPECIALES",
  "TABLAS ESPECIALES",
];

const inputPath = process.argv[2] || "_oraciones_raw.txt";
const raw = readFileSync(inputPath, "utf8");
const lines = raw.split(/\r?\n/);

// ── helpers ──────────────────────────────────────────────────────────
const norm = (s) =>
  s
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const isAllCaps = (s) => {
  const t = s.trim();
  if (t.length < 3) return false;
  if (!/[A-ZÁÉÍÓÚÜÑḤḦĀĪŪ]/.test(t)) return false;
  // Igual a su versión en mayúsculas, ignorando dígitos/puntuación.
  return t === t.toLocaleUpperCase("es") && /[A-ZÁÉÍÓÚ]/i.test(t);
};

const AUTHOR_PATTERNS = [
  [/^bahá'u'lláh$/i, "Bahá'u'lláh"],
  [/^'abdu'l-bahá$/i, "‘Abdu'l-Bahá"],
  [/^abdu'l-bahá$/i, "‘Abdu'l-Bahá"],
  [/^el báb$/i, "El Báb"],
  [/^báb$/i, "El Báb"],
];
function matchAuthor(line) {
  // El autor puede venir con raya ("—Bahá'u'lláh") o con marcador de nota
  // al final ("El Báb*"); lo limpiamos antes de comparar.
  const t = norm(line)
    .replace(/^[—–-]\s*/, "")
    .replace(/[*†‡§]+$/, "")
    .trim();
  for (const [re, name] of AUTHOR_PATTERNS) if (re.test(t)) return name;
  return null;
}

const slug = (s) =>
  norm(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// ── 1. localizar ÍNDICE y CUERPO ────────────────────────────────────
const indiceStart = lines.findIndex((l) => norm(l) === "ÍNDICE" || norm(l) === "ÍNDICE*");
// El cuerpo empieza en la 2ª aparición de "ORACIONES OBLIGATORIAS".
let bodyStart = -1;
let seenObligatorias = 0;
for (let i = 0; i < lines.length; i++) {
  if (norm(lines[i]) === "ORACIONES OBLIGATORIAS") {
    seenObligatorias++;
    if (seenObligatorias === 2) {
      bodyStart = i;
      break;
    }
  }
}
if (indiceStart < 0 || bodyStart < 0) {
  console.error("No se encontró ÍNDICE o inicio de cuerpo.");
  process.exit(1);
}

// ── 2. parsear ÍNDICE → nodos ordenados ─────────────────────────────
/** @type {{name:string, level:"group"|"main"|"sub"}[]} */
const indexNodes = [];
for (let i = indiceStart + 1; i < bodyStart; i++) {
  const lineRaw = lines[i];
  const t = norm(lineRaw);
  if (!t) continue;
  if (GROUPS.includes(t)) {
    indexNodes.push({ name: t, level: "group" });
    continue;
  }
  // Entrada con líder de puntos + número de página.
  const m = lineRaw.match(/^(\s*)(.+?)\.{2,}\s*\d+\s*$/);
  if (m) {
    const lead = m[1].length;
    const name = m[2].trim();
    indexNodes.push({ name, level: lead >= 2 ? "sub" : "main" });
    continue;
  }
  // Encabezado de índice sin número (padre de subs, p.ej. "Tablas de Visitación").
  if (/^[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(t) && !/\.{2,}/.test(t) && !t.startsWith("*")) {
    indexNodes.push({ name: t, level: "main" });
  }
}

// Mapa normalizado → cola de nodos (para alinear por orden y resolver dups).
const nodeQueue = indexNodes.map((n) => ({ ...n, key: norm(n.name).toLowerCase() }));
let nodePtr = 0;
// Limpia marcadores de nota al pie y puntuación de borde de un encabezado.
const cleanHeader = (s) =>
  norm(s).replace(/[*†]+/g, "").replace(/^[\s.,;:]+|[\s.,;:]+$/g, "").trim();
function advanceToHeader(headerCaps) {
  const key = cleanHeader(headerCaps).toLowerCase();
  for (let j = nodePtr; j < nodeQueue.length; j++) {
    if (nodeQueue[j].key === key) {
      nodePtr = j + 1;
      return nodeQueue[j];
    }
  }
  // Búsqueda hacia atrás por si el orden no calza exacto.
  for (let j = 0; j < nodeQueue.length; j++) {
    if (nodeQueue[j].key === key) return nodeQueue[j];
  }
  return null;
}

// ── 3. recorrer CUERPO ──────────────────────────────────────────────
const groups = [];
let curGroup = null;
let curCat = null;
let curSection = null;
let buf = []; // párrafos de la oración actual (array de líneas crudas ya unidas)
let para = [];

const usedCatIds = new Set();
function newCatId(name) {
  let base = slug(name) || "cat";
  let id = base;
  let n = 2;
  while (usedCatIds.has(id)) id = `${base}-${n++}`;
  usedCatIds.add(id);
  return id;
}

function flushPara() {
  if (para.length) {
    buf.push(para.join(" ").replace(/\s+/g, " ").trim());
    para = [];
  }
}
function flushPrayer(author) {
  flushPara();
  const body = buf.join("\n\n").trim();
  buf = [];
  if (!body || !curCat) return;
  curCat.prayers.push({
    author,
    section: curSection,
    _body: body,
  });
}

const warnings = [];

for (let i = bodyStart; i < lines.length; i++) {
  const lineRaw = lines[i];
  const t = norm(lineRaw);

  if (!t) {
    flushPara();
    continue;
  }
  // Pies de página / notas (incluye ‡ § usados como marcadores).
  if (/^[*†‡§]/.test(t)) continue;
  // Número de página suelto.
  if (/^\d+$/.test(t)) continue;
  // Header del documento.
  if (/^ORACIONES BAHÁ'?ÍS/i.test(t)) continue;

  // ¿Autor? → cierra oración.
  const author = matchAuthor(lineRaw);
  if (author) {
    flushPrayer(author);
    continue;
  }

  // ¿Grupo?
  if (GROUPS.includes(t)) {
    flushPrayer(null); // por si quedó algo colgado
    curGroup = { id: slug(t), name: titleGroup(t), categories: [] };
    groups.push(curGroup);
    curCat = null;
    curSection = null;
    advanceToHeader(t);
    continue;
  }

  // ¿Encabezado (categoría o subcategoría)?
  if (isAllCaps(lineRaw)) {
    const node = advanceToHeader(lineRaw);
    if (!node) {
      // No está en el índice → es un sub-encabezado descriptivo (p.ej. los
      // regionales de las Tablas del Plan Divino). Lo usamos como sección
      // dentro de la categoría actual, no como categoría nueva.
      warnings.push(`Encabezado fuera de índice (→ sección): "${cleanHeader(lineRaw)}"`);
      flushPrayer(null);
      if (curCat) curSection = toTitle(cleanHeader(lineRaw));
      continue;
    }
    if (node.level === "group") {
      continue; // ya manejado arriba normalmente
    }
    if (node.level === "main") {
      flushPrayer(null);
      curSection = null;
      curCat = { id: newCatId(node.name), name: node.name, prayers: [] };
      (curGroup || ensureGroup()).categories.push(curCat);
    } else {
      // sub → sección dentro de la categoría actual
      flushPrayer(null);
      curSection = node.name;
      if (!curCat) {
        curCat = { id: newCatId(node.name), name: node.name, prayers: [] };
        (curGroup || ensureGroup()).categories.push(curCat);
        curSection = null;
      }
    }
    continue;
  }

  // Línea de cuerpo de oración.
  para.push(t);
}
flushPrayer(null);

function ensureGroup() {
  if (!curGroup) {
    curGroup = { id: "otras", name: "Otras", categories: [] };
    groups.push(curGroup);
  }
  return curGroup;
}
function titleGroup(caps) {
  return toTitle(caps);
}
function toTitle(caps) {
  const lower = caps.toLocaleLowerCase("es");
  return lower.charAt(0).toLocaleUpperCase("es") + lower.slice(1);
}

// ── 4. títulos + ids de oración ─────────────────────────────────────
function makeTitle(body, catName, onlyOne) {
  if (onlyOne) return catName;
  const words = body.replace(/\s+/g, " ").trim().split(" ");
  const slice = words.slice(0, 7).join(" ").replace(/[.,;:¡!¿?]+$/, "");
  return words.length > 7 ? `${slice}…` : slice;
}

// Descartar fragmentos sin autor (notas al pie que envuelven, etc.).
// Toda oración real termina con atribución (Báb / Bahá'u'lláh / ‘Abdu'l-Bahá).
let dropped = 0;
for (const g of groups) {
  for (const c of g.categories) {
    const before = c.prayers.length;
    c.prayers = c.prayers.filter((p) => p.author);
    dropped += before - c.prayers.length;
  }
}

let totalPrayers = 0;
for (const g of groups) {
  for (const c of g.categories) {
    const onlyOne = c.prayers.length === 1;
    c.prayers = c.prayers.map((p, idx) => {
      totalPrayers++;
      return {
        id: `${c.id}-${idx + 1}`,
        title: makeTitle(p._body, c.name, onlyOne),
        author: p.author,
        section: p.section || undefined,
        body: p._body,
      };
    });
  }
  // limpiar categorías vacías
  g.categories = g.categories.filter((c) => c.prayers.length > 0);
}

const out = {
  source:
    "Oraciones Bahá'ís — Traducción del Panel Internacional de Traducción (8 enero 2020), bahai.org/library.",
  generatedAt: new Date().toISOString().slice(0, 10),
  groups: groups.filter((g) => g.categories.length > 0),
};

writeFileSync("public/oraciones.json", JSON.stringify(out, null, 2), "utf8");

// ── stats ────────────────────────────────────────────────────────────
console.log("Grupos:", out.groups.length);
for (const g of out.groups) {
  console.log(
    `  ${g.name}: ${g.categories.length} categorías, ${g.categories.reduce(
      (a, c) => a + c.prayers.length,
      0
    )} oraciones`
  );
}
console.log("Total oraciones:", totalPrayers, "| descartadas sin autor:", dropped);
if (warnings.length) {
  console.log("\nAdvertencias:");
  for (const w of warnings) console.log("  -", w);
}
