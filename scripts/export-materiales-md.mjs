#!/usr/bin/env node
/**
 * Exporta los Materiales con PDF (study_materials.pdf_url) a Markdown
 * plano, para usarlos con Claude u otra herramienta de texto.
 *
 * Uso:
 *   node scripts/export-materiales-md.mjs [carpeta-destino] [--only=<kind>] [--force]
 *
 * Destino por defecto: ../ComunidadBahai-materiales (FUERA del repo, a
 * propósito: son ~46 MB de PDF). Deja:
 *   <destino>/pdf/<kind>/<slug>.pdf   el original bajado del bucket
 *   <destino>/md/<kind>/<slug>.md     frontmatter + texto plano
 *   <destino>/INDICE.md               una línea por documento
 *
 * Requiere `pdftotext` (Poppler) en el PATH; en esta máquina viene con
 * Git Bash (/mingw64/bin). No usa -layout: para lectura corrida el modo
 * simple da párrafos más limpios. Fiel antes que bonito: no se inventan
 * títulos ni se reordena nada; ver clean() para lo que sí se toca.
 *
 * Lee NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY de
 * .env.local (la lectura de study_materials nacionales y el bucket
 * `materiales` son públicos). Es idempotente: no vuelve a bajar un PDF
 * que ya está ni a convertir uno ya convertido; --force reconvierte
 * (sin volver a bajar).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith("--"));
const positional = args.filter((a) => !a.startsWith("--"));
const OUT = path.resolve(
  positional[0] ?? path.join(here, "..", "..", "ComunidadBahai-materiales")
);
const FORCE = flags.includes("--force");
const ONLY = flags.find((f) => f.startsWith("--only="))?.slice(7) ?? null;

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
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!BASE || !KEY) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local"
  );
  process.exit(1);
}
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

// ─── filas ────────────────────────────────────────────────────────────
let q = `${BASE}/rest/v1/study_materials?select=id,kind,number,title,subtitle,pdf_url,locality_id&pdf_url=not.is.null&order=kind,number,title`;
if (ONLY) q += `&kind=eq.${encodeURIComponent(ONLY)}`;
const res = await fetch(q, { headers });
if (!res.ok) {
  console.error("Error leyendo study_materials:", res.status, await res.text());
  process.exit(1);
}
const rows = await res.json();
console.log(`${rows.length} materiales con PDF -> ${OUT}`);

// ─── helpers ──────────────────────────────────────────────────────────
function slugFromUrl(url, title) {
  const base = decodeURIComponent(url.split("/").pop() ?? "").replace(/\.pdf$/i, "");
  if (base) return base;
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function yaml(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  return JSON.stringify(String(v));
}

/**
 * Limpieza conservadora del texto de pdftotext. Dos familias de PDF
 * conviven en el bucket y se contradicen: en los Ruhi cada párrafo ya
 * viene en UNA línea y no hay líneas en blanco; en los del Panel cada
 * línea impresa viene seguida de una línea en blanco. Así que la línea
 * en blanco no sirve como señal de párrafo y el corte se decide por el
 * ANCHO de cada línea respecto del ancho pleno de la página:
 *  - una línea más corta que el 85 % del ancho pleno termina párrafo
 *    (es la última línea de un párrafo justificado, o un título);
 *  - una línea que arranca con marca de ítem ([22], 1., viñeta, raya,
 *    comillas o pregunta) empieza párrafo;
 *  - las líneas en blanco solo cuentan si en esa página son la minoría
 *    (una entre cada dos líneas es interlineado, no párrafo).
 * Además: se unen las palabras cortadas con guion, se sacan los folios
 * sueltos y los encabezados/pies que se repiten en más del 30 % de las
 * páginas (o con forma "Sección – 7" en al menos dos), una referencia
 * entre paréntesis no se parte aunque ocupe dos líneas cortas, y los
 * caracteres de control o glifos sin mapa (U+FFFD y
 * retrocesos: puntos de relleno y viñetas de los Ruhi) pasan a viñeta
 * o puntos suspensivos.
 */
// Glifos que pdftotext no pudo mapear (U+FFFD), retroceso y campana:
// en los Ruhi son las viñetas y los puntos de relleno de las respuestas.
// Se arman con fromCharCode para que el archivo fuente no lleve bytes de control.
const cc = (...codes) => String.fromCharCode(...codes);
const GLYPH = cc(0xfffd, 0x08, 0x07);
const BULLET_START = new RegExp(`^[\\s${GLYPH}•·]+(?=\\S)`);
const HAS_BULLET = new RegExp(`[${GLYPH}•·]`);
const GLYPH_RUN = new RegExp(`[${GLYPH}]{2,}`, "g");
const CONTROL = new RegExp(`[${cc(0)}-${cc(8)}${cc(11)}${cc(14)}-${cc(31)}${cc(0xfffd)}]`, "g");

function clean(raw) {
  const pages = raw
    .replace(/\r/g, "")
    .split("\f")
    .map((p) =>
      p.split("\n").map((l) =>
        l
          .replace(BULLET_START, (m) => (HAS_BULLET.test(m) ? "- " : ""))
          .replace(GLYPH_RUN, " … ")
          .replace(CONTROL, "")
          .trim()
      )
    );

  // Encabezados/pies repetidos: la misma línea (con los dígitos
  // normalizados) en los bordes de muchas páginas.
  const edgeCount = new Map();
  const norm = (l) => l.replace(/\d+/g, "#");
  for (const lines of pages) {
    const txt = lines.filter(Boolean);
    const edges = new Set([...txt.slice(0, 2), ...txt.slice(-2)].map(norm));
    for (const e of edges) edgeCount.set(e, (edgeCount.get(e) ?? 0) + 1);
  }
  const minRep = Math.max(3, Math.ceil(pages.length * 0.3));
  const isFolio = (l) => /^\d{1,4}$/.test(l);
  const FOLIO_EDGE = /\s[–—-]\s#$|^#\s[–—-]\s/;
  const isRunning = (l) => {
    if (l.length >= 90) return false;
    const n = edgeCount.get(norm(l)) ?? 0;
    return n >= minRep || (n >= 2 && FOLIO_EDGE.test(norm(l)));
  };

  const ITEM_START = /^(\[\d+\]|\d{1,3}[.)]\s|-\s|—|–\s|[¿¡«“"(]|[A-ZÁÉÍÓÚÑ]{2,}\b)/;
  const out = [];
  for (const lines of pages) {
    const txt = lines.filter((l) => l && !isFolio(l) && !isRunning(l));
    if (!txt.length) continue;
    const lens = txt.map((l) => l.length).sort((a, b) => a - b);
    const full = lens[Math.floor(lens.length * 0.9)] ?? 0;
    const blanks = lines.filter((l) => !l).length;
    const blanksMeanParagraph = blanks < txt.length * 0.5;

    let para = [];
    const flush = () => {
      if (!para.length) return;
      let text = "";
      for (const l of para) {
        if (!text) text = l;
        else if (/[A-Za-zÀ-ſ]-$/.test(text)) text = text.slice(0, -1) + l;
        else text += " " + l;
      }
      out.push(text.replace(/ {2,}/g, " "));
      para = [];
    };
    const openParen = (ls) => {
      const t = ls.join(" ");
      return (t.match(/\(/g) ?? []).length > (t.match(/\)/g) ?? []).length;
    };
    let prevBlank = false;
    for (const l of lines) {
      if (!l) {
        prevBlank = true;
        continue;
      }
      if (isFolio(l) || isRunning(l)) continue;
      if (para.length && ((prevBlank && blanksMeanParagraph) || ITEM_START.test(l))) flush();
      prevBlank = false;
      para.push(l);
      if (l.length < full * 0.85 && !openParen(para)) flush();
    }
    flush();
  }
  return out.join("\n\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

// ─── main ─────────────────────────────────────────────────────────────
const index = [];
let ok = 0;
let skipped = 0;
let failed = 0;
for (const r of rows) {
  const slug = slugFromUrl(r.pdf_url, r.title);
  const pdfDir = path.join(OUT, "pdf", r.kind);
  const mdDir = path.join(OUT, "md", r.kind);
  mkdirSync(pdfDir, { recursive: true });
  mkdirSync(mdDir, { recursive: true });
  const pdfPath = path.join(pdfDir, `${slug}.pdf`);
  const mdPath = path.join(mdDir, `${slug}.md`);

  try {
    if (!FORCE && existsSync(pdfPath) && existsSync(mdPath)) {
      skipped++;
      index.push({ r, slug, mdPath });
      continue;
    }
    if (!existsSync(pdfPath)) {
      const dl = await fetch(r.pdf_url);
      if (!dl.ok) throw new Error(`HTTP ${dl.status} bajando el PDF`);
      writeFileSync(pdfPath, Buffer.from(await dl.arrayBuffer()));
    }

    const raw = execFileSync("pdftotext", ["-enc", "UTF-8", pdfPath, "-"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    const body = clean(raw);
    const words = body.split(/\s+/).filter(Boolean).length;
    if (words < 50) {
      console.warn(`  ! ${r.title}: solo ${words} palabras (PDF escaneado sin texto?)`);
    }

    const md = [
      "---",
      `title: ${yaml(r.title)}`,
      `author_or_section: ${yaml(r.subtitle)}`,
      `kind: ${yaml(r.kind)}`,
      `number: ${yaml(r.number)}`,
      `scope: ${yaml(r.locality_id ? "local" : "nacional")}`,
      `source_pdf: ${yaml(r.pdf_url)}`,
      `supabase_id: ${yaml(r.id)}`,
      `words: ${words}`,
      `exported_at: ${yaml(new Date().toISOString().slice(0, 10))}`,
      "---",
      "",
      `# ${r.title}`,
      "",
      r.subtitle ? `*${r.subtitle}*\n` : "",
      body,
    ]
      .join("\n")
      .replace(/\n{3,}/g, "\n\n");
    writeFileSync(mdPath, md);
    ok++;
    index.push({ r, slug, mdPath, words });
    console.log(`  + ${r.kind}/${slug}.md (${words} palabras)`);
  } catch (e) {
    failed++;
    console.error(`  x ${r.title}: ${e.message}`);
  }
}

// ─── índice ───────────────────────────────────────────────────────────
const byKind = {};
for (const it of index) (byKind[it.r.kind] ??= []).push(it);
const lines = [
  "# Materiales exportados",
  "",
  `Origen: bucket \`materiales\` de Supabase (tabla study_materials), ${new Date()
    .toISOString()
    .slice(0, 10)}. Generado por scripts/export-materiales-md.mjs del repo ComunidadBahai.`,
  "",
];
for (const [kind, items] of Object.entries(byKind)) {
  lines.push(`## ${kind} (${items.length})`, "");
  for (const it of items) {
    const rel = path.relative(OUT, it.mdPath).replace(/\\/g, "/");
    const n = it.r.number != null ? `Libro ${it.r.number} · ` : "";
    const sub = it.r.subtitle ? ` — ${it.r.subtitle}` : "";
    lines.push(`- [${n}${it.r.title}](${rel})${sub}`);
  }
  lines.push("");
}
writeFileSync(path.join(OUT, "INDICE.md"), lines.join("\n"));

console.log(
  `\nListo: ${ok} exportados, ${skipped} ya estaban, ${failed} fallaron. Indice en ${path.join(OUT, "INDICE.md")}`
);
if (failed) process.exit(1);
