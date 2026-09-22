import {
  cellDate,
  normalizeHeader,
  type Cell,
  type CellMatrix,
} from "./bank-statements";

/**
 * Importar un ejercicio entero al libro, desde la planilla con que se
 * llevaba antes (062).
 *
 * Módulo PURO, sin queries ni red, por la misma razón que
 * `treasury-cashbook.ts` y `treasury-reconcile.ts`: la vista previa y la
 * confirmación TIENEN que decir exactamente lo mismo. Si la previa
 * calculara una cosa y el insert otra, la persona estaría aprobando algo
 * distinto de lo que entra, que es el único error de esta pantalla que no
 * se puede detectar después.
 *
 * Dos partes:
 *
 *  · `parseLedgerSheet()` — de la matriz de celdas a filas tipadas. Ubica
 *    las columnas POR NOMBRE DE ENCABEZADO, nunca por posición, igual que
 *    los extractos: cinco planillas de cinco años distintos, hechas a
 *    mano, no tienen por qué coincidir en el orden de las columnas, y una
 *    planilla mal leída es peor que ninguna. Si no reconoce el molde
 *    falla con un mensaje que dice qué buscó.
 *
 *  · `planImport()` — de las filas al PLAN: qué catálogo ya existe y cuál
 *    habría que crear, qué contribuyentes, cómo quedan atadas las
 *    transferencias, qué saldos deja el archivo, y la comparación entre
 *    el "Saldo anterior" que declara la planilla y el cierre calculado
 *    del ejercicio anterior.
 *
 * ⚠️ La regla que sostiene todo lo demás: **la apertura la trae un solo
 * ejercicio, el más viejo.** El Libro de Caja acumula todo lo anterior al
 * mes (`buildCashbook`), así que si cada año importado trajera su propio
 * "Saldo anterior" el saldo se contaría dos veces — los movimientos del
 * año anterior YA SON esa apertura. Del segundo ejercicio en adelante la
 * apertura declarada no se importa: se compara. Y esa comparación es lo
 * mejor que tiene este importador, porque es la única verificación
 * externa de que el año anterior entró completo.
 *
 * Ningún aviso bloquea. Se listan, se confirman igual y quedan guardados
 * con el lote: dentro de un año nadie se acuerda de qué se dejó pasar.
 */

// ═══ Contrato ═══════════════════════════════════════════════════════

export type Currency = "UYU" | "USD";

export type ImportWarning = {
  /** `alto` es lo que conviene mirar antes de confirmar; ninguno bloquea. */
  level: "alto" | "aviso";
  /** Fila del archivo, para poder ir a buscarla. */
  row?: number;
  text: string;
};

export type SheetRow = {
  /** Fila real del archivo, 1-based: es lo que la persona ve en Excel. */
  row: number;
  date: string;
  account: string;
  subcategory: string;
  category: string;
  fund: string | null;
  currency: Currency;
  /** Con signo: positivo ingreso, negativo gasto. Nunca 0. */
  amount: number;
  description: string;
  receiptNumber: number | null;
  contributionsCount: number;
  contributor: string | null;
  receiptIssued: boolean;
  isOpening: boolean;
  /** Lo asigna `planImport()` al atar las dos patas. */
  transferGroup: string | null;
};

export type ParsedSheet = {
  rows: SheetRow[];
  warnings: ImportWarning[];
  /** Fila del encabezado, 0-based, para poder decirlo en la pantalla. */
  headerRow: number;
  /** Qué encabezado se usó para cada campo. La pantalla lo muestra: es la
   *  forma de que la persona vea que el archivo se leyó como esperaba. */
  columns: Array<{ field: string; header: string }>;
};

export type ParseFailure = { error: string };

export function isParseFailure(v: ParsedSheet | ParseFailure): v is ParseFailure {
  return "error" in v;
}

// ═══ Encabezados ════════════════════════════════════════════════════

/**
 * Sinónimos por campo. Se comparan normalizados (sin acentos, en
 * minúscula). El orden importa: gana el primero que aparezca en la fila.
 * Agregar un molde nuevo es agregar sinónimos acá, no otro parser.
 */
const SYNONYMS: Record<string, string[]> = {
  date: ["fecha", "fecha del movimiento", "dia"],
  account: ["cuenta", "caja", "cuenta / caja"],
  subcategory: ["subcategoria", "sub categoria", "subrubro", "rubro", "concepto"],
  category: ["categoria"],
  fund: ["fondo", "destino"],
  currency: ["moneda"],
  income: ["ingreso", "ingresos", "entrada", "entradas", "haber", "credito", "debe"],
  expense: ["gasto", "gastos", "egreso", "egresos", "salida", "salidas", "debito"],
  amount: ["importe", "monto"],
  receipt: [
    "recibo",
    "n recibo",
    "nro recibo",
    "n° recibo",
    "numero de recibo",
    "numero recibo",
    "recibo n",
    "recibo n°",
  ],
  count: ["cantidad", "cantidad de aportes", "aportes", "n aportes"],
  description: ["descripcion", "detalle", "observaciones", "observacion", "glosa"],
  contributor: ["contribuyente", "aportante", "donante", "nombre"],
  receiptIssued: ["recibo emitido", "emitido", "impreso", "recibo impreso"],
};

/** Campos sin los cuales no hay libro que importar. */
const REQUIRED = ["date", "account", "subcategory"] as const;

type ColumnMap = Map<string, number>;

function mapColumns(header: Cell[]): ColumnMap {
  const normalized = header.map(normalizeHeader);
  const map: ColumnMap = new Map();
  for (const [field, names] of Object.entries(SYNONYMS)) {
    for (const name of names) {
      const i = normalized.indexOf(name);
      if (i >= 0 && !map.has(field)) {
        map.set(field, i);
        break;
      }
    }
  }
  return map;
}

/** Cuán bien esta fila sirve de encabezado: cuántos campos reconoce. */
function headerScore(map: ColumnMap): number {
  if (!REQUIRED.every((f) => map.has(f))) return 0;
  if (!map.has("income") && !map.has("expense") && !map.has("amount")) return 0;
  return map.size;
}

// ═══ Parser ═════════════════════════════════════════════════════════

const text = (c: Cell): string => String(c ?? "").replace(/\s+/g, " ").trim();

/**
 * El importe de una celda de la planilla.
 *
 * ⚠️ NO es `cellNumber()` de los extractos, y la diferencia es plata. Un
 * extracto lo exporta una plataforma y puede venir en formato inglés
 * ("1,600.00", BROU); una planilla la escribió una persona en es-UY, donde
 * el punto separa miles. `cellNumber("3.500")` devuelve 3,5 —un gasto de
 * tres mil quinientos pesos entraría como tres pesos con cincuenta— y eso
 * no lo delata ningún total, porque el total también saldría mal.
 *
 * Con punto Y coma, o con coma sola, manda la misma regla que allá (el
 * último separador es el decimal). Con punto solo, decide cuántos dígitos
 * quedan a la derecha del ÚLTIMO punto: tres es separador de miles
 * ("3.500" → 3500), uno o dos es decimal ("3.50" → 3.5). Queda ambiguo
 * "1.234" leído como 1234, que en una columna de dinero uruguaya es lo
 * que corresponde.
 */
export function sheetNumber(c: Cell): number | null {
  if (c == null || c === "") return null;
  if (typeof c === "number") return Number.isFinite(c) ? Math.round(c * 100) / 100 : null;
  if (typeof c === "boolean") return null;

  let s = String(c).trim().replace(/\s/g, "").replace(/^\$U?/i, "").replace(/^U\$S?/i, "");
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[()\-+]/g, "");
  if (!/[\d]/.test(s)) return null;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    s = /,\d{1,2}$/.test(s) ? s.replace(",", ".") : s.replace(/,/g, "");
  } else if (lastDot >= 0) {
    s = /\.\d{3}$/.test(s) ? s.replace(/\./g, "") : s;
  }

  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return Math.round((negative ? -n : n) * 100) / 100;
}

/** Las filas que la planilla usa para arrastrar el saldo del año anterior. */
const OPENING_RE = /saldo (anterior|inicial)|apertura/i;

/** Las dos patas de una misma operación viajan con estos rubros. */
const TRANSFER_RE = /cambio de caja|compra de divisas|transferencia entre|traspaso/i;

const CURRENCIES: Record<string, Currency> = {
  uyu: "UYU",
  "$": "UYU",
  "$u": "UYU",
  pesos: "UYU",
  peso: "UYU",
  "peso uruguayo": "UYU",
  usd: "USD",
  "u$s": "USD",
  "us$": "USD",
  dolares: "USD",
  dolar: "USD",
};

function readCurrency(c: Cell): Currency | null {
  const k = normalizeHeader(c);
  return CURRENCIES[k] ?? null;
}

function readBoolean(c: Cell): boolean {
  if (typeof c === "boolean") return c;
  const s = normalizeHeader(c);
  return s === "true" || s === "si" || s === "sí" || s === "x" || s === "1" || s === "ok";
}

/**
 * Lee la planilla. Busca el encabezado en las primeras 40 filas y se
 * queda con la fila que reconoce MÁS campos: una planilla suele tener un
 * título arriba y a veces una fila de ejemplo, y quedarse con la primera
 * que "parece" encabezado lee media tabla corrida.
 */
export function parseLedgerSheet(rows: CellMatrix): ParsedSheet | ParseFailure {
  const limit = Math.min(rows.length, 40);
  let best: { index: number; map: ColumnMap; score: number } | null = null;
  for (let i = 0; i < limit; i++) {
    const map = mapColumns(rows[i] ?? []);
    const score = headerScore(map);
    if (score > 0 && (!best || score > best.score)) best = { index: i, map, score };
  }

  if (!best) {
    return {
      error:
        "No reconozco el formato de la planilla. La primera fila con encabezados tiene que traer al menos Fecha, Cuenta y Subcategoría (o Rubro), más una columna de Ingreso/Gasto o de Importe.",
    };
  }

  const { index: headerRow, map } = best;
  const at = (r: Cell[], field: string): Cell => {
    const i = map.get(field);
    return i === undefined ? null : r[i];
  };

  const out: SheetRow[] = [];
  const warnings: ImportWarning[] = [];

  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const rowNumber = i + 1; // 1-based, como lo numera Excel
    const date = cellDate(at(r, "date"));
    if (!date) {
      // Las filas sin fecha son el relleno de la planilla (totales,
      // separadores, notas al pie). Solo se avisa si traían plata.
      const hadMoney =
        sheetNumber(at(r, "income")) || sheetNumber(at(r, "expense")) || sheetNumber(at(r, "amount"));
      // Una fila de totales tiene plata y no es un movimiento: avisarla
      // sería ruido en todas las planillas.
      const isTotals = r.some((c) => /^totales?\b/.test(normalizeHeader(c)));
      if (hadMoney && !isTotals) {
        warnings.push({
          level: "alto",
          row: rowNumber,
          text: "La fila tiene importe pero no una fecha que se entienda; no se importa.",
        });
      }
      continue;
    }

    const income = sheetNumber(at(r, "income")) ?? 0;
    const expense = sheetNumber(at(r, "expense")) ?? 0;
    const single = sheetNumber(at(r, "amount"));
    // Un gasto puede venir como positivo en su propia columna o como
    // negativo en una columna única; las dos formas dan lo mismo acá.
    const amount =
      single != null && !map.has("income") && !map.has("expense")
        ? single
        : Math.round((income - Math.abs(expense)) * 100) / 100;

    if (!amount) {
      warnings.push({
        level: "aviso",
        row: rowNumber,
        text: "La fila no tiene importe (o es cero); no se importa.",
      });
      continue;
    }

    const account = text(at(r, "account"));
    const subcategory = text(at(r, "subcategory"));
    if (!account || !subcategory) {
      warnings.push({
        level: "alto",
        row: rowNumber,
        text: `Falta ${!account ? "la cuenta" : "el rubro"}; no se importa.`,
      });
      continue;
    }

    const currency = readCurrency(at(r, "currency")) ?? "UYU";
    if (map.has("currency") && !readCurrency(at(r, "currency"))) {
      warnings.push({
        level: "alto",
        row: rowNumber,
        text: `No entiendo la moneda "${text(at(r, "currency"))}"; se importa como pesos.`,
      });
    }

    const receiptRaw = sheetNumber(at(r, "receipt"));
    const contributor = text(at(r, "contributor"));

    out.push({
      row: rowNumber,
      date,
      account,
      subcategory,
      category: text(at(r, "category")),
      fund: text(at(r, "fund")) || null,
      currency,
      amount,
      description: text(at(r, "description")),
      receiptNumber:
        receiptRaw != null && Number.isInteger(receiptRaw) && receiptRaw > 0 ? receiptRaw : null,
      contributionsCount: Math.max(0, Math.trunc(sheetNumber(at(r, "count")) ?? 0)),
      contributor: contributor || null,
      // Un aporte de un ejercicio cerrado hace años tiene el recibo
      // entregado, diga lo que diga la columna. Solo se cree al archivo
      // cuando la columna existe.
      receiptIssued: map.has("receiptIssued")
        ? readBoolean(at(r, "receiptIssued"))
        : receiptRaw != null,
      isOpening: OPENING_RE.test(subcategory) || OPENING_RE.test(text(at(r, "description"))),
      transferGroup: null,
    });
  }

  if (out.length === 0) {
    return {
      error:
        "Encontré los encabezados pero ninguna fila con fecha e importe. ¿Es la hoja correcta del archivo?",
    };
  }

  return {
    rows: out,
    warnings,
    headerRow,
    columns: [...map.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([field, i]) => ({ field, header: text((rows[headerRow] ?? [])[i]) })),
  };
}

// ═══ Plan ═══════════════════════════════════════════════════════════

export type Balance = { account: string; currency: Currency; amount: number };

export type OpeningCheck = {
  account: string;
  currency: Currency;
  /** Lo que declara la planilla como saldo anterior. */
  declared: number;
  /** El cierre calculado del libro al día anterior al ejercicio. */
  computed: number;
  diff: number;
};

export type NewSubcategory = { name: string; category: string; fund: string | null };

export type OpeningsMode = "importadas" | "verificadas" | "sin_apertura";

export type LedgerContext = {
  bahaiYear: number;
  /** Inicio y fin del ejercicio, para avisar de las fechas que caen afuera. */
  yearStart: string | null;
  yearEnd: string | null;
  accounts: string[];
  funds: string[];
  categories: string[];
  subcategories: string[];
  contributors: string[];
  /** Números de recibo ya usados en el libro de esta comunidad. */
  usedReceipts: number[];
  /** Cierre del libro al día anterior al inicio del ejercicio, por cuenta
   *  y moneda. Vacío = el libro arranca con esta importación. */
  priorBalances: Balance[];
};

export type ImportPlan = {
  bahaiYear: number;
  /** Qué encabezado de la planilla se usó para cada campo. La pantalla lo
   *  muestra: es la forma más barata de que la persona vea que el archivo
   *  se leyó como esperaba, antes de mirar un solo número. */
  columns: ParsedSheet["columns"];
  /** Lo que se va a insertar, ya con las transferencias atadas. */
  entries: SheetRow[];
  openingsMode: OpeningsMode;
  /** Las filas de apertura que quedaron AFUERA (modo `verificadas`). */
  openingsSkipped: SheetRow[];
  openings: OpeningCheck[];
  newAccounts: string[];
  newFunds: string[];
  newCategories: string[];
  newSubcategories: NewSubcategory[];
  newContributors: string[];
  knownContributors: number;
  transfersPaired: number;
  /** Movimiento que deja el archivo, por cuenta y moneda. */
  balances: Balance[];
  totals: Array<{ currency: Currency; income: number; expense: number; net: number }>;
  warnings: ImportWarning[];
};

const key = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const add = (a: number, b: number) => Math.round((a + b) * 100) / 100;

/** El id del grupo de una transferencia. `crypto` global existe en Node
 *  18+ y en el navegador; el fallback es por si el plan se arma en algún
 *  runtime viejo, y no necesita ser criptográfico: solo ata dos filas. */
function uuid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-axxx-xxxxxxxxxxxx".replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
}

export type PlanOptions = {
  /** Fuerza el tratamiento de las aperturas. Sin esto lo decide el libro:
   *  si ya hay movimientos anteriores, se verifican; si no, se importan. */
  openings?: "importadas" | "verificadas";
};

export function planImport(
  parsed: ParsedSheet,
  ctx: LedgerContext,
  options: PlanOptions = {}
): ImportPlan {
  const warnings: ImportWarning[] = [...parsed.warnings];

  // ─── Aperturas: se importan solo si el libro arranca acá ───────
  const openingRows = parsed.rows.filter((r) => r.isOpening);
  const movementRows = parsed.rows.filter((r) => !r.isOpening);
  const bookStartsHere = ctx.priorBalances.length === 0;

  const openingsMode: OpeningsMode =
    openingRows.length === 0
      ? "sin_apertura"
      : (options.openings ?? (bookStartsHere ? "importadas" : "verificadas"));

  const entries = openingsMode === "importadas" ? [...parsed.rows] : [...movementRows];
  const openingsSkipped = openingsMode === "importadas" ? [] : openingRows;

  if (openingsMode === "importadas" && !bookStartsHere) {
    warnings.push({
      level: "alto",
      text:
        "Estás importando los saldos de apertura aunque el libro ya tiene movimientos anteriores. El saldo del ejercicio va a quedar contado dos veces: los movimientos del año anterior YA SON esta apertura.",
    });
  }
  if (openingsMode === "verificadas" && bookStartsHere && openingRows.length > 0) {
    warnings.push({
      level: "alto",
      text:
        "El libro arranca con esta importación y estás dejando afuera los saldos de apertura: el ejercicio va a arrancar en cero.",
    });
  }

  // ─── La comparación de aperturas ───────────────────────────────
  const declared = new Map<string, number>();
  for (const r of openingRows) {
    const k = `${key(r.account)}|${r.currency}`;
    declared.set(k, add(declared.get(k) ?? 0, r.amount));
  }
  const computed = new Map<string, number>();
  for (const b of ctx.priorBalances) {
    computed.set(`${key(b.account)}|${b.currency}`, b.amount);
  }
  const nameOf = new Map<string, string>();
  for (const r of openingRows) nameOf.set(`${key(r.account)}|${r.currency}`, r.account);
  for (const b of ctx.priorBalances) {
    const k = `${key(b.account)}|${b.currency}`;
    if (!nameOf.has(k)) nameOf.set(k, b.account);
  }

  const openings: OpeningCheck[] = [...new Set([...declared.keys(), ...computed.keys()])]
    .map((k) => {
      const d = declared.get(k) ?? 0;
      const c = computed.get(k) ?? 0;
      return {
        account: nameOf.get(k) ?? k,
        currency: k.split("|")[1] as Currency,
        declared: d,
        computed: c,
        diff: add(d, -c),
      };
    })
    .sort((a, b) => a.account.localeCompare(b.account) || a.currency.localeCompare(b.currency));

  if (!bookStartsHere) {
    for (const o of openings) {
      if (Math.abs(o.diff) < 0.005) continue;
      warnings.push({
        level: "alto",
        text: `${o.account} · ${o.currency}: la planilla declara ${o.declared.toFixed(2)} de saldo anterior y el libro cierra el ejercicio pasado en ${o.computed.toFixed(2)} (diferencia ${o.diff.toFixed(2)}).`,
      });
    }
  }

  // ─── Transferencias: atar las dos patas ────────────────────────
  // Misma fecha, mismo rubro, signos opuestos. Pueden cruzar monedas: el
  // tipo de cambio queda implícito en los dos importes.
  const pending = new Map<string, number>();
  let transfersPaired = 0;
  entries.forEach((e, i) => {
    if (!TRANSFER_RE.test(e.subcategory)) return;
    const k = `${e.date}|${key(e.subcategory)}`;
    const waiting = pending.get(k);
    if (waiting !== undefined && Math.sign(entries[waiting].amount) !== Math.sign(e.amount)) {
      const group = uuid();
      entries[waiting].transferGroup = group;
      e.transferGroup = group;
      pending.delete(k);
      transfersPaired++;
    } else {
      pending.set(k, i);
    }
  });
  for (const i of pending.values()) {
    warnings.push({
      level: "alto",
      row: entries[i].row,
      text: `"${entries[i].subcategory}" parece una transferencia y no encontré su contraparte; entra como un movimiento suelto.`,
    });
  }

  // ─── Catálogo: qué existe y qué habría que crear ───────────────
  const known = (list: string[]) => new Set(list.map(key));
  const knownAccounts = known(ctx.accounts);
  const knownFunds = known(ctx.funds);
  const knownCategories = known(ctx.categories);
  const knownSubcategories = known(ctx.subcategories);
  const knownContributorNames = known(ctx.contributors);

  const pick = (values: Array<string | null | undefined>, seen: Set<string>) => {
    const out = new Map<string, string>();
    for (const v of values) {
      if (!v) continue;
      const k = key(v);
      if (seen.has(k) || out.has(k)) continue;
      out.set(k, v);
    }
    return [...out.values()].sort((a, b) => a.localeCompare(b));
  };

  const newAccounts = pick(entries.map((e) => e.account), knownAccounts);
  const newFunds = pick(entries.map((e) => e.fund), knownFunds);
  const newCategories = pick(entries.map((e) => e.category), knownCategories);

  const subMap = new Map<string, NewSubcategory>();
  for (const e of entries) {
    const k = key(e.subcategory);
    if (knownSubcategories.has(k) || subMap.has(k)) continue;
    subMap.set(k, { name: e.subcategory, category: e.category, fund: e.fund });
  }
  const newSubcategories = [...subMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  for (const s of newSubcategories) {
    if (!s.category) {
      warnings.push({
        level: "alto",
        text: `El rubro "${s.name}" no dice a qué categoría pertenece; se crea bajo "Sin categoría".`,
      });
    }
  }

  const newContributors = pick(entries.map((e) => e.contributor), knownContributorNames);
  const knownContributors = new Set(
    entries
      .map((e) => (e.contributor ? key(e.contributor) : null))
      .filter((k): k is string => !!k && knownContributorNames.has(k))
  ).size;

  // ─── Recibos: que la serie no choque ───────────────────────────
  const used = new Set(ctx.usedReceipts);
  const seenHere = new Map<number, number>();
  for (const e of entries) {
    if (e.receiptNumber == null) continue;
    if (used.has(e.receiptNumber)) {
      warnings.push({
        level: "alto",
        row: e.row,
        text: `El recibo N.º ${e.receiptNumber} ya existe en el libro. Los números son únicos por comunidad: la importación se va a rechazar hasta que se resuelva.`,
      });
    }
    const first = seenHere.get(e.receiptNumber);
    if (first !== undefined) {
      warnings.push({
        level: "alto",
        row: e.row,
        text: `El recibo N.º ${e.receiptNumber} aparece dos veces en la planilla (también en la fila ${first}).`,
      });
    } else {
      seenHere.set(e.receiptNumber, e.row);
    }
  }

  // ─── Fechas fuera del ejercicio declarado ──────────────────────
  if (ctx.yearStart && ctx.yearEnd) {
    const outside = entries.filter((e) => e.date < ctx.yearStart! || e.date > ctx.yearEnd!);
    if (outside.length > 0) {
      const first = outside[0];
      warnings.push({
        level: "aviso",
        text: `${outside.length} ${outside.length === 1 ? "movimiento cae" : "movimientos caen"} fuera del ejercicio ${ctx.bahaiYear} (${ctx.yearStart} a ${ctx.yearEnd}); el primero es del ${first.date}, fila ${first.row}. Se importan igual con el año que declaraste.`,
      });
    }
  }

  // ─── Saldos y totales del archivo ──────────────────────────────
  const balanceMap = new Map<string, Balance>();
  const totalsMap = new Map<Currency, { income: number; expense: number }>();
  for (const e of entries) {
    const k = `${key(e.account)}|${e.currency}`;
    const b = balanceMap.get(k) ?? { account: e.account, currency: e.currency, amount: 0 };
    b.amount = add(b.amount, e.amount);
    balanceMap.set(k, b);

    if (e.isOpening || e.transferGroup) continue; // no son movimiento del Fondo
    const t = totalsMap.get(e.currency) ?? { income: 0, expense: 0 };
    if (e.amount > 0) t.income = add(t.income, e.amount);
    else t.expense = add(t.expense, -e.amount);
    totalsMap.set(e.currency, t);
  }

  return {
    bahaiYear: ctx.bahaiYear,
    columns: parsed.columns,
    entries,
    openingsMode,
    openingsSkipped,
    openings,
    newAccounts,
    newFunds,
    newCategories,
    newSubcategories,
    newContributors,
    knownContributors,
    transfersPaired,
    balances: [...balanceMap.values()].sort(
      (a, b) => a.account.localeCompare(b.account) || a.currency.localeCompare(b.currency)
    ),
    totals: [...totalsMap.entries()].map(([currency, t]) => ({
      currency,
      income: t.income,
      expense: t.expense,
      net: add(t.income, -t.expense),
    })),
    warnings,
  };
}
