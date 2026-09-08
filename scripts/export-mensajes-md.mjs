#!/usr/bin/env node
/**
 * Exporta los Mensajes de la Casa Universal de Justicia
 * (messages.source = 'casa_universal') a Markdown plano, para usarlos
 * con Claude u otra herramienta de texto.
 *
 * Uso:
 *   node scripts/export-mensajes-md.mjs [carpeta-destino]
 *
 * Destino por defecto: ../ComunidadBahai-materiales (la misma carpeta
 * que export-materiales-md.mjs, FUERA del repo). Deja un archivo por
 * mensaje en <destino>/md/mensajes/<fecha>-<slug>.md y regenera el
 * INDICE.md común.
 *
 * A diferencia de los Materiales, acá no hay PDF que convertir: el
 * texto completo ya vive en `full_text` (sembrado verbatim desde los
 * txt del usuario por import-ridvan.mjs, o cargado a mano por el Admin
 * Nacional). Se escribe TAL CUAL, solo normalizando los fines de línea:
 * son textos de la Casa de Justicia y no se corrigen. Si un mensaje no
 * tuviera texto pero sí PDF, se avisa y se salta (ver
 * export-materiales-md.mjs para ese camino).
 *
 * Lee la tabla con SUPABASE_SERVICE_ROLE_KEY de .env.local porque la
 * RLS de `messages` exige sesión. Sobrescribe siempre: son 51 archivos
 * chicos y el texto puede haberse corregido en la base.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_OUT, writeIndex } from "./materiales-indice.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(process.argv[2] ?? DEFAULT_OUT);

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
if (!BASE || !KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

// ─── filas ────────────────────────────────────────────────────────────
const res = await fetch(
  `${BASE}/rest/v1/messages?select=id,date,title,excerpt,full_text,pdf_url,locality_id&source=eq.casa_universal&order=date`,
  { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }
);
if (!res.ok) {
  console.error("Error leyendo messages:", res.status, await res.text());
  process.exit(1);
}
const rows = await res.json();
console.log(`${rows.length} mensajes de la Casa Universal -> ${OUT}`);

// ─── helpers ──────────────────────────────────────────────────────────
function slug(title) {
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

/** "Mensaje del Riḍván 2024 (181 E.B.)" -> 181 */
function bahaiYear(title) {
  const m = title.match(/\((\d{2,3})\s*E\.?\s*B\.?\)/i);
  return m ? Number(m[1]) : null;
}

// ─── main ─────────────────────────────────────────────────────────────
const dir = path.join(OUT, "md", "mensajes");
mkdirSync(dir, { recursive: true });
let ok = 0;
let skipped = 0;
for (const r of rows) {
  const body = (r.full_text ?? "").replace(/\r\n?/g, "\n").trim();
  if (!body) {
    skipped++;
    console.warn(`  ! ${r.title}: sin texto completo${r.pdf_url ? " (tiene PDF: " + r.pdf_url + ")" : ""}, se salta`);
    continue;
  }
  const words = body.split(/\s+/).filter(Boolean).length;
  const file = `${r.date}-${slug(r.title)}.md`;
  const md = [
    "---",
    `title: ${yaml(r.title)}`,
    `author_or_section: ${yaml("Casa Universal de Justicia")}`,
    `kind: ${yaml("mensajes")}`,
    `date: ${yaml(r.date)}`,
    `bahai_year: ${yaml(bahaiYear(r.title))}`,
    `scope: ${yaml(r.locality_id ? "local" : "nacional")}`,
    `supabase_id: ${yaml(r.id)}`,
    `words: ${words}`,
    `exported_at: ${yaml(new Date().toISOString().slice(0, 10))}`,
    "---",
    "",
    `# ${r.title}`,
    "",
    "*Casa Universal de Justicia*",
    "",
    body,
    "",
  ].join("\n");
  writeFileSync(path.join(dir, file), md);
  ok++;
  console.log(`  + mensajes/${file} (${words} palabras)`);
}

const { target, count } = writeIndex(OUT);
console.log(`\nListo: ${ok} exportados, ${skipped} sin texto. Indice (${count} documentos) en ${target}`);
if (skipped) process.exit(1);
