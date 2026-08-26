// Convierte la planilla de Tesorería (dos CSV exportados de Google Sheets)
// en un archivo SQL para correr en el SQL Editor de Supabase.
//
//   node scripts/import-tesoreria.mjs <libro.csv> <rubros.csv> \
//        --locality "Comunidad Bahá'í de Montevideo" --year 183 \
//        > supabase/seed_tesoreria_183.sql
//
// El SQL resultante:
//   · Siembra el catálogo (cuentas, fondos, categorías, subcategorías)
//     tomándolo de la hoja RUBROS, más lo que aparezca en el libro.
//   · Crea los contribuyentes encontrados, normalizando espacios.
//   · Inserta los movimientos, atando las dos patas de cada cambio de caja.
//   · Es re-corrible: cada asiento lleva `import_ref` con índice único, así
//     que correrlo dos veces no duplica nada.
//   · Aborta con RAISE si algún nombre no matchea el catálogo, en vez de
//     insertar de menos en silencio.
//
// No toca la base: escribe SQL en stdout y el resumen en stderr.

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

// ─── Argumentos ──────────────────────────────────────────────────
const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const LEDGER_PATH = positional[0];
const RUBROS_PATH = positional[1];
const LOCALITY = flag("locality", "Comunidad Bahá'í de Montevideo");
const YEAR = Number(flag("year", "183"));

if (!LEDGER_PATH || !RUBROS_PATH) {
  console.error(
    "Uso: node scripts/import-tesoreria.mjs <libro.csv> <rubros.csv> [--locality NOMBRE] [--year 183]"
  );
  process.exit(1);
}

// ─── CSV ─────────────────────────────────────────────────────────
function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const clean = (s) => (s ?? "").replace(/\s+/g, " ").trim();

/** "1.000,00" → 1000 ; "(2.000,00)" → -2000 */
function num(s) {
  if (!s || !s.trim()) return 0;
  const negative = s.includes("(");
  const v = parseFloat(
    s.replace(/[()\s]/g, "").replace(/\./g, "").replace(",", ".")
  );
  if (Number.isNaN(v)) return 0;
  return negative ? -v : v;
}

/** "21/04/2026" → "2026-04-21" */
function isoDate(s) {
  const m = clean(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
// Con cast explícito: si una columna del VALUES arranca en NULL,
// Postgres no tiene de dónde inferirle el tipo.
const qOrNull = (s) => (s ? q(s) : "null::text");

// ─── Catálogo (hoja RUBROS) ──────────────────────────────────────
const rubros = parseCSV(readFileSync(RUBROS_PATH, "utf8"));
// Fila 1 (índice 1) son los encabezados: SUBCATEGORIAS, Fondo, CATEGORIAS,
// y en columnas sueltas CUENTAS, MONEDAS, NOMBRES (fondos).
const rubrosBody = rubros.slice(2);

const subcategories = new Map(); // nombre → { category, fund }
const categories = new Set();
const funds = new Set();
const accounts = new Set();
const currencies = new Set();

// En la planilla, las listas sueltas comparten columna una debajo de
// otra: la columna E tiene primero CUENTAS y más abajo MONEDAS. Hay que
// leerla con un estado, o las monedas terminan dadas de alta como cajas.
const HEADERS = new Set(["CUENTAS", "MONEDAS", "NOMBRES", "SUBCATEGORIAS", "CATEGORIAS"]);
let colE = null; // qué lista estamos leyendo en la columna E

for (const r of rubrosBody) {
  const sub = clean(r[0]);
  const fund = clean(r[1]);
  const cat = clean(r[2]);
  if (sub) {
    subcategories.set(sub, { category: cat, fund: fund || null });
    if (cat) categories.add(cat);
    if (fund) funds.add(fund);
  }

  const e = clean(r[4]);
  if (HEADERS.has(e.toUpperCase())) {
    colE = e.toUpperCase();
  } else if (e && colE === "CUENTAS") {
    accounts.add(e);
  } else if (e && colE === "MONEDAS") {
    currencies.add(e);
  }

  const fundName = clean(r[6]);
  if (fundName && !HEADERS.has(fundName.toUpperCase())) funds.add(fundName);
}

// ─── Libro ───────────────────────────────────────────────────────
const ledger = parseCSV(readFileSync(LEDGER_PATH, "utf8"));
const ledgerBody = ledger.slice(2);

const entries = [];
const contributors = new Map(); // clave normalizada → { name, kind }
const problems = [];

ledgerBody.forEach((r, idx) => {
  const rowNumber = idx + 3; // número de línea real en el CSV
  const date = isoDate(r[0]);
  if (!date) return; // filas de relleno de la planilla

  const account = clean(r[1]);
  const subcategory = clean(r[2]);
  const currency = clean(r[3]);
  const income = num(r[4]);
  const expense = num(r[5]);
  const receipt = clean(r[6]);
  const contributionsCount = parseInt(clean(r[7]), 10) || 0;
  const description = clean(r[8]);
  const fund = clean(r[9]);
  const category = clean(r[10]);
  const contributor = clean(r[12]);
  const receiptIssued = clean(r[13]).toUpperCase() === "TRUE";

  const amount = income - expense;
  if (amount === 0) {
    problems.push(`fila ${rowNumber}: monto 0, se omite`);
    return;
  }
  if (!["UYU", "USD"].includes(currency)) {
    problems.push(`fila ${rowNumber}: moneda desconocida "${currency}"`);
    return;
  }

  // El catálogo tiene que contener todo lo que usa el libro.
  if (!accounts.has(account)) {
    accounts.add(account);
    problems.push(`fila ${rowNumber}: cuenta "${account}" no estaba en RUBROS, se agrega`);
  }
  if (!subcategories.has(subcategory)) {
    subcategories.set(subcategory, { category, fund: fund || null });
    problems.push(`fila ${rowNumber}: subcategoría "${subcategory}" no estaba en RUBROS, se agrega`);
  }
  if (category) categories.add(category);
  if (fund) funds.add(fund);

  if (contributor) {
    const key = contributor.toLowerCase();
    if (!contributors.has(key)) {
      let kind = "persona";
      if (/^familia\b/i.test(contributor)) kind = "familia";
      else if (/fiesta|colecta|canasta/i.test(contributor)) kind = "colecta";
      contributors.set(key, { name: contributor, kind });
    }
  }

  entries.push({
    rowNumber,
    date,
    account,
    subcategory,
    category: category || subcategories.get(subcategory)?.category || "",
    fund: fund || null,
    currency,
    amount,
    description,
    receipt: receipt ? parseInt(receipt, 10) : null,
    contributionsCount,
    contributor: contributor || null,
    receiptIssued,
    isOpening: /saldo anterior/i.test(subcategory),
    transferGroup: null,
  });
});

// ─── Transferencias: atar las dos patas ──────────────────────────
// Un cambio de caja (o una compra de divisas) son dos asientos de la
// misma fecha y subcategoría que se cancelan: una salida y una entrada.
const TRANSFER_SUBCATS = /cambio de caja|compra de divisas/i;
const pending = new Map(); // fecha|subcat → índice del asiento negativo
entries.forEach((e, i) => {
  if (!TRANSFER_SUBCATS.test(e.subcategory)) return;
  const key = `${e.date}|${e.subcategory.toLowerCase()}`;
  const waiting = pending.get(key);
  if (waiting !== undefined && Math.sign(entries[waiting].amount) !== Math.sign(e.amount)) {
    const group = randomUUID();
    entries[waiting].transferGroup = group;
    e.transferGroup = group;
    pending.delete(key);
  } else {
    pending.set(key, i);
  }
});
for (const [key] of pending) {
  problems.push(`transferencia sin contraparte: ${key}`);
}

// ─── Diagnóstico (stderr) ────────────────────────────────────────
const balances = {};
const byFund = {};
for (const e of entries) {
  const a = `${e.account} · ${e.currency}`;
  balances[a] = (balances[a] || 0) + e.amount;
  const f = `${e.fund || "(sin fondo)"} · ${e.currency}`;
  byFund[f] = (byFund[f] || 0) + e.amount;
}
const money = (n) =>
  n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

console.error(`Localidad: ${LOCALITY}  ·  año bahá'í: ${YEAR}`);
console.error(`Asientos: ${entries.length}`);
console.error(`Catálogo: ${accounts.size} cuentas, ${funds.size} fondos, ${categories.size} categorías, ${subcategories.size} subcategorías`);
console.error(`Monedas declaradas: ${[...currencies].join(", ") || "(ninguna)"}`);
console.error(`Contribuyentes: ${contributors.size}`);
console.error(`Transferencias atadas: ${entries.filter((e) => e.transferGroup).length / 2}`);
console.error("\nSaldo por cuenta y moneda:");
for (const [k, v] of Object.entries(balances).sort()) {
  console.error(`  ${k.padEnd(32)} ${money(v).padStart(14)}`);
}
console.error("\nSaldo por fondo y moneda:");
for (const [k, v] of Object.entries(byFund).sort()) {
  console.error(`  ${k.padEnd(32)} ${money(v).padStart(14)}`);
}
if (problems.length) {
  console.error("\nAvisos:");
  for (const p of problems) console.error(`  · ${p}`);
}

// ─── SQL ─────────────────────────────────────────────────────────
const out = [];
out.push(`-- ═════════════════════════════════════════════════════════════════`);
out.push(`-- Importación de la planilla de Tesorería — año bahá'í ${YEAR}.`);
out.push(`--`);
out.push(`-- Generado por scripts/import-tesoreria.mjs. NO editar a mano:`);
out.push(`-- si hay que corregir algo, se corrige el CSV y se regenera.`);
out.push(`--`);
out.push(`-- Requiere la migración 040_treasury_ledger.sql aplicada.`);
out.push(`-- Es re-corrible: los asientos llevan import_ref único.`);
out.push(`--`);
out.push(`-- Saldos esperados al terminar:`);
for (const [k, v] of Object.entries(balances).sort()) {
  out.push(`--   ${k.padEnd(32)} ${money(v).padStart(14)}`);
}
out.push(`-- ═════════════════════════════════════════════════════════════════`);
out.push(``);
out.push(`do $import$`);
out.push(`declare`);
out.push(`  v_loc uuid;`);
out.push(`  v_expected int := ${entries.length};`);
out.push(`  v_inserted int;`);
out.push(`begin`);
out.push(`  select id into v_loc from public.localities where name = ${q(LOCALITY)};`);
out.push(`  if v_loc is null then`);
out.push(`    raise exception 'No existe la localidad %. Corregí el nombre en este archivo.', ${q(LOCALITY)};`);
out.push(`  end if;`);
out.push(``);

// Catálogo
out.push(`  -- ─── Cuentas ───────────────────────────────────────────────`);
out.push(`  insert into public.treasury_accounts (locality_id, name, sort_order) values`);
out.push(
  [...accounts]
    .map((a, i) => `    (v_loc, ${q(a)}, ${i + 1})`)
    .join(",\n") + `\n  on conflict (locality_id, name) do nothing;`
);
out.push(``);
out.push(`  -- ─── Fondos ────────────────────────────────────────────────`);
out.push(`  insert into public.treasury_funds (locality_id, name, sort_order) values`);
out.push(
  [...funds]
    .map((f, i) => `    (v_loc, ${q(f)}, ${i + 1})`)
    .join(",\n") + `\n  on conflict (locality_id, name) do nothing;`
);
out.push(``);
out.push(`  -- ─── Categorías ────────────────────────────────────────────`);
out.push(`  insert into public.treasury_categories (locality_id, name, sort_order) values`);
out.push(
  [...categories]
    .map((c, i) => `    (v_loc, ${q(c)}, ${i + 1})`)
    .join(",\n") + `\n  on conflict (locality_id, name) do nothing;`
);
out.push(``);
out.push(`  -- ─── Subcategorías (arrastran categoría y fondo) ───────────`);
out.push(`  insert into public.treasury_subcategories (locality_id, name, category_id, default_fund_id, sort_order)`);
out.push(`  select v_loc, v.name, c.id, f.id, v.ord`);
out.push(`  from (values`);
out.push(
  [...subcategories.entries()]
    .map(([name, meta], i) => `    (${q(name)}, ${q(meta.category)}, ${qOrNull(meta.fund)}, ${i + 1})`)
    .join(",\n")
);
out.push(`  ) as v(name, category, fund, ord)`);
out.push(`  join public.treasury_categories c on c.locality_id = v_loc and c.name = v.category`);
out.push(`  left join public.treasury_funds f on f.locality_id = v_loc and f.name = v.fund`);
out.push(`  on conflict (locality_id, name) do nothing;`);
out.push(``);

// Contribuyentes
if (contributors.size > 0) {
  out.push(`  -- ─── Contribuyentes ────────────────────────────────────────`);
  out.push(`  insert into public.treasury_contributors (locality_id, name, kind) values`);
  out.push(
    [...contributors.values()]
      .map((c) => `    (v_loc, ${q(c.name)}, ${q(c.kind)})`)
      .join(",\n") + `\n  on conflict do nothing;`
  );
  out.push(``);
}

// Asientos
out.push(`  -- ─── Movimientos ───────────────────────────────────────────`);
out.push(`  insert into public.treasury_entries (`);
out.push(`    locality_id, entry_date, bahai_year, account_id, subcategory_id,`);
out.push(`    category_id, fund_id, currency, amount, description, receipt_number,`);
out.push(`    contributions_count, contributor_id, receipt_issued, is_opening_balance,`);
out.push(`    transfer_group_id, import_ref`);
out.push(`  )`);
out.push(`  select`);
out.push(`    v_loc, v.entry_date, ${YEAR}, a.id, s.id, c.id, f.id, v.currency,`);
out.push(`    v.amount, nullif(v.description, ''), v.receipt_number,`);
out.push(`    v.contributions_count, ct.id, v.receipt_issued, v.is_opening,`);
out.push(`    v.transfer_group, v.import_ref`);
out.push(`  from (values`);
out.push(
  entries
    .map((e) => {
      const cells = [
        `${q(e.date)}::date`,
        q(e.account),
        q(e.subcategory),
        q(e.category),
        qOrNull(e.fund),
        q(e.currency),
        e.amount.toFixed(2),
        q(e.description),
        e.receipt === null || Number.isNaN(e.receipt) ? "null::int" : String(e.receipt),
        String(e.contributionsCount),
        qOrNull(e.contributor),
        e.receiptIssued ? "true" : "false",
        e.isOpening ? "true" : "false",
        e.transferGroup ? `${q(e.transferGroup)}::uuid` : "null::uuid",
        q(`${YEAR}:${e.rowNumber}`),
      ];
      return `    (${cells.join(", ")})`;
    })
    .join(",\n")
);
out.push(`  ) as v(`);
out.push(`    entry_date, account, subcategory, category, fund, currency, amount,`);
out.push(`    description, receipt_number, contributions_count, contributor,`);
out.push(`    receipt_issued, is_opening, transfer_group, import_ref`);
out.push(`  )`);
out.push(`  join public.treasury_accounts a on a.locality_id = v_loc and a.name = v.account`);
out.push(`  join public.treasury_subcategories s on s.locality_id = v_loc and s.name = v.subcategory`);
out.push(`  join public.treasury_categories c on c.locality_id = v_loc and c.name = v.category`);
out.push(`  left join public.treasury_funds f on f.locality_id = v_loc and f.name = v.fund`);
out.push(`  left join public.treasury_contributors ct`);
out.push(`    on ct.locality_id = v_loc and lower(btrim(ct.name)) = lower(btrim(v.contributor))`);
out.push(`  on conflict do nothing;`);
out.push(``);
out.push(`  get diagnostics v_inserted = row_count;`);
out.push(`  raise notice 'Asientos insertados: % de % esperados.', v_inserted, v_expected;`);
out.push(`  -- Si faltan filas y no es una re-corrida, algún nombre no matcheó`);
out.push(`  -- el catálogo y el JOIN la descartó en silencio.`);
out.push(`  if v_inserted > 0 and v_inserted < v_expected then`);
out.push(`    raise exception 'Se insertaron % de % asientos: hay nombres que no matchean el catálogo.', v_inserted, v_expected;`);
out.push(`  end if;`);
out.push(`end`);
out.push(`$import$;`);
out.push(``);

process.stdout.write(out.join("\n"));
