#!/usr/bin/env node
/**
 * Arma el INDICE.md de la carpeta de exportación (por defecto
 * ../ComunidadBahai-materiales) leyendo el frontmatter de TODOS los .md
 * que haya en <carpeta>/md/<kind>/. Lo llaman al final
 * export-materiales-md.mjs y export-mensajes-md.mjs, así el índice es
 * uno solo sin importar qué script corrió último; también se puede
 * correr suelto:
 *
 *   node scripts/materiales-indice.mjs [carpeta-destino]
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_OUT = path.join(here, "..", "..", "ComunidadBahai-materiales");

const KIND_LABEL = {
  mensajes: "Mensajes de la Casa Universal de Justicia",
  ruhi: "Instituto Ruhí",
  libros: "Libros (traducciones autorizadas del Panel)",
};
const KIND_ORDER = ["mensajes", "ruhi", "libros"];

/** Frontmatter mínimo: líneas `clave: valor` entre dos `---`. */
function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return {};
  const out = {};
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
        /* se deja tal cual */
      }
    }
    out[k] = v;
  }
  return out;
}

export function writeIndex(out) {
  const mdRoot = path.join(out, "md");
  const entries = [];
  for (const kind of readdirSync(mdRoot)) {
    const dir = path.join(mdRoot, kind);
    if (!statSync(dir).isDirectory()) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".md")) continue;
      const fm = frontmatter(readFileSync(path.join(dir, file), "utf8"));
      entries.push({ kind, file, rel: `md/${kind}/${file}`, fm });
    }
  }

  const kinds = [...new Set(entries.map((e) => e.kind))].sort(
    (a, b) => (KIND_ORDER.indexOf(a) + 99) % 99 - (KIND_ORDER.indexOf(b) + 99) % 99 || a.localeCompare(b)
  );
  const lines = [
    "# Materiales exportados",
    "",
    `${entries.length} documentos en texto plano, exportados desde la base de la app ` +
      `(Supabase) por los scripts \`export-*-md.mjs\` del repo ComunidadBahai. ` +
      `Índice regenerado el ${new Date().toISOString().slice(0, 10)}.`,
    "",
  ];
  for (const kind of kinds) {
    const items = entries.filter((e) => e.kind === kind);
    items.sort((a, b) => {
      if (kind === "mensajes") return String(a.fm.date ?? "").localeCompare(String(b.fm.date ?? ""));
      if (a.fm.number != null && b.fm.number != null) return a.fm.number - b.fm.number;
      return String(a.fm.title ?? a.file).localeCompare(String(b.fm.title ?? b.file), "es");
    });
    const words = items.reduce((s, e) => s + (Number(e.fm.words) || 0), 0);
    lines.push(`## ${KIND_LABEL[kind] ?? kind} (${items.length} · ${words.toLocaleString("es-UY")} palabras)`, "");
    for (const it of items) {
      const pre =
        kind === "mensajes" && it.fm.date
          ? `${it.fm.date} · `
          : it.fm.number != null
            ? `Libro ${it.fm.number} · `
            : "";
      const sub = it.fm.author_or_section ? ` — ${it.fm.author_or_section}` : "";
      lines.push(`- [${pre}${it.fm.title ?? it.file}](${it.rel})${sub}`);
    }
    lines.push("");
  }
  const target = path.join(out, "INDICE.md");
  writeFileSync(target, lines.join("\n"));
  return { target, count: entries.length };
}

// Ejecutado directo (no importado): regenerar y listo.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = path.resolve(process.argv[2] ?? DEFAULT_OUT);
  const { target, count } = writeIndex(out);
  console.log(`${count} documentos indexados en ${target}`);
}
