#!/usr/bin/env node
/**
 * Carga el corpus del buscador (migración 053) en `corpus_chunks`:
 * los Markdown exportados por export-materiales-md.mjs y
 * export-mensajes-md.mjs, más las citas de public/citas.json.
 *
 * Uso:
 *   node scripts/load-corpus.mjs [carpeta-md] [--only=libro|ruhi|mensaje|cita] [--dry-run]
 *
 * Carpeta por defecto: ../ComunidadBahai-materiales (la del export).
 * Escribe con SUPABASE_SERVICE_ROLE_KEY de .env.local (no hay policy de
 * insert). Por cada tipo BORRA todo y vuelve a insertar: los ids son
 * estables ("<kind>:<doc>:<n>") pero si cambia el troceado quedarían
 * filas huérfanas, y recargar entero es barato (~12 mil filas).
 *
 * El troceado es la parte que importa para la calidad de la búsqueda.
 * Un "pasaje" tiene entre ~40 y ~300 palabras: lo bastante corto para
 * mostrarse entero en el celular y lo bastante largo para tener sentido
 * solo. Reglas:
 *   - se parte por los párrafos del Markdown;
 *   - un párrafo corto que empieza con "(" es la referencia de la cita
 *     anterior (recopilaciones del Panel) y se pega al pasaje ANTERIOR;
 *   - cualquier otro párrafo corto (títulos, encabezados) se pega al
 *     SIGUIENTE hasta llegar al mínimo;
 *   - un párrafo largo se parte por oraciones en trozos de ~180 palabras;
 *   - en los Ruhi se descartan las líneas de ejercicio (preguntas con
 *     puntos de relleno, viñetas de consigna, "SECCIÓN 3"): se busca en
 *     lo que el libro cita y explica, no en las preguntas al estudiante;
 *   - las citas van una por fila, sin trocear, deduplicadas por texto
 *     (la compilación repite 30 en dos temas).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith("--"));
const positional = args.filter((a) => !a.startsWith("--"));
const MD_ROOT = path.resolve(positional[0] ?? path.join(here, "..", "..", "ComunidadBahai-materiales"));
const ONLY = flags.find((f) => f.startsWith("--only="))?.slice(7) ?? null;
const DRY = flags.includes("--dry-run");

const MIN_WORDS = 40;
const MAX_WORDS = 300;
const SPLIT_TARGET = 180;

// ─── env ──────────────────────────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync(path.join(here, "..", ".env.local"), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    })
);
const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!DRY && (!BASE || !KEY)) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

// ─── helpers ──────────────────────────────────────────────────────────
const words = (s) => s.split(/\s+/).filter(Boolean).length;

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { fm: {}, body: text };
  const fm = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (v === "null") v = null;
    else if (/^-?\d+$/.test(v)) v = Number(v);
    else if (v.startsWith('"')) {
      try {
        v = JSON.parse(v);
      } catch {
        /* tal cual */
      }
    }
    fm[k] = v;
  }
  return { fm, body: m[2] };
}

/** Saca el "# Título" y el "*Autor*" que el export puso arriba del cuerpo. */
function stripHeading(body) {
  return body
    .replace(/^\s*# [^\n]*\n+/, "")
    .replace(/^\s*\*[^\n]*\*\n+/, "")
    .trim();
}

/** Líneas de ejercicio de los cuadernos Ruhi. */
function isExercise(p) {
  if (p.includes("…")) return true; // puntos de relleno de la respuesta
  if (/^\d{1,2}\.\s/.test(p) && /\?\s*$/.test(p)) return true; // pregunta numerada
  if (/^-\s/.test(p) && words(p) < 40) return true; // viñeta de consigna
  if (/^SECCI[ÓO]N\s+\d+/i.test(p)) return true;
  return false;
}

/** Parte un párrafo largo por oraciones en trozos de ~SPLIT_TARGET palabras. */
function splitLong(p) {
  const sentences = p.match(/[^.!?»”]+[.!?»”]+["»”’]?\s*|[^.!?»”]+$/g) ?? [p];
  const out = [];
  let cur = "";
  for (const s of sentences) {
    if (cur && words(cur) + words(s) > SPLIT_TARGET) {
      out.push(cur.trim());
      cur = "";
    }
    cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/**
 * Párrafos -> pasajes. Devuelve textos de MIN_WORDS..MAX_WORDS palabras
 * (salvo el último de un documento, que puede quedar corto).
 */
function chunkParagraphs(paragraphs) {
  const chunks = [];
  let buf = "";
  const flush = () => {
    if (buf.trim()) chunks.push(buf.trim());
    buf = "";
  };
  for (const raw of paragraphs) {
    const p = raw.replace(/\s+/g, " ").trim();
    if (!p) continue;
    const n = words(p);
    // Referencia de la cita anterior: "(Bahá'u'lláh, Pasajes..., CIX)".
    if (p.startsWith("(") && n < MIN_WORDS) {
      if (buf) buf += " " + p;
      else if (chunks.length) chunks[chunks.length - 1] += " " + p;
      else buf = p;
      continue;
    }
    if (n > MAX_WORDS) {
      flush();
      chunks.push(...splitLong(p));
      continue;
    }
    buf = buf ? buf + " " + p : p;
    if (words(buf) >= MIN_WORDS) flush();
  }
  flush();
  return chunks.filter((c) => words(c) >= 12);
}

// ─── fuentes ──────────────────────────────────────────────────────────
function loadMarkdownKind(dir, kind) {
  const rows = [];
  if (!existsSync(dir)) {
    console.warn(`  ! no existe ${dir}, se salta ${kind}`);
    return rows;
  }
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
    const { fm, body } = frontmatter(readFileSync(path.join(dir, file), "utf8"));
    const docKey = file.replace(/\.md$/, "");
    const title = fm.title ?? docKey;
    const author = fm.author_or_section ?? null;
    let paragraphs = stripHeading(body).split(/\n\s*\n/);
    if (kind === "ruhi") paragraphs = paragraphs.filter((p) => !isExercise(p.trim()));
    const chunks = chunkParagraphs(paragraphs);
    const reference =
      kind === "ruhi"
        ? `Instituto Ruhí, Libro ${fm.number}: ${title}`
        : kind === "mensaje"
          ? `Casa Universal de Justicia, ${title}`
          : author
            ? `${author}, ${title}`
            : title;
    chunks.forEach((c, i) => {
      rows.push({
        id: `${kind}:${docKey}:${i + 1}`,
        source_kind: kind,
        doc_key: docKey,
        doc_title: kind === "ruhi" ? `Libro ${fm.number} · ${title}` : title,
        author: kind === "mensaje" ? "Casa Universal de Justicia" : author,
        reference,
        position: i + 1,
        body: c,
        word_count: words(c),
      });
    });
  }
  return rows;
}

function loadCitas() {
  const data = JSON.parse(readFileSync(path.join(here, "..", "public", "citas.json"), "utf8"));
  const seen = new Set();
  const rows = [];
  const norm = (t) =>
    t
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  for (const topic of data.topics) {
    topic.quotes.forEach((q, i) => {
      const key = norm(q.text);
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({
        id: `cita:${topic.id}:${i + 1}`,
        source_kind: "cita",
        doc_key: topic.id,
        doc_title: topic.name,
        author: q.author,
        reference: q.reference,
        position: i + 1,
        body: q.text.replace(/\s+/g, " ").trim(),
        word_count: words(q.text),
      });
    });
  }
  return rows;
}

// ─── carga ────────────────────────────────────────────────────────────
const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

async function replaceKind(kind, rows) {
  if (DRY) return;
  const del = await fetch(`${BASE}/rest/v1/corpus_chunks?source_kind=eq.${kind}`, {
    method: "DELETE",
    headers: { ...headers, Prefer: "return=minimal" },
  });
  if (!del.ok) throw new Error(`DELETE ${kind}: ${del.status} ${await del.text()}`);
  const BATCH = 400;
  for (let i = 0; i < rows.length; i += BATCH) {
    const res = await fetch(`${BASE}/rest/v1/corpus_chunks`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify(rows.slice(i, i + BATCH)),
    });
    if (!res.ok) throw new Error(`INSERT ${kind} [${i}]: ${res.status} ${await res.text()}`);
  }
}

const SOURCES = [
  ["libro", () => loadMarkdownKind(path.join(MD_ROOT, "md", "libros"), "libro")],
  ["ruhi", () => loadMarkdownKind(path.join(MD_ROOT, "md", "ruhi"), "ruhi")],
  ["mensaje", () => loadMarkdownKind(path.join(MD_ROOT, "md", "mensajes"), "mensaje")],
  ["cita", loadCitas],
];

let total = 0;
for (const [kind, load] of SOURCES) {
  if (ONLY && ONLY !== kind) continue;
  const rows = load();
  const docs = new Set(rows.map((r) => r.doc_key)).size;
  const wc = rows.map((r) => r.word_count).sort((a, b) => a - b);
  const med = wc[Math.floor(wc.length / 2)] ?? 0;
  console.log(
    `${kind}: ${rows.length} pasajes de ${docs} documentos · mediana ${med} palabras · máx ${wc.at(-1) ?? 0}`
  );
  if (DRY) {
    for (const r of rows.slice(0, 2)) console.log("   ·", r.reference, "→", r.body.slice(0, 140) + "…");
  } else {
    await replaceKind(kind, rows);
  }
  total += rows.length;
}
console.log(`\n${DRY ? "(dry-run) " : ""}Total: ${total} pasajes${DRY ? "" : " cargados en corpus_chunks"}.`);
