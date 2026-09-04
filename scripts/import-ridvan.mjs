// Genera supabase/seed_mensajes_ridvan.sql a partir de una carpeta con
// los mensajes de Riḍván de la Casa Universal de Justicia en .txt.
//
//   node scripts/import-ridvan.mjs "C:\ruta\a\RidvanMessages"
//   node scripts/import-ridvan.mjs "C:\ruta\a\RidvanMessages" --apply
//
// Con --apply, además de generar el SQL, aplica el upsert directamente
// contra Supabase vía PostgREST con la SERVICE_ROLE_KEY de .env.local.
// Existe porque el SQL Editor de Supabase rechaza consultas de este
// tamaño ("Query is too large"): el seed trae ~600 KB de texto.
//
// Formato esperado de cada archivo:
//   <AAAA>-<NNN>BE[ <destinatario>].txt
//   Encabezado en inglés (The Universal House of Justice / Ridván ... /
//   To the Bahá'ís of the World / Dearly loved Friends,) y el cuerpo en
//   español. El encabezado se descarta; el cuerpo se guarda VERBATIM
//   (los textos son de la Casa de Justicia: no se corrigen).
//
// La carpeta de origen trae duplicados (el mismo mensaje con y sin
// sufijo en el nombre): se deduplica por hash del cuerpo. El SQL
// resultante es idempotente y NO pisa lo que el Admin Nacional haya
// cargado a mano: por cada mensaje hace UPDATE por título (rellena
// texto/fecha sin tocar pdf_url ni is_new) e INSERT solo si no existe.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC_DIR = process.argv[2];
if (!SRC_DIR) {
  console.error("Uso: node scripts/import-ridvan.mjs <carpeta con los .txt>");
  process.exit(1);
}

const OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "supabase",
  "seed_mensajes_ridvan.sql"
);

// Destinatario según el sufijo del nombre de archivo (normalizado sin
// acentos y en minúsculas). null = "A los bahá'ís del mundo" (el título
// no lo repite: es el caso normal).
const ADDRESSEES = new Map([
  ["", null],
  ["al mundo", null],
  ["a espana", "A los bahá'ís de España"],
  ["spanish", "A los bahá'ís de España"],
  ["a la convencion internacional", "A la Convención Internacional"],
  ["a la convención internacional", "A la Convención Internacional"],
  ["europa", "A los bahá'ís de Europa"],
]);

// El archivo 1984 SIN sufijo es en realidad el mensaje a España (su
// cuerpo habla de "los devotos creyentes de España"); el del mundo es
// "1984-141BE Al Mundo.txt". Se corrige acá y el dedupe hace el resto.
const NO_SUFFIX_OVERRIDES = new Map([[1984, "A los bahá'ís de España"]]);

function normalize(s) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseBody(raw) {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = text.split("\n");

  // El cuerpo empieza después de la línea "Dearly loved Friends," (o del
  // encabezado que hubiera). Fallback: primera línea "larga" en español.
  let start = lines.findIndex((l) => /^dearly loved/i.test(l.trim()));
  if (start === -1) {
    start = lines.findIndex((l) => l.trim().length > 120);
    if (start === -1) start = 0;
    else start -= 1;
  }
  let body = lines.slice(start + 1);

  // Firma final ("The Universal House of Justice") y blancos de cola.
  while (body.length > 0) {
    const last = body[body.length - 1].trim();
    if (last === "" || /^the universal house of justice$/i.test(last)) {
      body.pop();
    } else break;
  }

  return body
    .join("\n")
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

function makeExcerpt(bodyText) {
  const first = bodyText.split("\n\n")[0] ?? "";
  if (first.length <= 180) return first;
  const cut = first.slice(0, 180);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

const messages = new Map(); // hash → mensaje (dedupe por cuerpo)
const files = readdirSync(SRC_DIR)
  .filter((f) => f.toLowerCase().endsWith(".txt"))
  .sort();

for (const file of files) {
  const m = file.match(/^(\d{4})-(\d+)\s*BE(?:\s+(.+?))?\.txt$/i);
  if (!m) {
    console.warn(`⚠ Nombre no reconocido, se saltea: ${file}`);
    continue;
  }
  const year = parseInt(m[1], 10);
  const be = parseInt(m[2], 10);
  const suffix = normalize(m[3] ?? "");

  let addressee;
  if (suffix === "" && NO_SUFFIX_OVERRIDES.has(year)) {
    addressee = NO_SUFFIX_OVERRIDES.get(year);
  } else if (ADDRESSEES.has(suffix)) {
    addressee = ADDRESSEES.get(suffix);
  } else {
    addressee = m[3].trim();
    console.warn(`⚠ Destinatario no mapeado en ${file}: se usa "${addressee}"`);
  }

  let raw = readFileSync(path.join(SRC_DIR, file));
  let content = raw.toString("utf8");
  if (content.includes("\uFFFD")) {
    content = raw.toString("latin1");
    console.warn(`⚠ ${file}: no era UTF-8 válido, decodificado como latin1`);
  }

  const body = parseBody(content);
  if (body.length < 200) {
    console.warn(`⚠ Cuerpo sospechosamente corto en ${file} (${body.length} chars)`);
  }

  const hash = createHash("sha1").update(body).digest("hex");
  const title =
    `Mensaje del Riḍván ${year} (${be} E.B.)` +
    (addressee ? ` — ${addressee}` : "");

  const existing = messages.get(hash);
  if (existing) {
    if (existing.title !== title) {
      console.warn(
        `⚠ Mismo cuerpo con títulos distintos: "${existing.title}" vs "${title}" (${file}) — se conserva el primero`
      );
    }
    continue;
  }
  messages.set(hash, { year, be, title, body, file });
}

const rows = [...messages.values()].sort(
  (a, b) => a.year - b.year || a.title.localeCompare(b.title)
);

// Dollar-quoting para no escapar nada; verificamos que el tag no aparezca.
const TAG = "$ridvan$";
for (const r of rows) {
  if (r.body.includes(TAG) || r.title.includes(TAG)) {
    console.error(`El texto de ${r.file} contiene ${TAG}; cambiar el tag.`);
    process.exit(1);
  }
}
const q = (s) => `${TAG}${s}${TAG}`;

const stmts = rows.map((r) => {
  const date = `${r.year}-04-21`; // primer día de Riḍván
  const excerpt = makeExcerpt(r.body);
  return `-- ${r.title}
update public.messages
   set date = '${date}', excerpt = ${q(excerpt)}, full_text = ${q(r.body)}
 where source = 'casa_universal' and title = ${q(r.title)};
insert into public.messages (date, title, excerpt, full_text, is_new, source, locality_id)
select '${date}', ${q(r.title)}, ${q(excerpt)}, ${q(r.body)}, false, 'casa_universal', null
 where not exists (
   select 1 from public.messages
    where source = 'casa_universal' and title = ${q(r.title)}
 );`;
});

const sql = `-- ═════════════════════════════════════════════════════════════════
-- Mensajes de Riḍván de la Casa Universal de Justicia (texto completo).
-- Generado por scripts/import-ridvan.mjs — NO editar a mano.
--
-- Idempotente: UPDATE por título (no toca pdf_url ni is_new de filas
-- existentes) + INSERT solo si el título no existe. Contenido NACIONAL
-- (locality_id NULL), visible a todas las localidades.
--
-- Correr una vez en el SQL Editor de Supabase.
-- ═════════════════════════════════════════════════════════════════

begin;

${stmts.join("\n\n")}

commit;
`;

writeFileSync(OUT, sql, "utf8");
console.log(
  `✔ ${rows.length} mensajes únicos de ${files.length} archivos → ${OUT}`
);
for (const r of rows) console.log(`  · ${r.title}`);

// ─── --apply: upsert directo vía PostgREST ─────────────────────────
if (process.argv.includes("--apply")) {
  const envPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    ".env.local"
  );
  const env = Object.fromEntries(
    readFileSync(envPath, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i), l.slice(i + 1)];
      })
  );
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");
    process.exit(1);
  }
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  let updated = 0;
  let inserted = 0;
  for (const r of rows) {
    const date = `${r.year}-04-21`;
    const excerpt = makeExcerpt(r.body);
    const filter = `source=eq.casa_universal&title=eq.${encodeURIComponent(r.title)}`;

    // UPDATE por título (no toca pdf_url/is_new); si no matcheó, INSERT.
    const upd = await fetch(`${url}/rest/v1/messages?${filter}`, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({ date, excerpt, full_text: r.body }),
    });
    if (!upd.ok) {
      console.error(`✖ UPDATE falló en "${r.title}": ${upd.status} ${await upd.text()}`);
      process.exit(1);
    }
    const touched = await upd.json();
    if (touched.length > 0) {
      updated++;
      continue;
    }

    const ins = await fetch(`${url}/rest/v1/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        date,
        title: r.title,
        excerpt,
        full_text: r.body,
        is_new: false,
        source: "casa_universal",
        locality_id: null,
      }),
    });
    if (!ins.ok) {
      console.error(`✖ INSERT falló en "${r.title}": ${ins.status} ${await ins.text()}`);
      process.exit(1);
    }
    inserted++;
  }
  console.log(`✔ Aplicado en Supabase: ${inserted} insertados, ${updated} actualizados.`);
}
