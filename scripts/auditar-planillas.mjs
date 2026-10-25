#!/usr/bin/env node
/**
 * Auditoría interna de las planillas de Tesorería de ejercicios anteriores
 * (Tesorería Nacional). Herramienta de UNA VEZ, fuera de la app: lee los
 * Excel tal cual los llevó el tesorero de entonces y arma un informe HTML
 * con los saldos del ejercicio y los errores de teneduría encontrados.
 *
 *   node scripts/auditar-planillas.mjs <archivo.xlsx | carpeta> [--out <carpeta>]
 *       [--nota "texto"] [--anterior <informe.json>]
 *       [--aclarado "<texto del hallazgo>|<lo que explicó Tesorería>"]
 *
 * --aclarado deja un hallazgo como RESUELTO sin tocar la planilla: lo que
 * Tesorería explicó (un recibo que cubre dos monedas porque así se emitió)
 * se imprime debajo del hallazgo y deja de contar entre los pendientes. La
 * clave es cualquier pedazo del texto del hallazgo ("N.º 5649").
 *
 * Con --anterior (el JSON que escribió una corrida previa) el informe abre
 * con "Qué cambió": hallazgos por clase y pruebas de saldo, antes y ahora.
 * Es como se mide una planilla corregida contra su primera auditoría.
 *
 * Con una carpeta audita todos los .xlsx que tengan hoja SALDOS, los ordena
 * por ejercicio y además verifica la continuidad: el cierre de un año contra
 * la apertura del siguiente.
 *
 * Por qué no usa el motor de auditoría de la app (lib/treasury-audit.ts): el
 * molde de estas planillas no tiene fondo, rubro ni contribuyente, que es de
 * lo que viven la mayoría de esas reglas, y las demás hablan de mecanismos de
 * la app (cierres, contra-asientos, informes) que en una planilla no existen.
 * Las reglas de acá son las que tienen sentido sobre una planilla, más las
 * que este molde pide y la app no necesita (signo contra la redacción, la
 * columna de recibo con cuatro series mezcladas, saldos declarados).
 *
 * El informe tiene nombres de personas: se escribe en una carpeta ignorada
 * por git y no se publica.
 */

import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

// ═══ Celdas ═════════════════════════════════════════════════════════

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Encabezado comparable: sin acentos, sin puntuación ("Subcategoria,"), sin "N°". */
const headerKey = (s) =>
  norm(s)
    .replace(/[^\w\s°º]/g, " ")
    .replace(/^(?:n|nro|num|numero)(?:\s*[°º]\s*|\s+)(?:de\s+)?/, "")
    .replace(/\s+/g, " ")
    .trim();

function cellDate(c) {
  if (c == null || c === "") return null;
  if (typeof c === "number" && c > 20000 && c < 80000) {
    return new Date(EXCEL_EPOCH + Math.round(c) * 86400000).toISOString().slice(0, 10);
  }
  const m = String(c).trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const iso = String(c).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

/**
 * Importe escrito por una persona en es-UY. Mismo criterio que
 * `sheetNumber()` de lib/ledger-import.ts: con punto y coma manda el último
 * separador; con punto solo, tres dígitos detrás son miles.
 */
function cellNumber(c) {
  if (c == null || c === "") return null;
  if (typeof c === "number") return Number.isFinite(c) ? Math.round(c * 100) / 100 : null;
  let s = String(c).replace(/[$\s]|US|UYU|USD/gi, "").trim();
  if (!s) return null;
  const neg = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[()-]/g, "");
  const lastDot = s.lastIndexOf("."), lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    s = lastDot > lastComma ? s.replace(/,/g, "") : s.replace(/\./g, "").replace(",", ".");
  } else if (lastComma >= 0) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (lastDot >= 0 && s.length - lastDot - 1 === 3) {
    s = s.replace(/\./g, "");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round((neg ? -n : n) * 100) / 100;
}

const round2 = (n) => Math.round(n * 100) / 100;
const MONEY = new Intl.NumberFormat("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (n) => (n == null ? "—" : MONEY.format(n === 0 ? 0 : n)); // n === 0 también atrapa el -0
const fdate = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");
const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ═══ Lectura de un archivo ══════════════════════════════════════════

const FIELD_NAMES = {
  fecha: ["fecha", "dia"],
  cuenta: ["cuenta", "caja"],
  descripcion: ["subcategoria", "descripcion", "concepto", "detalle", "rubro"],
  moneda: ["moneda"],
  ingresos: ["ingresos", "ingreso", "entradas", "haber"],
  gastos: ["gastos", "gasto", "egresos", "salidas", "debe"],
  recibo: ["recibo", "comprobante"],
};

function mapHeader(row) {
  const keys = (row ?? []).map(headerKey);
  const map = {};
  for (const [field, names] of Object.entries(FIELD_NAMES)) {
    const i = keys.findIndex((k) => names.includes(k));
    if (i >= 0) map[field] = i;
  }
  return map;
}

/** Todas las hojas que parecen un libro de movimientos, unidas en orden. */
function readMovements(wb) {
  const out = [];
  const sheets = [];
  for (const name of wb.SheetNames) {
    if (headerKey(name) === "saldos" || headerKey(name) === "rubros") continue;
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, blankrows: true });
    let hdr = -1, map = null;
    for (let i = 0; i < Math.min(rows.length, 40); i++) {
      const m = mapHeader(rows[i]);
      if (m.fecha != null && m.cuenta != null && (m.ingresos != null || m.gastos != null)) { hdr = i; map = m; break; }
    }
    if (!map) continue;
    sheets.push(name);
    for (let i = hdr + 1; i < rows.length; i++) {
      const r = rows[i] ?? [];
      if (r.every((c) => c == null || c === "")) continue;
      const at = (f) => (map[f] == null ? null : r[map[f]]);
      const ingRaw = at("ingresos"), gasRaw = at("gastos");
      out.push({
        hoja: name,
        fila: i + 1,
        fechaRaw: at("fecha"),
        fecha: cellDate(at("fecha")),
        cuenta: String(at("cuenta") ?? "").trim(),
        desc: String(at("descripcion") ?? "").replace(/\s+/g, " ").trim(),
        moneda: String(at("moneda") ?? "").trim().toUpperCase(),
        ing: cellNumber(ingRaw) ?? 0,
        gas: cellNumber(gasRaw) ?? 0,
        ingEsTexto: typeof ingRaw === "string" && ingRaw.trim() !== "",
        gasEsTexto: typeof gasRaw === "string" && gasRaw.trim() !== "",
        reciboRaw: at("recibo"),
      });
    }
  }
  return { rows: out, sheets };
}

/** La hoja SALDOS que se agregó a cada planilla. */
function readSaldos(wb) {
  const name = wb.SheetNames.find((n) => headerKey(n) === "saldos");
  if (!name) return null;
  const ws = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: true });
  const firstDateIn = (r) => (r ?? []).slice(1).map(cellDate).find(Boolean) ?? null;
  const out = { hoja: name, ejercicio: null, desde: null, hasta: null, cuentas: [], otras: [], totalesExcel: {} };

  let section = 0, hdrMap = null;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const a = norm(r[0]);
    if (/^1\)/.test(a)) section = 1;
    else if (/^2\)/.test(a)) section = 2;
    else if (/^3\)/.test(a)) section = 3;
    else if (/^4\)/.test(a)) section = 4;

    if (a.startsWith("ejercicio")) out.ejercicio = String(r[1] ?? "").trim() || null;
    if (a.startsWith("primer dia")) out.desde = firstDateIn(r);
    if (a.startsWith("ultimo dia")) out.hasta = firstDateIn(r);

    if (a === "cuenta" && (r ?? []).some((c) => norm(c).startsWith("saldo al inicio"))) {
      hdrMap = {};
      r.forEach((c, j) => {
        const k = norm(c);
        if (k === "cuenta") hdrMap.cuenta = j;
        else if (k.startsWith("banco")) hdrMap.banco = j;
        else if (k === "moneda") hdrMap.moneda = j;
        else if (k.startsWith("saldo al inicio")) hdrMap.inicio = j;
        else if (k.startsWith("saldo al cierre")) hdrMap.cierre = j;
        else if (k.startsWith("sigue")) hdrMap.abierta = j;
        else if (k.startsWith("observ")) hdrMap.obs = j;
      });
      continue;
    }
    if (a.startsWith("total en")) {
      const mon = /pesos|uyu/.test(a) ? "UYU" : /dolares|usd/.test(a) ? "USD" : null;
      if (mon && hdrMap) {
        out.totalesExcel[mon] = {
          inicio: cellNumber(r[hdrMap.inicio]),
          cierre: cellNumber(r[hdrMap.cierre]),
        };
      }
      continue;
    }
    if (!hdrMap || (section !== 2 && section !== 3) || !a || /^\d\)/.test(a) || a.startsWith("los totales") || a.startsWith("si hubo")) continue;
    const raw = (k) => (hdrMap[k] == null ? null : r[hdrMap[k]]);
    const item = {
      filaSaldos: i + 1,
      cuenta: String(raw("cuenta") ?? "").trim(),
      banco: String(raw("banco") ?? "").trim(),
      moneda: String(raw("moneda") ?? "").trim().toUpperCase(),
      inicio: cellNumber(raw("inicio")),
      cierre: cellNumber(raw("cierre")),
      inicioEsTexto: typeof raw("inicio") === "string" && String(raw("inicio")).trim() !== "",
      cierreEsTexto: typeof raw("cierre") === "string" && String(raw("cierre")).trim() !== "",
      abierta: String(raw("abierta") ?? "").trim(),
      obs: String(raw("obs") ?? "").trim(),
    };
    if (!item.cuenta) continue;
    (section === 2 ? out.cuentas : out.otras).push(item);
  }
  return out;
}

// ═══ Extractos del banco ════════════════════════════════════════════

/** Importe de una plataforma: el último separador es el decimal ("1,600.00"). */
function bankNumber(c) {
  if (c == null || c === "") return null;
  if (typeof c === "number") return round2(c);
  let s = String(c).replace(/\s/g, "");
  const d = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  if (d >= 0) s = s.slice(0, d).replace(/[.,]/g, "") + "." + s.slice(d + 1);
  const n = Number(s);
  return Number.isFinite(n) ? round2(n) : null;
}

/**
 * El reporte "Conciliación de Cuentas" de eBROU, exportado por período:
 * encabezado Fecha / Descripción / Número de documento / Asunto /
 * Dependencia / Débito / Crédito, y dos filas "Saldo inicial" y "Saldo
 * final". Es mejor que la pantalla "Saldos y Movimientos" que lee la app
 * (solo los últimos ~20): trae el período entero y los dos saldos.
 * Devuelve null si el archivo no es de ese molde.
 */
function readBrouStatement(file) {
  let wb;
  try { wb = XLSX.read(fs.readFileSync(file), { type: "buffer", raw: true }); } catch { return null; }
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, blankrows: false });
  const hdr = rows.findIndex((r) => {
    const k = Array.from(r ?? [], headerKey);
    return k.includes("fecha") && k.includes("debito") && k.includes("credito");
  });
  if (hdr < 0) return null;
  const k = Array.from(rows[hdr], headerKey);
  const col = (name) => k.indexOf(name);
  const cF = col("fecha"), cD = col("descripcion"), cA = col("asunto"), cDoc = k.findIndex((x) => x.startsWith("numero de doc") || x === "documento"), cDeb = col("debito"), cCre = col("credito");
  const head = rows.slice(0, hdr).flat().map((c) => String(c ?? ""));
  const numero = (head.join(" ").match(/\d{6,}-\d+/) ?? [null])[0];
  const periodo = head.map((s) => s.match(/(\d\d\/\d\d\/\d{4})\s*-\s*(\d\d\/\d\d\/\d{4})/)).find(Boolean);
  const fromName = path.basename(file).match(/cuenta\s*(\d+)/i);
  const fromNumber = numero?.match(/-(\d+)$/);
  const out = {
    file: path.basename(file), numero,
    cuenta: fromName ? `Cuenta ${Number(fromName[1])}` : fromNumber ? `Cuenta ${Number(fromNumber[1])}` : null,
    desde: periodo ? cellDate(periodo[1]) : null, hasta: periodo ? cellDate(periodo[2]) : null,
    inicial: null, final: null, lines: [],
  };
  for (const r of rows.slice(hdr + 1)) {
    const desc = String(r[cD] ?? "").trim();
    const deb = bankNumber(r[cDeb]), cre = bankNumber(r[cCre]);
    if (/^saldo inicial/i.test(desc)) { out.inicial = cre ?? (deb != null ? -deb : null); continue; }
    if (/^saldo final/i.test(desc)) { out.final = cre ?? (deb != null ? -deb : null); continue; }
    const fecha = cellDate(r[cF]);
    if (!fecha || (deb == null && cre == null)) continue;
    out.lines.push({
      fecha, desc, asunto: String(r[cA] ?? "").trim(), doc: String(r[cDoc] ?? "").trim(),
      amt: round2((cre ?? 0) - (deb ?? 0)), file: out.file,
    });
  }
  return out;
}

const dayDiff = (a, b) => Math.round(Math.abs(Date.parse(a) - Date.parse(b)) / 86400000);

/**
 * Planilla contra banco, una cuenta. Mismo criterio que `reconcile()` de
 * lib/treasury-reconcile.ts (importe exacto con signo, ±3 días, el más
 * cercano, uno a uno; después dos que suman), más las pasadas que en una
 * planilla vieja importan y en la app no hacen falta: el signo cambiado,
 * el importe con centavos de diferencia, la fecha equivocada y un asiento
 * por muchos depósitos del mismo día.
 *
 * El orden importa: primero lo que es evidencia fuerte (exacto), al final
 * lo que es más laxo, para que una pasada laxa no se quede con un par que
 * una estricta habría encontrado.
 */
function reconcileAccount(planRows, bankLines) {
  const P = planRows.map((r) => ({ ...r, amt: round2(r.ing - r.gas), used: false }));
  const B = bankLines.map((l) => ({ ...l, used: false }));
  const pairs = []; // { kind, plan: [], bank: [] }
  const W = 3;

  const oneToOne = (kind, test, window = W) => {
    for (const b of B) {
      if (b.used) continue;
      const c = P.filter((p) => !p.used && p.fecha && dayDiff(p.fecha, b.fecha) <= window && test(p, b))
        .sort((x, y) => dayDiff(x.fecha, b.fecha) - dayDiff(y.fecha, b.fecha));
      if (c[0]) { b.used = c[0].used = true; pairs.push({ kind, plan: [c[0]], bank: [b] }); }
    }
  };
  // Dos contra uno, en los dos sentidos. `sign` = 1 mismo signo, -1 invertido.
  const twoToOne = (kind, sign) => {
    for (const b of B) {
      if (b.used) continue;
      const fr = P.filter((p) => !p.used && p.fecha && dayDiff(p.fecha, b.fecha) <= W);
      let hit = null;
      for (let i = 0; i < fr.length && !hit; i++) for (let j = i + 1; j < fr.length && !hit; j++) {
        if (round2(fr[i].amt + fr[j].amt) === round2(sign * b.amt)) hit = [fr[i], fr[j]];
      }
      if (hit) { b.used = hit[0].used = hit[1].used = true; pairs.push({ kind, plan: hit, bank: [b] }); }
    }
    for (const p of P) {
      if (p.used || !p.fecha) continue;
      const fr = B.filter((b) => !b.used && dayDiff(p.fecha, b.fecha) <= W);
      let hit = null;
      for (let i = 0; i < fr.length && !hit; i++) for (let j = i + 1; j < fr.length && !hit; j++) {
        if (round2(fr[i].amt + fr[j].amt) === round2(sign * p.amt)) hit = [fr[i], fr[j]];
      }
      if (hit) { p.used = hit[0].used = hit[1].used = true; pairs.push({ kind, plan: [p], bank: hit }); }
    }
  };
  // Un asiento por TODOS los movimientos sueltos de un mismo día y signo.
  const dayGroup = () => {
    for (const p of P) {
      if (p.used || !p.fecha) continue;
      const g = B.filter((b) => !b.used && b.fecha === p.fecha && Math.sign(b.amt) === Math.sign(p.amt));
      if (g.length >= 3 && round2(g.reduce((s, b) => s + b.amt, 0)) === p.amt) {
        p.used = true; g.forEach((b) => (b.used = true));
        pairs.push({ kind: "grupo", plan: [p], bank: g });
      }
    }
  };

  oneToOne("exacto", (p, b) => p.amt === b.amt);
  twoToOne("suma", 1);
  dayGroup();
  oneToOne("signo", (p, b) => p.amt === -b.amt);
  twoToOne("signo", -1);
  oneToOne("importe", (p, b) => Math.sign(p.amt) === Math.sign(b.amt) && Math.abs(p.amt - b.amt) <= Math.max(1, Math.abs(b.amt) * 0.05));
  oneToOne("fecha", (p, b) => p.amt === b.amt, 120);

  const soloBanco = B.filter((b) => !b.used);
  const soloPlanilla = P.filter((p) => !p.used);
  // Cuánto mueve cada clase el saldo: banco menos planilla.
  const effectOf = (list) => round2(list.reduce((s, x) => s + x.bank.reduce((a, b) => a + b.amt, 0) - x.plan.reduce((a, p) => a + p.amt, 0), 0));
  const byKind = (k) => pairs.filter((x) => x.kind === k);
  const efectos = {
    signo: effectOf(byKind("signo")),
    importe: effectOf(byKind("importe")),
    fecha: effectOf(byKind("fecha")),
    soloBanco: round2(soloBanco.reduce((s, b) => s + b.amt, 0)),
    soloPlanilla: round2(-soloPlanilla.reduce((s, p) => s + p.amt, 0)),
  };
  return {
    pairs, soloBanco, soloPlanilla, efectos,
    total: round2(Object.values(efectos).reduce((a, b) => a + b, 0)),
    counts: { banco: B.length, planilla: P.length, ...Object.fromEntries(["exacto", "suma", "grupo", "signo", "importe", "fecha"].map((k) => [k, byKind(k).length])) },
  };
}

// ═══ Clasificación de la columna "N° Recibo" ════════════════════════

/**
 * La columna mezcla cuatro cosas: el recibo del aporte (5550, "*5564"), el
 * vale de pago en pesos ("P12/178"), el de dólares ("D3/178") y el medio de
 * pago ("Débito"). Cada una se audita por su lado.
 */
function classifyReceipt(raw) {
  if (raw == null || String(raw).trim() === "") return { kind: "vacio" };
  if (typeof raw === "number") return { kind: "recibo", n: raw, raw: String(raw) };
  const s = String(raw).trim();
  let m = s.match(/^\*?\s*(\d+)$/);
  if (m) return { kind: "recibo", n: Number(m[1]), raw: s, asterisco: s.startsWith("*") };
  m = s.match(/^([pd])\s*\.?\s*(\d+)\s*(?:\/\s*(\d+))?\s*$/i);
  if (m) return { kind: m[1].toUpperCase() === "P" ? "valeP" : "valeD", n: Number(m[2]), anio: m[3] ? Number(m[3]) : null, raw: s };
  if (/^d[eé]bito$/i.test(s)) return { kind: "debito", raw: s };
  return { kind: "otro", raw: s };
}

// ═══ Qué dice la redacción ══════════════════════════════════════════

const RX = {
  aporte: /\b(contribuci[oó]n|aporte|donaci[oó]n|donacion)\b/i,
  tributo: /contribuci[oó]n\s+inm|pago\s+contribuci[oó]n/i, // la "contribución inmobiliaria" es un impuesto
  devolucion: /devoluci|reintegro|retorno|error/i,
  gasto: /^(pago|imm\b|intendencia|reparaci|comisi|compra|gastos?\b)/i,
  traspaso: /\b(retiro|ingreso)\b.*\b(caja|cuenta|brou)\b|dep[oó]sito en caja|traspaso|entre cuentas propias/i,
  interes: /inter[eé]s/i,
};

// ═══ Catálogo de hallazgos ══════════════════════════════════════════

/**
 * Cada clase: qué es, cuán grave, y qué hace hoy la app con eso. El último
 * dato es la mitad del valor del informe: lo que la app ya impide deja de
 * ser una preocupación; lo que todavía no, es el pendiente.
 */
const CLASSES = {
  SALDO_NO_CUADRA: { sev: "alta", grupo: "Saldos", title: "El saldo al cierre no cuadra con los movimientos",
    app: ["mitiga", "En la app el saldo no se declara: se calcula siempre desde los movimientos. La verificación externa es la conciliación con el extracto (Tesorería → Conciliación)."] },
  CUENTA_SIN_SALDO: { sev: "alta", grupo: "Saldos", title: "Cuenta con movimientos y sin saldo declarado",
    app: ["evita", "El libro de la app arranca con un saldo de apertura por cuenta y moneda."] },
  SALDO_COMO_TEXTO: { sev: "media", grupo: "Saldos", title: "Saldo escrito como texto: Excel no lo suma",
    app: ["evita", "La app guarda importes como números; no existe un importe “escrito”."] },
  SALDO_NEGATIVO: { sev: "alta", grupo: "Saldos", title: "La cuenta queda con saldo negativo durante el año",
    app: ["mitiga", "La auditoría de la app lo marca (SALDO_NEGATIVO); no lo bloquea."] },
  MONEDA_AJENA: { sev: "alta", grupo: "Saldos", title: "Movimiento en una moneda que la cuenta no maneja",
    app: ["no", "La app hoy NO lo impide: las cuentas no declaran moneda. Pendiente para el libro."] },
  FALTA_EN_PLANILLA: { sev: "alta", grupo: "Conciliación con el banco", title: "Movimiento del banco que no está en la planilla",
    app: ["mitiga", "La conciliación de la app muestra lo que está en el extracto y no en el libro, cada vez que se importa."] },
  NO_ESTA_EN_BANCO: { sev: "alta", grupo: "Conciliación con el banco", title: "Movimiento de la planilla que no está en el banco",
    app: ["mitiga", "La conciliación de la app muestra lo que está en el libro y no en el extracto."] },
  SIGNO_CONFIRMADO: { sev: "alta", grupo: "Conciliación con el banco", title: "El banco confirma un error de signo",
    app: ["mitiga", "La conciliación de la app no empareja un importe con el signo cambiado: lo deja suelto de los dos lados, y ahí se ve."] },
  FECHA_DISTINTA: { sev: "media", grupo: "Conciliación con el banco", title: "Mismo movimiento, con otra fecha que el banco",
    app: ["mitiga", "La conciliación de la app empareja a ±3 días; más lejos queda suelto y se vincula a mano."] },
  IMPORTE_DISTINTO: { sev: "baja", grupo: "Conciliación con el banco", title: "Importe tipeado con diferencia de centavos",
    app: ["mitiga", "La conciliación de la app exige el importe exacto, así que el centavo de diferencia aparece."] },
  ASIENTO_AGRUPADO: { sev: "baja", grupo: "Conciliación con el banco", title: "Un asiento de la planilla por varios movimientos del banco",
    app: ["mitiga", "La conciliación de la app empareja hasta dos movimientos por línea; el resto se vincula a mano. Es válido, pero en aportes pierde el recibo de cada persona."] },
  BANCO_NO_CUBRE: { sev: "media", grupo: "Conciliación con el banco", title: "El extracto no cubre todo el ejercicio",
    app: ["mitiga", "La app marca por cuenta y mes si hay extracto importado."] },
  BANCO_SALDO_DISTINTO: { sev: "alta", grupo: "Conciliación con el banco", title: "El saldo del banco no es el declarado en SALDOS",
    app: ["evita", "En la app el saldo sale del libro y se coteja con el del extracto al importarlo."] },
  AUXILIAR_NO_CIERRA: { sev: "alta", grupo: "Saldos", title: "La Cuenta Auxiliar no queda en cero",
    app: ["evita", "En la app un monto con varios destinos se carga como varios asientos; no hace falta una cuenta puente."] },
  SIN_CUENTA: { sev: "alta", grupo: "Integridad", title: "Movimiento sin cuenta",
    app: ["evita", "La cuenta es obligatoria en cada movimiento."] },
  SIN_FECHA: { sev: "alta", grupo: "Integridad", title: "Movimiento sin fecha válida",
    app: ["evita", "La fecha es obligatoria y se elige de un calendario."] },
  SIN_MONEDA: { sev: "alta", grupo: "Integridad", title: "Movimiento sin moneda",
    app: ["evita", "La moneda es obligatoria."] },
  SIN_IMPORTE: { sev: "media", grupo: "Integridad", title: "Movimiento sin importe, o con ingreso y gasto a la vez",
    app: ["evita", "Cada movimiento tiene un solo importe con su tipo."] },
  IMPORTE_COMO_TEXTO: { sev: "media", grupo: "Integridad", title: "Importe escrito como texto",
    app: ["evita", "La app guarda importes como números."] },
  FUERA_DEL_EJERCICIO: { sev: "media", grupo: "Integridad", title: "Fecha fuera del ejercicio declarado",
    app: ["evita", "La app asigna el ejercicio a partir de la fecha del movimiento."] },
  DESORDEN_CRONOLOGICO: { sev: "baja", grupo: "Integridad", title: "Fila con fecha anterior a la de arriba",
    app: ["evita", "El libro se ordena solo por fecha."] },
  POSIBLE_DUPLICADO: { sev: "baja", grupo: "Integridad", title: "Filas idénticas (revisar si es doble carga)",
    app: ["no", "La app no lo impide. Muchas son legítimas (dos padrones del mismo tributo): es para revisar, no para corregir."] },
  APORTE_EN_GASTOS: { sev: "alta", grupo: "Signo", title: "Un ingreso anotado en la columna Gastos",
    app: ["mitiga", "La app pide el tipo y el rubro; la auditoría marca un signo que no corresponde al rubro (SIGNO_ATIPICO)."] },
  GASTO_EN_INGRESOS: { sev: "alta", grupo: "Signo", title: "Un gasto anotado en la columna Ingresos",
    app: ["mitiga", "La app pide el tipo y el rubro; la auditoría marca un signo que no corresponde al rubro (SIGNO_ATIPICO)."] },
  TRASPASO_SIN_PAREJA: { sev: "alta", grupo: "Traspasos", title: "Traspaso entre cuentas con una sola pata",
    app: ["evita", "Una transferencia en la app es UNA operación con dos asientos atados: no puede quedar media."] },
  RECIBO_DUPLICADO: { sev: "alta", grupo: "Recibos", title: "Número de recibo repetido",
    app: ["evita", "El número de recibo es único por comunidad (índice en la base)."] },
  RECIBO_FUERA_DE_SERIE: { sev: "media", grupo: "Recibos", title: "Recibo con un número que no es de la serie del año",
    app: ["evita", "El próximo número lo da la app (next_receipt_number), no la memoria de nadie."] },
  RECIBO_HUECO: { sev: "media", grupo: "Recibos", title: "Número de recibo que falta en la serie",
    app: ["evita", "La serie es correlativa por construcción; un recibo que no va se anula y conserva el número."] },
  RECIBO_FUERA_DE_ORDEN: { sev: "baja", grupo: "Recibos", title: "Recibo con número fuera del orden de las fechas",
    app: ["evita", "El número se asigna al registrar, así que sigue a la fecha de carga."] },
  APORTE_SIN_RECIBO: { sev: "media", grupo: "Recibos", title: "Aporte sin número de recibo",
    app: ["evita", "Todo aporte recibe número al guardarse."] },
  RECIBO_EN_TRASPASO: { sev: "baja", grupo: "Recibos", title: "Número de recibo sobre un traspaso entre cuentas propias",
    app: ["evita", "En la app el recibo solo existe en los aportes; una transferencia no lleva número."] },
  RECIBO_EN_GASTO: { sev: "media", grupo: "Recibos", title: "Número de recibo de aporte en una salida",
    app: ["evita", "El recibo solo existe en los aportes."] },
  VALE_DUPLICADO: { sev: "media", grupo: "Vales de pago", title: "Vale de pago (P/D) repetido",
    app: ["no", "La app no tiene vales de pago: el respaldo de un gasto es el comprobante adjunto al movimiento."] },
  VALE_HUECO: { sev: "baja", grupo: "Vales de pago", title: "Vale de pago que falta en la serie",
    app: ["no", "La app no tiene vales de pago: el respaldo de un gasto es el comprobante adjunto al movimiento."] },
  VALE_OTRO_EJERCICIO: { sev: "baja", grupo: "Vales de pago", title: "Vale con el sufijo de otro ejercicio",
    app: ["no", "La app no tiene vales de pago."] },
  VALE_MONEDA: { sev: "media", grupo: "Vales de pago", title: "Vale P en dólares, o vale D en pesos",
    app: ["no", "La app no tiene vales de pago."] },
  VALE_EN_INGRESO: { sev: "media", grupo: "Vales de pago", title: "Vale de pago en un ingreso",
    app: ["no", "La app no tiene vales de pago."] },
  GASTO_SIN_RESPALDO: { sev: "baja", grupo: "Respaldo", title: "Gasto sin vale, débito ni comprobante anotado",
    app: ["mitiga", "La auditoría de la app marca el gasto sin comprobante adjunto (GASTO_SIN_COMPROBANTE)."] },
  COMPROBANTE_ILEGIBLE: { sev: "baja", grupo: "Respaldo", title: "La columna de recibo tiene algo que no se entiende",
    app: ["evita", "En la app el número de recibo es un campo numérico aparte del comprobante."] },
};

const SEV_ORDER = { alta: 0, media: 1, baja: 2 };

// ═══ Auditoría de un ejercicio ══════════════════════════════════════

function auditFile(file, statements = [], aclaraciones = []) {
  const wb = XLSX.read(fs.readFileSync(file), { type: "buffer", raw: true });
  const { rows, sheets } = readMovements(wb);
  const saldos = readSaldos(wb);
  const findings = new Map(); // code → [{fila, hoja, text}]
  const add = (code, item) => {
    if (!findings.has(code)) findings.set(code, []);
    findings.get(code).push(item);
  };
  const where = (r) => ({ fila: r.fila, hoja: r.hoja });
  const line = (r) =>
    `${fdate(r.fecha)} · ${r.cuenta || "(sin cuenta)"} · ${r.moneda} ${money(r.ing || -r.gas)} · ${r.desc}`;

  for (const r of rows) r.rec = classifyReceipt(r.reciboRaw);

  // ── Integridad ─────────────────────────────────────────────────
  let prevDate = null;
  for (const r of rows) {
    if (!r.fecha) add("SIN_FECHA", { ...where(r), text: `${r.desc} (celda: ${esc(r.fechaRaw ?? "vacía")})` });
    if (!r.cuenta) add("SIN_CUENTA", { ...where(r), text: `${line(r)} — no entra en ningún saldo` });
    if (!r.moneda) add("SIN_MONEDA", { ...where(r), text: line(r) });
    if ((!r.ing && !r.gas) || (r.ing && r.gas)) add("SIN_IMPORTE", { ...where(r), text: line(r) });
    if (r.ingEsTexto || r.gasEsTexto) add("IMPORTE_COMO_TEXTO", { ...where(r), text: line(r) });
    if (r.fecha && saldos?.desde && saldos?.hasta && (r.fecha < saldos.desde || r.fecha > saldos.hasta)) {
      add("FUERA_DEL_EJERCICIO", { ...where(r), text: `${line(r)} (ejercicio: ${fdate(saldos.desde)} al ${fdate(saldos.hasta)})` });
    }
    if (r.fecha && prevDate && r.fecha < prevDate) add("DESORDEN_CRONOLOGICO", { ...where(r), text: `${fdate(r.fecha)} después de ${fdate(prevDate)}` });
    if (r.fecha) prevDate = r.fecha > (prevDate ?? "") ? r.fecha : prevDate;
    if (r.rec.kind === "otro") add("COMPROBANTE_ILEGIBLE", { ...where(r), text: `«${r.rec.raw}» · ${line(r)}` });
  }
  const dupKey = new Map();
  for (const r of rows) {
    const k = [r.fecha, r.cuenta, r.moneda, r.ing, r.gas, norm(r.desc)].join("|");
    if (!dupKey.has(k)) dupKey.set(k, []);
    dupKey.get(k).push(r);
  }
  for (const g of dupKey.values()) {
    if (g.length > 1) add("POSIBLE_DUPLICADO", { fila: g[0].fila, hoja: g[0].hoja, text: `filas ${g.map((x) => x.fila).join(", ")} · ${line(g[0])}` });
  }

  // ── Signo ──────────────────────────────────────────────────────
  // La columna de recibo es la mejor evidencia de la dirección: un recibo
  // de aporte dice "entró", un vale P/D dice "salió". La redacción solo
  // decide cuando la columna no dice nada.
  const signFlagged = new Set();
  for (const r of rows) {
    const vale = r.rec.kind === "valeP" || r.rec.kind === "valeD";
    if (r.gas > 0 && !RX.devolucion.test(r.desc) && !vale &&
        (r.rec.kind === "recibo" || (RX.aporte.test(r.desc) && !RX.tributo.test(r.desc)))) {
      add("APORTE_EN_GASTOS", { ...where(r), text: `${line(r)}${r.rec.kind === "recibo" ? ` · lleva el recibo ${r.rec.n}` : ""}` });
      signFlagged.add(r);
    }
    if (r.ing > 0 && r.rec.kind !== "recibo" && !RX.devolucion.test(r.desc) &&
        (vale || r.rec.kind === "debito" || (RX.gasto.test(r.desc) && !RX.traspaso.test(r.desc)))) {
      add("GASTO_EN_INGRESOS", { ...where(r), text: `${line(r)}${vale ? ` · lleva el vale ${r.rec.raw}` : ""}` });
      signFlagged.add(r);
    }
  }

  // ── Traspasos ──────────────────────────────────────────────────
  const tr = rows.filter((r) => RX.traspaso.test(r.desc) && r.rec.kind !== "valeP" && r.rec.kind !== "valeD" && (r.ing || r.gas));
  const used = new Set();
  const pairs = [];
  for (const a of tr) {
    if (used.has(a)) continue;
    const amt = a.ing - a.gas;
    const b = tr.find((x) => !used.has(x) && x !== a && x.fecha === a.fecha && x.moneda === a.moneda &&
      round2(x.ing - x.gas) === round2(-amt) && x.cuenta !== a.cuenta);
    if (b) { used.add(a); used.add(b); pairs.push([a, b]); }
  }
  // Una pata contra varias: el mismo día, la misma moneda, todas de OTRA
  // cuenta (una sola) y con el signo contrario, que sumen lo mismo. Hasta
  // cuatro partes: más que eso ya no es un retiro partido, es otra cosa.
  for (const a of tr) {
    if (used.has(a)) continue;
    const amt = round2(a.ing - a.gas);
    const cands = tr.filter((x) => !used.has(x) && x !== a && x.fecha === a.fecha && x.moneda === a.moneda &&
      x.cuenta !== a.cuenta && Math.sign(round2(x.ing - x.gas)) === -Math.sign(amt));
    let hit = null;
    const byAcc = new Map();
    for (const c of cands) { if (!byAcc.has(c.cuenta)) byAcc.set(c.cuenta, []); byAcc.get(c.cuenta).push(c); }
    for (const group of byAcc.values()) {
      const n = Math.min(group.length, 6);
      for (let mask = 1; mask < 1 << n && !hit; mask++) {
        const parts = group.slice(0, n).filter((_, i) => mask & (1 << i));
        if (parts.length >= 2 && parts.length <= 4 && round2(parts.reduce((s, x) => s + x.ing - x.gas, 0)) === round2(-amt)) hit = parts;
      }
      if (hit) break;
    }
    if (hit) { used.add(a); hit.forEach((x) => used.add(x)); pairs.push([a, ...hit]); }
  }
  for (const a of tr) {
    if (used.has(a)) continue;
    const dir = a.ing ? "entra" : "sale";
    const hint = /retiro/i.test(a.desc) && a.ing && !/caja/i.test(a.cuenta)
      ? " — un retiro de la cuenta del banco es una SALIDA de esa cuenta, y está como ingreso" : "";
    add("TRASPASO_SIN_PAREJA", { ...where(a), text: `${line(a)} (${dir}; falta la otra pata)${hint}` });
  }

  // ── Recibos ────────────────────────────────────────────────────
  const recs = rows.filter((r) => r.rec.kind === "recibo");
  const byN = new Map();
  for (const r of recs) {
    if (!byN.has(r.rec.n)) byN.set(r.rec.n, []);
    byN.get(r.rec.n).push(r);
  }
  for (const [n, g] of byN) {
    if (g.length > 1) add("RECIBO_DUPLICADO", { fila: g[0].fila, hoja: g[0].hoja, text: `N.º ${n} en las filas ${g.map((x) => x.fila).join(" y ")}: ${g.map((x) => `${money(x.ing || x.gas)} ${x.moneda} «${x.desc}»`).join(" / ")}` });
  }
  // La serie del año sale de la subsecuencia creciente más larga en el
  // orden de las FECHAS, no del rango de los números: un recibo con un
  // dígito mal tipeado (5423 en setiembre, cuando la serie iba por el 5620)
  // queda afuera solo, en vez de abrir cien huecos falsos. Lo que no entra
  // en esa subsecuencia es el conjunto mínimo de recibos "corridos".
  // Dentro de un mismo día manda el orden de las filas: es lo que anotó el
  // tesorero. Ordenar por número sería dar por bueno justo lo que se audita.
  const dated = recs.filter((r) => r.fecha)
    .sort((a, b) => (a.fecha === b.fecha ? a.fila - b.fila : a.fecha < b.fecha ? -1 : 1));
  const lis = longestNonDecreasing(dated.map((r) => r.rec.n));
  const lisVals = dated.filter((_, i) => lis.has(i)).map((r) => r.rec.n);
  const serie = lisVals.length ? { from: Math.min(...lisVals), to: Math.max(...lisVals) } : { from: null, to: null };
  const missing = new Set();
  if (serie.from != null) for (let n = serie.from; n <= serie.to; n++) if (!byN.has(n)) missing.add(n);
  // Un número repetido o suelto y otro que falta son casi siempre el mismo
  // error de tipeo — pero solo si el faltante está a UN dígito Y además cabe
  // por fecha: entre el recibo anterior y el siguiente de la serie. Sin la
  // segunda condición, en una serie de cuatro dígitos casi cualquier número
  // queda a un dígito de algún faltante y la sugerencia sería ruido.
  const claimed = new Map(); // faltante → fila que probablemente lo es
  const fits = (n, r) => {
    const at = dated.indexOf(r);
    const lo = Math.max(-Infinity, ...dated.filter((x, i) => lis.has(i) && i < at).map((x) => x.rec.n));
    const hi = Math.min(Infinity, ...dated.filter((x, i) => lis.has(i) && i > at).map((x) => x.rec.n));
    return [...missing].find((m) => m > lo && m < hi && oneTypoAway(n, m)) ?? null;
  };
  const guess = (n, r) => {
    const g = fits(n, r);
    if (g == null) return "";
    if (!claimed.has(g)) claimed.set(g, r.fila);
    return ` — ¿es el ${g}? Ese número falta en la serie y cabe por la fecha`;
  };
  dated.forEach((r, i) => {
    if (lis.has(i)) return;
    const n = r.rec.n;
    if (n < serie.from || n > serie.to) {
      add("RECIBO_FUERA_DE_SERIE", { ...where(r), text: `N.º ${n} con fecha ${fdate(r.fecha)}, cuando la serie del año va del ${serie.from} al ${serie.to} · ${r.desc}${guess(n, r)}` });
    } else {
      add("RECIBO_FUERA_DE_ORDEN", { ...where(r), text: `N.º ${n} con fecha ${fdate(r.fecha)} · ${r.desc}${guess(n, r)}` });
    }
  });
  for (const [n, g] of byN) {
    if (g.length < 2) continue;
    const it = (findings.get("RECIBO_DUPLICADO") ?? []).find((x) => x.text.startsWith(`N.º ${n} `));
    // El mal tipeado puede ser cualquiera de las filas: se prueba cada una.
    const who = g.find((r) => r.fecha && fits(n, r) != null);
    if (it && who) it.text += ` — la fila ${who.fila}` + guess(n, who).replace(" — ", ": ");
  }
  for (const n of missing) {
    add("RECIBO_HUECO", { fila: null, hoja: null, text: `N.º ${n}${claimed.has(n) ? ` — probablemente es el de la fila ${claimed.get(n)}, tipeado con un dígito cambiado` : ""}` });
  }
  for (const r of rows) {
    if (r.ing > 0 && RX.aporte.test(r.desc) && !RX.tributo.test(r.desc) && r.rec.kind !== "recibo") {
      add("APORTE_SIN_RECIBO", { ...where(r), text: `${line(r)}${r.rec.kind !== "vacio" ? ` · la columna dice «${r.rec.raw}»` : ""}` });
    }
    if (r.gas > 0 && r.rec.kind === "recibo" && !signFlagged.has(r) && !RX.devolucion.test(r.desc)) {
      add("RECIBO_EN_GASTO", { ...where(r), text: `N.º ${r.rec.n} · ${line(r)}` });
    }
    if (r.rec.kind === "recibo" && tr.includes(r)) {
      add("RECIBO_EN_TRASPASO", { ...where(r), text: `N.º ${r.rec.n} · ${line(r)} — ese número queda ocupado por un movimiento que no es un aporte` });
    }
  }

  // ── Vales de pago P/D ──────────────────────────────────────────
  const ej = Number(saldos?.ejercicio) || null;
  for (const [kind, letra, moneda] of [["valeP", "P", "UYU"], ["valeD", "D", "USD"]]) {
    const vs = rows.filter((r) => r.rec.kind === kind);
    const m = new Map();
    for (const r of vs) {
      if (!m.has(r.rec.n)) m.set(r.rec.n, []);
      m.get(r.rec.n).push(r);
      if (ej && r.rec.anio && r.rec.anio !== ej) add("VALE_OTRO_EJERCICIO", { ...where(r), text: `«${r.rec.raw}» en el ejercicio ${ej}` });
      if (r.moneda && r.moneda !== moneda) add("VALE_MONEDA", { ...where(r), text: `«${r.rec.raw}» en ${r.moneda} · ${line(r)}` });
      if (r.ing > 0 && !signFlagged.has(r)) add("VALE_EN_INGRESO", { ...where(r), text: `«${r.rec.raw}» · ${line(r)}` });
    }
    for (const [n, g] of m) if (g.length > 1) add("VALE_DUPLICADO", { fila: g[0].fila, hoja: g[0].hoja, text: `${letra}${n} en las filas ${g.map((x) => x.fila).join(" y ")}` });
    const ks = [...m.keys()].sort((a, b) => a - b);
    for (let n = 1; ks.length && n <= ks[ks.length - 1]; n++) if (!m.has(n)) add("VALE_HUECO", { fila: null, hoja: null, text: `${letra}${n}/${ej ?? "?"}` });
  }
  for (const r of rows) {
    if (r.gas > 0 && r.rec.kind === "vacio" && !RX.traspaso.test(r.desc) && !signFlagged.has(r)) {
      add("GASTO_SIN_RESPALDO", { ...where(r), text: line(r) });
    }
  }

  // ── Saldos ─────────────────────────────────────────────────────
  const accounts = new Map(); // "cuenta|moneda" → datos
  const keyOf = (c, m) => `${c}|${m}`;
  const ensure = (c, m) => {
    const k = keyOf(c, m);
    if (!accounts.has(k)) accounts.set(k, { cuenta: c, moneda: m, banco: "", inicio: null, cierre: null, ing: 0, gas: 0, n: 0, declared: false, obs: "", abierta: "" });
    return accounts.get(k);
  };
  const declaredCurrencies = new Map(); // cuenta → Set(moneda) con saldo numérico
  for (const s of [...(saldos?.cuentas ?? []), ...(saldos?.otras ?? [])]) {
    const a = ensure(s.cuenta, s.moneda);
    Object.assign(a, { banco: s.banco, inicio: s.inicio, cierre: s.cierre, obs: s.obs, abierta: s.abierta, declared: s.inicio != null || s.cierre != null });
    if (s.inicio != null || s.cierre != null) {
      if (!declaredCurrencies.has(s.cuenta)) declaredCurrencies.set(s.cuenta, new Set());
      declaredCurrencies.get(s.cuenta).add(s.moneda);
    }
    if (s.inicioEsTexto || s.cierreEsTexto) {
      add("SALDO_COMO_TEXTO", { fila: s.filaSaldos, hoja: saldos.hoja, text: `${s.cuenta} ${s.moneda}: ${[s.inicioEsTexto && `inicio «${money(s.inicio)}»`, s.cierreEsTexto && `cierre «${money(s.cierre)}»`].filter(Boolean).join(" y ")} — la fórmula de TOTAL EN ${s.moneda === "USD" ? "DÓLARES" : "PESOS"} lo deja afuera` });
    }
  }
  for (const r of rows) {
    if (!r.cuenta || !r.moneda) continue;
    const a = ensure(r.cuenta, r.moneda);
    a.ing = round2(a.ing + r.ing);
    a.gas = round2(a.gas + r.gas);
    a.n++;
    const decl = declaredCurrencies.get(r.cuenta);
    if (decl && decl.size && !decl.has(r.moneda)) {
      add("MONEDA_AJENA", { ...where(r), text: `${line(r)} — según SALDOS, ${r.cuenta} maneja solo ${[...decl].join(" y ")}` });
    }
  }
  for (const a of accounts.values()) {
    a.neto = round2(a.ing - a.gas);
    a.calculado = a.inicio == null ? null : round2(a.inicio + a.neto);
    a.diferencia = a.cierre == null || a.calculado == null ? null : round2(a.cierre - a.calculado);
    if (a.n && !a.declared) add("CUENTA_SIN_SALDO", { fila: null, hoja: null, text: `${a.cuenta} ${a.moneda}: ${a.n} movimientos y ningún saldo en la hoja SALDOS` });
    if (a.diferencia) {
      add("SALDO_NO_CUADRA", { fila: null, hoja: null, text: `${a.cuenta} ${a.moneda}: inicio ${money(a.inicio)} + movimientos ${money(a.neto)} = ${money(a.calculado)}, y el cierre declarado es ${money(a.cierre)}. Diferencia: ${money(a.diferencia)}` });
    }
    if (/auxiliar/i.test(a.cuenta) && a.n && a.neto) add("AUXILIAR_NO_CIERRA", { fila: null, hoja: null, text: `${a.cuenta} ${a.moneda} termina el año con ${money(a.neto)}` });
  }
  // Saldo corrido día por día, desde el inicio declarado.
  for (const a of accounts.values()) {
    if (!a.n) continue;
    const mv = rows.filter((r) => r.cuenta === a.cuenta && r.moneda === a.moneda && r.fecha)
      .sort((x, y) => (x.fecha === y.fecha ? x.fila - y.fila : x.fecha < y.fecha ? -1 : 1));
    let bal = a.inicio ?? 0, min = bal, minAt = null, firstNeg = null;
    // Por día: dentro de un mismo día el orden de las filas no es evidencia.
    const days = new Map();
    for (const r of mv) days.set(r.fecha, round2((days.get(r.fecha) ?? 0) + r.ing - r.gas));
    for (const [d, net] of [...days].sort()) {
      bal = round2(bal + net);
      if (bal < min) { min = bal; minAt = d; }
      if (bal < -0.005 && !firstNeg) firstNeg = d;
    }
    a.minimo = min;
    a.minimoFecha = minAt;
    if (firstNeg) add("SALDO_NEGATIVO", { fila: null, hoja: null, text: `${a.cuenta} ${a.moneda}: queda en negativo el ${fdate(firstNeg)}; el punto más bajo es ${money(min)} el ${fdate(minAt)}${a.inicio == null ? " (sin saldo inicial declarado: se partió de cero)" : ""}` });
  }

  // ── Conciliación con el banco ──────────────────────────────────
  // Con extracto, el banco manda: confirma o descarta lo que las reglas de
  // signo sospecharon por la redacción, y explica la diferencia de saldo
  // entera en vez de dar una hipótesis.
  const conciliacion = [];
  const reconciled = new Set();
  const stByCuenta = new Map();
  for (const s of statements) {
    if (!s.cuenta) continue;
    if (!stByCuenta.has(s.cuenta)) stByCuenta.set(s.cuenta, []);
    stByCuenta.get(s.cuenta).push(s);
  }
  for (const [cuenta, sts] of stByCuenta) {
    sts.sort((a, b) => (a.desde < b.desde ? -1 : 1));
    const decl = declaredCurrencies.get(cuenta);
    const moneda = decl?.size === 1 ? [...decl][0]
      : [...rows.filter((r) => r.cuenta === cuenta).reduce((m, r) => m.set(r.moneda, (m.get(r.moneda) ?? 0) + 1), new Map())].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!moneda) continue;
    const acc = accounts.get(`${cuenta}|${moneda}`);
    // Continuidad de los extractos entre sí y cobertura del ejercicio.
    const cortes = [];
    for (let i = 1; i < sts.length; i++) {
      if (round2(sts[i - 1].final) !== round2(sts[i].inicial)) cortes.push(`${sts[i - 1].file} cierra en ${money(sts[i - 1].final)} y ${sts[i].file} abre en ${money(sts[i].inicial)}`);
    }
    const desde = sts[0].desde, hasta = sts[sts.length - 1].hasta;
    if (saldos?.desde && saldos?.hasta && (desde > saldos.desde || hasta < saldos.hasta)) {
      add("BANCO_NO_CUBRE", { fila: null, hoja: null, text: `${cuenta}: los extractos van del ${fdate(desde)} al ${fdate(hasta)} y el ejercicio del ${fdate(saldos.desde)} al ${fdate(saldos.hasta)}` });
    }
    cortes.forEach((t) => add("BANCO_NO_CUBRE", { fila: null, hoja: null, text: `${cuenta}: ${t}` }));
    const bankIni = sts[0].inicial, bankFin = sts[sts.length - 1].final;
    if (acc?.inicio != null && bankIni != null && round2(acc.inicio) !== round2(bankIni)) add("BANCO_SALDO_DISTINTO", { fila: null, hoja: null, text: `${cuenta} ${moneda} al inicio: SALDOS dice ${money(acc.inicio)}, el banco ${money(bankIni)}` });
    if (acc?.cierre != null && bankFin != null && round2(acc.cierre) !== round2(bankFin)) add("BANCO_SALDO_DISTINTO", { fila: null, hoja: null, text: `${cuenta} ${moneda} al cierre: SALDOS dice ${money(acc.cierre)}, el banco ${money(bankFin)}` });

    const planRows = rows.filter((r) => r.cuenta === cuenta && r.moneda === moneda && r.fecha);
    const lines = sts.flatMap((s) => s.lines);
    const rec = reconcileAccount(planRows, lines);
    const neto = round2(planRows.reduce((s, r) => s + r.ing - r.gas, 0));
    const aExplicar = round2(bankFin - (bankIni + neto));

    const pl = (p) => `fila ${p.fila} · ${fdate(p.fecha)} · ${money(p.amt)} «${p.desc}»`;
    const bl = (b) => `${fdate(b.fecha)} · ${money(b.amt)} «${b.desc}${b.asunto ? ` · ${b.asunto}` : ""}»`;
    for (const x of rec.pairs) {
      const txt = `planilla ${x.plan.map(pl).join(" + ")} ↔ banco ${x.bank.map(bl).join(" + ")}`;
      const it = { fila: x.plan[0].fila, hoja: x.plan[0].hoja, text: txt };
      if (x.kind === "signo") add("SIGNO_CONFIRMADO", it);
      if (x.kind === "fecha") add("FECHA_DISTINTA", it);
      if (x.kind === "importe") add("IMPORTE_DISTINTO", { ...it, text: `${txt} — diferencia ${money(round2(x.bank[0].amt - x.plan[0].amt))}` });
      if (x.kind === "grupo") add("ASIENTO_AGRUPADO", { ...it, text: `planilla ${pl(x.plan[0])} ↔ ${x.bank.length} movimientos del banco del mismo día que suman lo mismo` });
    }
    rec.soloBanco.forEach((b) => add("FALTA_EN_PLANILLA", { fila: null, hoja: null, text: `${cuenta}: ${bl(b)}` }));
    rec.soloPlanilla.forEach((p) => add("NO_ESTA_EN_BANCO", { fila: p.fila, hoja: p.hoja, text: `${cuenta}: ${pl(p)}` }));

    // Las sospechas de signo de esta cuenta quedan resueltas por el banco.
    const kindOf = new Map();
    rec.pairs.forEach((x) => x.plan.forEach((p) => kindOf.set(p.fila, x.kind)));
    const descartadas = [];
    for (const code of ["APORTE_EN_GASTOS", "GASTO_EN_INGRESOS"]) {
      const items = findings.get(code);
      if (!items) continue;
      const keep = items.filter((it) => {
        const r = planRows.find((p) => p.fila === it.fila);
        if (!r || !kindOf.has(r.fila)) return true;
        if (kindOf.get(r.fila) !== "signo") descartadas.push(`fila ${r.fila} · ${money(r.ing || -r.gas)} «${r.desc}»: el banco lo tiene con el mismo signo que la planilla`);
        signFlagged.delete(r);
        return false;
      });
      if (keep.length) findings.set(code, keep); else findings.delete(code);
    }
    reconciled.add(`${cuenta}|${moneda}`);
    const nc = (findings.get("SALDO_NO_CUADRA") ?? []).find((it) => it.text.startsWith(`${cuenta} ${moneda}:`));
    if (nc) nc.text += round2(aExplicar - rec.total) === 0
      ? " — explicada entera por el extracto del banco (sección 4)"
      : ` — el extracto explica ${money(rec.total)}; quedan ${money(round2(aExplicar - rec.total))}`;
    conciliacion.push({
      cuenta, moneda, numero: sts[0].numero, archivos: sts.map((s) => s.file), desde, hasta,
      bankIni, bankFin, declIni: acc?.inicio ?? null, declFin: acc?.cierre ?? null,
      neto, aExplicar, ...rec, descartadas, cortes,
    });
  }

  const explanations = explainDifferences([...accounts.values()].filter((a) => !reconciled.has(`${a.cuenta}|${a.moneda}`)), rows, signFlagged, findings);

  // Totales por moneda, nunca juntos.
  const totals = {};
  for (const a of accounts.values()) {
    if (!a.moneda) continue;
    const t = (totals[a.moneda] ??= { inicio: 0, ing: 0, gas: 0, calculado: 0, cierre: 0 });
    t.inicio = round2(t.inicio + (a.inicio ?? 0));
    t.ing = round2(t.ing + a.ing);
    t.gas = round2(t.gas + a.gas);
    t.calculado = round2(t.calculado + (a.calculado ?? a.neto));
    t.cierre = round2(t.cierre + (a.cierre ?? 0));
  }
  const sinCuenta = {};
  for (const r of rows.filter((x) => !x.cuenta)) sinCuenta[r.moneda || "?"] = round2((sinCuenta[r.moneda || "?"] ?? 0) + r.ing - r.gas);

  const recComposition = {};
  for (const r of rows) recComposition[r.rec.kind] = (recComposition[r.rec.kind] ?? 0) + 1;

  for (const items of findings.values()) for (const it of items) {
    const a = aclaraciones.find((x) => it.text.includes(x.key));
    if (a) { it.aclarado = a.text; a.used = true; }
  }
  const fechas = rows.map((r) => r.fecha).filter(Boolean).sort();
  return {
    file: path.basename(file),
    ejercicio: saldos?.ejercicio ?? null,
    desde: saldos?.desde ?? null,
    hasta: saldos?.hasta ?? null,
    primerMov: fechas[0] ?? null,
    ultimoMov: fechas[fechas.length - 1] ?? null,
    sheets,
    hasSaldos: !!saldos,
    movimientos: rows.length,
    accounts: [...accounts.values()].sort((a, b) => a.moneda.localeCompare(b.moneda) || a.cuenta.localeCompare(b.cuenta, "es", { numeric: true })),
    totals,
    totalesExcel: saldos?.totalesExcel ?? {},
    sinCuenta,
    explanations,
    conciliacion,
    traspasos: { pares: pairs.length, sueltos: (findings.get("TRASPASO_SIN_PAREJA") ?? []).length },
    recibos: { composition: recComposition, serie, cantidad: recs.length },
    findings: [...findings].map(([code, items]) => ({ code, ...CLASSES[code], items }))
      .sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev] || b.items.length - a.items.length),
  };
}

/**
 * ¿Los errores encontrados explican las diferencias de saldo?
 *
 * Cada hallazgo que mueve plata es un candidato con su efecto sobre una o
 * más cuentas: un signo invertido corregido mueve el doble del importe; el
 * retiro del banco anotado como ingreso se invierte y suma la pata de la
 * caja; una fila sin cuenta que parece de efectivo se prueba en Caja Chica.
 * Se prueban todas las combinaciones, por moneda, y se acepta solo la que
 * deja una cuenta a menos de EXPLAIN_TOL. Una cuenta que no cierra así NO
 * recibe explicación: con suficientes candidatos cualquier número se
 * aproxima, y proponer una combinación que "casi" da sería inventar.
 */
const EXPLAIN_TOL = 1.0;

function explainDifferences(accounts, rows, signFlagged, findings) {
  const out = [];
  for (const moneda of ["UYU", "USD"]) {
    const accs = accounts.filter((a) => a.moneda === moneda && a.diferencia);
    if (!accs.length) continue;
    const caja = accounts.find((a) => a.moneda === moneda && /caja/i.test(a.cuenta));
    const cands = [];
    for (const r of signFlagged) {
      if (r.moneda !== moneda || !r.cuenta) continue;
      cands.push({ label: `fila ${r.fila}: pasar ${money(r.ing || r.gas)} de ${r.ing ? "Ingresos a Gastos" : "Gastos a Ingresos"} («${r.desc}»)`, effects: { [r.cuenta]: round2(-2 * (r.ing - r.gas)) } });
    }
    for (const it of findings.get("TRASPASO_SIN_PAREJA") ?? []) {
      const r = rows.find((x) => x.fila === it.fila && x.hoja === it.hoja);
      if (!r || r.moneda !== moneda || !caja || r.cuenta === caja.cuenta) continue;
      if (/retiro/i.test(r.desc) && r.ing > 0) {
        cands.push({ label: `fila ${r.fila}: el retiro de ${money(r.ing)} es una salida de ${r.cuenta} y una entrada en ${caja.cuenta}`, effects: { [r.cuenta]: round2(-2 * r.ing), [caja.cuenta]: r.ing } });
      }
    }
    for (const r of rows.filter((x) => !x.cuenta && x.moneda === moneda)) {
      if (caja) cands.push({ label: `fila ${r.fila}: la fila sin cuenta iba en ${caja.cuenta} (${money(r.ing - r.gas)}, «${r.desc}»)`, effects: { [caja.cuenta]: round2(r.ing - r.gas) } });
    }
    if (cands.length > 18) cands.length = 18; // 2^18 combinaciones como techo

    const residual = (mask) => {
      const res = Object.fromEntries(accs.map((a) => [a.cuenta, a.diferencia]));
      cands.forEach((c, i) => {
        if (!(mask & (1 << i))) return;
        for (const [cta, eff] of Object.entries(c.effects)) if (cta in res) res[cta] = round2(res[cta] - eff);
      });
      return res;
    };
    // Mejor combinación: la que cierra más cuentas; a igualdad, la que usa
    // menos correcciones y deja menos residuo en las que cierra.
    let best = { mask: 0, closed: -1, size: Infinity, resid: Infinity };
    for (let mask = 0; mask < 1 << cands.length; mask++) {
      const res = residual(mask);
      const closedAccs = accs.filter((a) => Math.abs(res[a.cuenta]) <= EXPLAIN_TOL);
      const closed = closedAccs.length;
      // Solo cuentan las correcciones que tocan una cuenta que cierra.
      const useful = cands.filter((c, i) => mask & (1 << i) && Object.keys(c.effects).some((k) => closedAccs.some((a) => a.cuenta === k)));
      if (useful.length !== cands.filter((_, i) => mask & (1 << i)).length) continue;
      const resid = closedAccs.reduce((s, a) => s + Math.abs(res[a.cuenta]), 0);
      if (closed > best.closed || (closed === best.closed && (useful.length < best.size || (useful.length === best.size && resid < best.resid)))) {
        best = { mask, closed, size: useful.length, resid };
      }
    }
    const res = residual(best.mask);
    for (const a of accs) {
      const used = cands.filter((c, i) => best.mask & (1 << i) && a.cuenta in c.effects);
      const closes = Math.abs(res[a.cuenta]) <= EXPLAIN_TOL;
      out.push({
        cuenta: a.cuenta, moneda, diferencia: a.diferencia,
        explicada: closes, residuo: res[a.cuenta],
        correcciones: used.map((c) => ({ label: c.label, efecto: c.effects[a.cuenta] })),
      });
    }
  }
  return out;
}

/** Mismo largo y un solo dígito distinto, o dos dígitos vecinos invertidos. */
function oneTypoAway(a, b) {
  const x = String(a), y = String(b);
  if (x.length !== y.length || x === y) return false;
  const diff = [...x].map((c, i) => (c !== y[i] ? i : -1)).filter((i) => i >= 0);
  if (diff.length === 1) return true;
  return diff.length === 2 && diff[1] === diff[0] + 1 && x[diff[0]] === y[diff[1]] && x[diff[1]] === y[diff[0]];
}

function longestNonDecreasing(arr) {
  const n = arr.length, tails = [], tailIdx = [], prev = new Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    let lo = 0, hi = tails.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (tails[mid] <= arr[i]) lo = mid + 1; else hi = mid; }
    tails[lo] = arr[i]; tailIdx[lo] = i;
    prev[i] = lo > 0 ? tailIdx[lo - 1] : -1;
  }
  const keep = new Set();
  let k = tailIdx[tails.length - 1];
  while (k != null && k >= 0) { keep.add(k); k = prev[k]; }
  return keep;
}

// ═══ Continuidad entre ejercicios ═══════════════════════════════════

function continuity(years) {
  const out = [];
  for (let i = 1; i < years.length; i++) {
    const a = years[i - 1], b = years[i];
    const keys = new Set([...a.accounts, ...b.accounts].map((x) => `${x.cuenta}|${x.moneda}`));
    const rows = [];
    for (const k of keys) {
      const [cuenta, moneda] = k.split("|");
      const x = a.accounts.find((y) => y.cuenta === cuenta && y.moneda === moneda);
      const y = b.accounts.find((z) => z.cuenta === cuenta && z.moneda === moneda);
      const cierre = x?.cierre ?? null, inicio = y?.inicio ?? null;
      if (cierre == null && inicio == null) continue;
      rows.push({ cuenta, moneda, cierre, inicio, diferencia: cierre == null || inicio == null ? null : round2(inicio - cierre) });
    }
    out.push({ de: a.ejercicio, a: b.ejercicio, rows });
  }
  return out;
}

// ═══ HTML ═══════════════════════════════════════════════════════════

const SEV_LABEL = { alta: "Alta", media: "Media", baja: "Baja" };
const APP_LABEL = { evita: "La app lo evita", mitiga: "La app lo detecta", no: "La app todavía no" };

function renderYear(y, prev = null) {
  const byCur = (m) => y.accounts.filter((a) => a.moneda === m && (a.n || a.declared));
  const cur = ["UYU", "USD"].filter((m) => byCur(m).length);
  const pend = (f) => f.items.filter((it) => !it.aclarado).length;
  const total = y.findings.reduce((s, f) => s + pend(f), 0);
  const aclarados = y.findings.reduce((s, f) => s + f.items.length - pend(f), 0);
  const sevCount = (s) => y.findings.filter((f) => f.sev === s).reduce((n, f) => n + pend(f), 0);

  const saldoTable = (m) => {
    const t = y.totals[m] ?? {};
    const ex = y.totalesExcel[m];
    const rows = byCur(m).map((a) => `
      <tr>
        <td><b>${esc(a.cuenta)}</b>${a.banco ? `<div class="sub">${esc(a.banco)}</div>` : ""}</td>
        <td class="n">${money(a.inicio)}</td>
        <td class="n pos">${a.ing ? money(a.ing) : "—"}</td>
        <td class="n neg">${a.gas ? money(-a.gas) : "—"}</td>
        <td class="n">${money(a.calculado)}</td>
        <td class="n"><b>${money(a.cierre)}</b></td>
        <td class="n ${a.diferencia ? "bad" : a.diferencia === 0 ? "ok" : ""}">${a.diferencia == null ? "—" : a.diferencia === 0 ? "✓" : money(a.diferencia)}</td>
      </tr>`).join("");
    const diffT = round2(t.cierre - t.calculado);
    return `
    <h3>${m === "UYU" ? "Pesos (UYU)" : "Dólares (USD)"}</h3>
    <div class="wide"><table class="saldos">
      <thead><tr><th>Cuenta</th><th class="n">Saldo al inicio<div class="sub">declarado</div></th><th class="n">Ingresos</th><th class="n">Gastos</th>
      <th class="n">Cierre calculado<div class="sub">inicio + movimientos</div></th><th class="n">Saldo al cierre<div class="sub">declarado</div></th><th class="n">Diferencia</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td>Total ${m}</td><td class="n">${money(t.inicio)}</td><td class="n pos">${money(t.ing)}</td><td class="n neg">${money(-t.gas)}</td>
      <td class="n">${money(t.calculado)}</td><td class="n">${money(t.cierre)}</td><td class="n ${diffT ? "bad" : "ok"}">${diffT ? money(diffT) : "✓"}</td></tr></tfoot>
    </table></div>
    ${ex && (round2(ex.inicio ?? 0) !== t.inicio || round2(ex.cierre ?? 0) !== t.cierre) ? `<p class="warn">La fila «TOTAL EN ${m === "USD" ? "DÓLARES" : "PESOS"}» de la hoja SALDOS dice <b>${money(ex.inicio)}</b> al inicio y <b>${money(ex.cierre)}</b> al cierre: le faltan saldos que están escritos como texto (ver hallazgos).</p>` : ""}
    ${y.sinCuenta[m] ? `<p class="warn">Además hay ${money(y.sinCuenta[m])} ${m} en filas <b>sin cuenta</b>, que no entran en ningún saldo.</p>` : ""}`;
  };

  const next = y.accounts.filter((a) => a.cierre != null && (a.cierre !== 0 || a.n));
  const finding = (f) => `
    <details class="f sev-${f.sev}">
      <summary>
        <span class="badge sev-${f.sev}">${SEV_LABEL[f.sev]}</span>
        <span class="ft">${esc(f.title)}</span>
        <span class="count">${pend(f)}${pend(f) < f.items.length ? `<span class="sub"> + ${f.items.length - pend(f)} aclarado${f.items.length - pend(f) === 1 ? "" : "s"}</span>` : ""}</span>
      </summary>
      <div class="fb">
        <p class="app app-${f.app[0]}"><b>${APP_LABEL[f.app[0]]}.</b> ${esc(f.app[1])}</p>
        <ul>${f.items.map((it) => `<li${it.aclarado ? ` class="acl"` : ""}>${it.fila ? `<span class="row">fila ${it.fila}</span>` : ""}${esc(it.text)}${it.aclarado ? `<div class="acl-t"><b>Aclarado por Tesorería:</b> ${esc(it.aclarado)}</div>` : ""}</li>`).join("")}</ul>
      </div>
    </details>`;
  const groups = [...new Set(y.findings.map((f) => f.grupo))];

  const rc = y.recibos.composition;
  return `
  <section class="year" id="y${esc(y.ejercicio ?? "")}">
    <header class="yh">
      <div class="eyebrow">Ejercicio</div>
      <h2>${esc(y.ejercicio ?? "sin año declarado")} E.B.</h2>
      <p class="meta">${fdate(y.desde)} al ${fdate(y.hasta)} · ${y.movimientos} movimientos · ${esc(y.file)}</p>
    </header>

    <div class="kpis">
      <div class="kpi"><div class="k">${total}</div><div class="l">hallazgos pendientes${aclarados ? `<br>+ ${aclarados} aclarado${aclarados === 1 ? "" : "s"}` : ""}</div></div>
      <div class="kpi sev-alta"><div class="k">${sevCount("alta")}</div><div class="l">graves</div></div>
      <div class="kpi sev-media"><div class="k">${sevCount("media")}</div><div class="l">medios</div></div>
      <div class="kpi sev-baja"><div class="k">${sevCount("baja")}</div><div class="l">leves</div></div>
    </div>

    ${renderDelta(y, prev)}
    <h2 class="sec">1 · Saldos del ejercicio</h2>
    <p class="lead">Cada fila es una prueba cerrada: el saldo al inicio que declaró Tesorería, más lo que suman los movimientos de la planilla, tiene que dar el saldo al cierre que declaró. Pesos y dólares van por separado y no se suman entre sí.</p>
    ${cur.map(saldoTable).join("")}
    ${y.conciliacion.length ? `
    <h3>Cuentas conciliadas con el banco</h3>
    ${y.conciliacion.map((c) => `<div class="expl ${round2(c.aExplicar - c.total) === 0 ? "expl-ok" : "expl-open"}"><div class="eh"><b>${esc(c.cuenta)} ${c.moneda}</b> · diferencia ${money(c.aExplicar)} → ${round2(c.aExplicar - c.total) === 0 ? `<span class="okt">el extracto la explica entera</span>` : `<span class="badt">quedan ${money(round2(c.aExplicar - c.total))}</span>`} · <a href="#conc-${esc(c.cuenta.replace(/\s/g, ""))}">ver la conciliación</a></div></div>`).join("")}` : ""}
    ${y.explanations.length ? `
    <h3>¿Qué explica las diferencias? (cuentas sin extracto)</h3>
    <p class="lead">Para cada cuenta que no cuadra se probaron todas las combinaciones de los errores encontrados que mueven plata. Solo se da una explicación si deja la cuenta a menos de ${money(EXPLAIN_TOL)}; si no, la diferencia queda abierta: con suficientes candidatos cualquier número se aproxima, y proponer algo que “casi da” sería inventar. Nada de esto está corregido en la planilla: es la hipótesis más probable, para confirmar con el extracto.</p>
    ${y.explanations.map((e) => `
      <div class="expl ${e.explicada ? "expl-ok" : "expl-open"}">
        <div class="eh"><b>${esc(e.cuenta)} ${e.moneda}</b> · diferencia ${money(e.diferencia)} →
          ${e.explicada ? `<span class="okt">${Math.abs(e.residuo) < 0.005 ? "cierra al centavo" : `queda ${money(e.residuo)}`}</span>` : `<span class="badt">queda ${money(e.residuo)} sin explicar</span>`}</div>
        ${e.correcciones.length ? `<ul>${e.correcciones.map((c) => `<li>${esc(c.label)} <span class="sub">(${money(c.efecto)} en el cálculo)</span></li>`).join("")}</ul>` : ""}
        ${!e.explicada ? `<p class="sub">Ninguna combinación de los errores encontrados cierra esta cuenta. Hace falta el extracto del banco de la fecha de cierre para encontrar el resto.</p>` : ""}
      </div>`).join("")}` : ""}

    <div class="carry">
      <h3>Para el ejercicio siguiente</h3>
      <p>El ${y.ejercicio ? Number(y.ejercicio) + 1 : "próximo"} tiene que abrir con estos saldos. Si su hoja SALDOS dice otra cosa, el informe del año siguiente lo marca.</p>
      <div class="wide"><table>
        <thead><tr><th>Cuenta</th><th>Moneda</th><th class="n">Saldo al ${fdate(y.hasta)}</th></tr></thead>
        <tbody>${next.map((a) => `<tr><td>${esc(a.cuenta)}</td><td>${a.moneda}</td><td class="n"><b>${money(a.cierre)}</b></td></tr>`).join("")}</tbody>
      </table></div>
    </div>

    <h2 class="sec">2 · Hallazgos</h2>
    <p class="lead">Agrupados por clase, de lo más grave a lo más leve. Cada clase dice qué hace hoy la app con ese problema: lo que ya evita dejó de ser una preocupación; lo que todavía no, es trabajo pendiente.</p>
    ${groups.map((g) => `<h3>${esc(g)}</h3>${y.findings.filter((f) => f.grupo === g).map(finding).join("")}`).join("")}

    <h2 class="sec">3 · La columna «N° Recibo»</h2>
    <p class="lead">Una sola columna para cuatro cosas distintas. La serie de recibos del año va del <b>${y.recibos.serie.from ?? "—"}</b> al <b>${y.recibos.serie.to ?? "—"}</b>.</p>
    <div class="wide"><table class="compact">
      <tbody>
        <tr><td>Recibo de aporte (número)</td><td class="n">${rc.recibo ?? 0}</td></tr>
        <tr><td>Vale de pago en pesos (P…/año)</td><td class="n">${rc.valeP ?? 0}</td></tr>
        <tr><td>Vale de pago en dólares (D…/año)</td><td class="n">${rc.valeD ?? 0}</td></tr>
        <tr><td>«Débito» (medio de pago, no un número)</td><td class="n">${rc.debito ?? 0}</td></tr>
        <tr><td>Otra cosa</td><td class="n">${rc.otro ?? 0}</td></tr>
        <tr><td>Vacía</td><td class="n">${rc.vacio ?? 0}</td></tr>
      </tbody>
    </table></div>
    <p class="note">Traspasos entre cuentas reconocidos: ${y.traspasos.pares} con sus dos patas, ${y.traspasos.sueltos} con una sola.</p>
    ${y.conciliacion.length ? renderConciliacion(y) : ""}
  </section>`;
}

function renderConciliacion(y) {
  const pl = (p) => `<span class="row">fila ${p.fila}</span>${fdate(p.fecha)} · <b>${money(p.amt)}</b> ${esc(p.desc)}`;
  const bl = (b) => `${fdate(b.fecha)} · <b>${money(b.amt)}</b> ${esc(b.desc)}${b.asunto ? ` <span class="sub">${esc(b.asunto)}</span>` : ""}`;
  const pairList = (list) => `<table class="pairs"><thead><tr><th>Planilla</th><th>Banco</th></tr></thead><tbody>${list.map((x) =>
    `<tr><td>${x.plan.map(pl).join("<br>")}</td><td>${x.bank.map(bl).join("<br>")}</td></tr>`).join("")}</tbody></table>`;
  const block = (title, body, n, open = false) => n ? `<details class="f"${open ? " open" : ""}><summary><span class="ft">${title}</span><span class="count">${n}</span></summary><div class="fb wide">${body}</div></details>` : "";
  return `
    <h2 class="sec">4 · Conciliación con el banco</h2>
    <p class="lead">Cada movimiento de la planilla contra el extracto del BROU: mismo importe con signo, fecha a ±3 días, el más cercano, uno a uno — el criterio de la conciliación de la app —, y después las pasadas que una planilla vieja necesita: el signo cambiado, los centavos, la fecha equivocada y un asiento por varios depósitos. Lo que el banco dice manda sobre las sospechas de la sección 2.</p>
    ${y.conciliacion.map((c) => {
      const byKind = (k) => c.pairs.filter((x) => x.kind === k);
      const resto = round2(c.aExplicar - c.total);
      const row = (label, v, hint) => `<tr><td>${label}${hint ? `<div class="sub">${hint}</div>` : ""}</td><td class="n">${v ? money(v) : "—"}</td></tr>`;
      return `
      <div class="conc" id="conc-${esc(c.cuenta.replace(/\s/g, ""))}">
        <h3>${esc(c.cuenta)} · ${c.moneda}${c.numero ? ` · BROU ${esc(c.numero)}` : ""}</h3>
        <p class="note">${c.archivos.map(esc).join(" · ")} — del ${fdate(c.desde)} al ${fdate(c.hasta)}</p>
        <div class="wide"><table class="compact">
          <thead><tr><th></th><th class="n">Banco</th><th class="n">Declarado en SALDOS</th></tr></thead>
          <tbody>
            <tr><td>Saldo al ${fdate(c.desde)}</td><td class="n">${money(c.bankIni)}</td><td class="n ${round2(c.bankIni) === round2(c.declIni) ? "ok" : "bad"}">${money(c.declIni)}${round2(c.bankIni) === round2(c.declIni) ? " ✓" : ""}</td></tr>
            <tr><td>Saldo al ${fdate(c.hasta)}</td><td class="n">${money(c.bankFin)}</td><td class="n ${round2(c.bankFin) === round2(c.declFin) ? "ok" : "bad"}">${money(c.declFin)}${round2(c.bankFin) === round2(c.declFin) ? " ✓" : ""}</td></tr>
          </tbody></table></div>
        <p>El banco tiene <b>${c.counts.banco}</b> movimientos y la planilla <b>${c.counts.planilla}</b>. Coinciden exactos <b>${c.counts.exacto}</b>${c.counts.suma ? `, <b>${c.counts.suma}</b> por suma de dos` : ""}${c.counts.grupo ? `, <b>${c.counts.grupo}</b> asiento por varios depósitos` : ""}.</p>
        <div class="wide"><table class="compact bridge">
          <thead><tr><th>De dónde sale la diferencia</th><th class="n">Efecto en el saldo</th></tr></thead>
          <tbody>
            ${row("Errores de signo en la planilla", c.efectos.signo, `${byKind("signo").length} movimientos`)}
            ${row("Movimientos del banco que faltan en la planilla", c.efectos.soloBanco, `${c.soloBanco.length} movimientos`)}
            ${row("Movimientos de la planilla que no están en el banco", c.efectos.soloPlanilla, `${c.soloPlanilla.length} movimientos`)}
            ${row("Importes con centavos de diferencia", c.efectos.importe, `${byKind("importe").length} movimientos`)}
            ${row("Fechas distintas", c.efectos.fecha, "no cambian el saldo del año")}
          </tbody>
          <tfoot>
            <tr><td>Explicado por el extracto</td><td class="n">${money(c.total)}</td></tr>
            <tr><td>Diferencia que había (banco − planilla)</td><td class="n">${money(c.aExplicar)}</td></tr>
            <tr><td>Sin explicar</td><td class="n ${resto ? "bad" : "ok"}">${resto ? money(resto) : "✓ cuadra al centavo"}</td></tr>
          </tfoot>
        </table></div>
        ${block("El banco confirma un error de signo", pairList(byKind("signo")), byKind("signo").length, true)}
        ${block("Están en el banco y no en la planilla", `<ul>${c.soloBanco.map((b) => `<li>${bl(b)}</li>`).join("")}</ul>`, c.soloBanco.length, true)}
        ${block("Están en la planilla y no en el banco", `<ul>${c.soloPlanilla.map((p) => `<li>${pl(p)}</li>`).join("")}</ul>`, c.soloPlanilla.length, true)}
        ${block("Centavos de diferencia", pairList(byKind("importe")), byKind("importe").length)}
        ${block("Fecha distinta", pairList(byKind("fecha")), byKind("fecha").length)}
        ${block("Un asiento por varios movimientos del banco", pairList(byKind("grupo")), byKind("grupo").length)}
        ${block("Suma de dos", pairList(byKind("suma")), byKind("suma").length)}
        ${block("Sospechas de signo que el banco descarta", `<ul>${c.descartadas.map((d) => `<li>${esc(d)}</li>`).join("")}</ul><p class="sub">La regla las marcó por la redacción; el extracto muestra que el signo de la planilla era el correcto.</p>`, c.descartadas.length, true)}
      </div>`;
    }).join("")}`;
}

/**
 * Qué cambió respecto del informe anterior (su JSON): hallazgos por clase
 * antes y ahora, y las pruebas de saldo por cuenta. Es lo que responde "¿las
 * correcciones sirvieron?" sin tener que leer los dos informes enteros.
 */
function renderDelta(y, p) {
  if (!p) return "";
  const codes = [...new Set([...p.findings.map((f) => f.code), ...y.findings.map((f) => f.code)])];
  const cnt = (yy, c) => yy.findings.find((f) => f.code === c)?.items.filter((it) => !it.aclarado).length ?? 0;
  const rows = codes.map((c) => ({ c, sev: (y.findings.find((f) => f.code === c) ?? p.findings.find((f) => f.code === c)).sev, title: CLASSES[c]?.title ?? c, a: cnt(p, c), b: cnt(y, c) }))
    .sort((x, z) => SEV_ORDER[x.sev] - SEV_ORDER[z.sev] || (z.a - z.b) - (x.a - x.b));
  const tot = (yy) => yy.findings.reduce((s, f) => s + f.items.filter((it) => !it.aclarado).length, 0);
  const sev = (yy, s) => yy.findings.filter((f) => f.sev === s).reduce((n, f) => n + f.items.filter((it) => !it.aclarado).length, 0);
  const accs = [...new Set([...p.accounts, ...y.accounts].filter((a) => a.n || a.declared).map((a) => `${a.cuenta}|${a.moneda}`))];
  const accRows = accs.map((k) => {
    const [cuenta, moneda] = k.split("|");
    const A = p.accounts.find((a) => a.cuenta === cuenta && a.moneda === moneda), B = y.accounts.find((a) => a.cuenta === cuenta && a.moneda === moneda);
    return { cuenta, moneda, a: A?.diferencia ?? null, b: B?.diferencia ?? null };
  }).filter((r) => r.a != null || r.b != null).sort((x, z) => x.moneda.localeCompare(z.moneda) || x.cuenta.localeCompare(z.cuenta, "es", { numeric: true }));
  const d = (v) => (v == null ? "—" : v === 0 ? "✓" : money(v));
  const cls = (v) => (v == null ? "" : v === 0 ? "ok" : "bad");
  const conc = y.conciliacion.map((c) => {
    const P = p.conciliacion.find((x) => x.cuenta === c.cuenta && x.moneda === c.moneda);
    const restoP = P ? round2(P.aExplicar - P.total) : null, restoY = round2(c.aExplicar - c.total);
    return `<tr><td>${esc(c.cuenta)} ${c.moneda}</td><td class="n">${P ? `${P.counts.exacto} de ${P.counts.banco}` : "—"}</td><td class="n">${c.counts.exacto} de ${c.counts.banco}</td><td class="n ${cls(restoP)}">${d(restoP)}</td><td class="n ${cls(restoY)}">${d(restoY)}</td></tr>`;
  }).join("");
  return `
    <h2 class="sec">0 · Qué cambió desde el informe anterior</h2>
    <p class="lead">El informe anterior se hizo sobre <b>${esc(p.file)}</b> (${p.movimientos} movimientos, ${tot(p)} hallazgos); este sobre <b>${esc(y.file)}</b> (${y.movimientos} movimientos, ${tot(y)} hallazgos). Graves: ${sev(p, "alta")} → <b>${sev(y, "alta")}</b> · medios: ${sev(p, "media")} → <b>${sev(y, "media")}</b> · leves: ${sev(p, "baja")} → <b>${sev(y, "baja")}</b>.</p>
    <h3>Pruebas de saldo por cuenta</h3>
    <div class="wide"><table class="compact" style="max-width:620px"><thead><tr><th>Cuenta</th><th class="n">Diferencia antes</th><th class="n">Diferencia ahora</th></tr></thead>
    <tbody>${accRows.map((r) => `<tr><td>${esc(r.cuenta)} ${r.moneda}</td><td class="n ${cls(r.a)}">${d(r.a)}</td><td class="n ${cls(r.b)}">${d(r.b)}</td></tr>`).join("")}</tbody></table></div>
    ${conc ? `<h3>Conciliación con el banco</h3>
    <div class="wide"><table class="compact" style="max-width:720px"><thead><tr><th>Cuenta</th><th class="n">Coincidían exactos</th><th class="n">Coinciden ahora</th><th class="n">Sin explicar antes</th><th class="n">Sin explicar ahora</th></tr></thead><tbody>${conc}</tbody></table></div>` : ""}
    <h3>Hallazgos por clase</h3>
    <div class="wide"><table class="compact" style="max-width:760px"><thead><tr><th></th><th>Clase</th><th class="n">Antes</th><th class="n">Ahora</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><td><span class="badge sev-${r.sev}">${SEV_LABEL[r.sev]}</span></td><td>${esc(r.title)}</td><td class="n">${r.a}</td><td class="n ${r.b < r.a ? "ok" : r.b > r.a ? "bad" : ""}">${r.b}${r.b < r.a ? " ↓" : r.b > r.a ? " ↑" : ""}</td></tr>`).join("")}</tbody></table></div>
    <p class="note">Un hallazgo que sube no es necesariamente un error nuevo: cuando una fila se parte para calzar con el extracto (un retiro en dos partes, un depósito por cada aportante) suben las filas idénticas y los gastos sin respaldo anotado. Cada clase se explica en la sección 2.</p>`;
}

function renderHtml(years, chain, generatedAt, extraNotes, prev = null) {
  const title = years.length === 1 ? `Auditoría ${years[0].ejercicio} E.B.` : `Auditoría ${years[0].ejercicio}–${years[years.length - 1].ejercicio} E.B.`;
  const chainHtml = !chain.length
    ? `<div class="carry"><h3>Continuidad entre ejercicios</h3><p>Con un solo ejercicio no hay con qué comparar. Cuando se audite el ${Number(years[0].ejercicio) + 1} junto con este, acá aparece su saldo de apertura contra el cierre del ${years[0].ejercicio}, cuenta por cuenta.</p></div>`
    : chain.map((c) => `
      <div class="carry"><h3>Del ${esc(c.de)} al ${esc(c.a)}</h3>
      <div class="wide"><table><thead><tr><th>Cuenta</th><th>Moneda</th><th class="n">Cierre ${esc(c.de)}</th><th class="n">Apertura ${esc(c.a)}</th><th class="n">Diferencia</th></tr></thead>
      <tbody>${c.rows.map((r) => `<tr><td>${esc(r.cuenta)}</td><td>${r.moneda}</td><td class="n">${money(r.cierre)}</td><td class="n">${money(r.inicio)}</td><td class="n ${r.diferencia ? "bad" : r.diferencia === 0 ? "ok" : ""}">${r.diferencia == null ? "falta un dato" : r.diferencia === 0 ? "✓" : money(r.diferencia)}</td></tr>`).join("")}</tbody></table></div></div>`).join("");

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
:root{--bg:#FAF7F2;--card:#FFFFFF;--ink:#2A2833;--mute:#6B6873;--line:#E6E0D6;--gold:#A8812F;--pine:#1F3A2C;
--alta:#B3261E;--alta-bg:#FBECEA;--media:#9A6500;--media-bg:#FDF3E1;--baja:#5B6470;--baja-bg:#EEF0F3;--ok:#3F6B35;--ok-bg:#EAF2E6}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#17161B;--card:#211F26;--ink:#ECE8E1;--mute:#A7A2AB;--line:#35323C;--gold:#D4AF5F;
--alta:#F2877F;--alta-bg:#3A1F1E;--media:#E7B55B;--media-bg:#352A17;--baja:#A9B1BC;--baja-bg:#262A30;--ok:#9CCB8E;--ok-bg:#1F2E1C}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:1040px;margin:0 auto;padding:32px 16px 64px}
.top{border-bottom:2px solid var(--gold);padding-bottom:16px;margin-bottom:24px}
.top h1{margin:0;font:600 30px/1.15 Georgia,"Cormorant Garamond",serif}.top p{margin:6px 0 0;color:var(--mute)}
.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:11px;color:var(--gold);font-weight:700}
.year{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:24px;margin:0 0 28px}
.yh h2{margin:2px 0 0;font:600 26px Georgia,serif}.meta{margin:4px 0 0;color:var(--mute);font-size:13px}
h2.sec{font:600 19px Georgia,serif;margin:32px 0 6px;padding-top:18px;border-top:1px solid var(--line)}
h3{font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:var(--mute);margin:22px 0 8px}
.lead{color:var(--mute);margin:0 0 12px;max-width:760px}
.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:20px 0 4px}
.kpi{border:1px solid var(--line);border-radius:10px;padding:12px 14px}.kpi .k{font:600 26px Georgia,serif}.kpi .l{color:var(--mute);font-size:12px}
.kpi.sev-alta .k{color:var(--alta)}.kpi.sev-media .k{color:var(--media)}.kpi.sev-baja .k{color:var(--baja)}
.wide{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{width:100%;border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums}
th,td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{font-size:12px;color:var(--mute);font-weight:600}.n{text-align:right;white-space:nowrap}
.sub{font-size:11px;color:var(--mute);font-weight:400}
tfoot td{font-weight:700;border-top:2px solid var(--ink);border-bottom:0}
.pos{color:var(--ok)}.neg{color:var(--alta)}
td.bad{color:var(--alta);background:var(--alta-bg);font-weight:700}td.ok{color:var(--ok);font-weight:700}
table.compact{max-width:480px}
.warn{background:var(--media-bg);color:var(--media);border-radius:8px;padding:10px 12px;font-size:14px}
.note{color:var(--mute);font-size:13px}
.carry{border:1px dashed var(--gold);border-radius:10px;padding:14px 16px;margin:20px 0 0}
.carry h3{margin-top:0;color:var(--gold)}.carry p{margin:0 0 10px;color:var(--mute)}
details.f{border:1px solid var(--line);border-left:4px solid var(--baja);border-radius:8px;margin:8px 0;background:var(--card)}
details.f.sev-alta{border-left-color:var(--alta)}details.f.sev-media{border-left-color:var(--media)}
summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:10px;padding:10px 12px}
summary::-webkit-details-marker{display:none}.ft{flex:1;font-weight:600}
.count{font:600 15px Georgia,serif;min-width:2ch;text-align:right}
.badge{font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;text-transform:uppercase;letter-spacing:.04em}
.badge.sev-alta{background:var(--alta-bg);color:var(--alta)}.badge.sev-media{background:var(--media-bg);color:var(--media)}.badge.sev-baja{background:var(--baja-bg);color:var(--baja)}
.fb{padding:0 14px 12px}.fb ul{margin:8px 0 0;padding-left:18px}.fb li{margin:3px 0;font-size:13.5px}
.row{display:inline-block;font-size:11px;font-weight:700;color:var(--mute);background:var(--bg);border:1px solid var(--line);border-radius:4px;padding:0 5px;margin-right:6px}
.app{margin:4px 0 0;font-size:13px;padding:8px 10px;border-radius:6px}
li.acl{color:var(--mute)}.acl-t{margin:2px 0 4px;color:var(--ok);font-size:13px}
.app-evita{background:var(--ok-bg);color:var(--ok)}.app-mitiga{background:var(--media-bg);color:var(--media)}.app-no{background:var(--alta-bg);color:var(--alta)}
.expl{border:1px solid var(--line);border-radius:8px;padding:10px 14px;margin:8px 0}
.expl-ok{border-left:4px solid var(--ok)}.expl-open{border-left:4px solid var(--alta)}
.expl ul{margin:6px 0 0;padding-left:18px;font-size:13.5px}.okt{color:var(--ok);font-weight:700}.badt{color:var(--alta);font-weight:700}
.conc{border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:14px 0}
.conc h3{margin-top:0;color:var(--ink);text-transform:none;letter-spacing:0;font-size:16px}
table.bridge{max-width:620px}table.pairs td{width:50%;font-size:13px}
a{color:var(--gold)}
.notes{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 22px}.notes li{margin:6px 0}
@media (max-width:640px){.kpis{grid-template-columns:repeat(2,1fr)}.year{padding:18px 14px}}
@media print{body{background:#fff}main{max-width:none;padding:0}.year{border:0;padding:0;page-break-after:always}details.f{break-inside:avoid}details.f .fb{display:block}}
</style></head><body><main>
<div class="top">
  <div class="eyebrow">Tesorería Nacional · Auditoría interna</div>
  <h1>${esc(title)}</h1>
  <p>Generado el ${fdate(generatedAt.slice(0, 10))} desde las planillas originales. Documento interno: contiene nombres de personas.</p>
</div>
${extraNotes.length ? `<div class="notes"><div class="eyebrow">Antes de leer</div><ul>${extraNotes.map((n) => `<li>${n}</li>`).join("")}</ul></div>` : ""}
${years.map((y) => renderYear(y, prev?.years?.find((p) => String(p.ejercicio) === String(y.ejercicio)) ?? null)).join("")}
<section class="year"><h2 class="sec" style="border:0;margin-top:0;padding-top:0">Continuidad entre ejercicios</h2>${chainHtml}</section>
</main></body></html>`;
}

// ═══ Principal ══════════════════════════════════════════════════════

function main() {
  const args = process.argv.slice(2);
  let outDir = null, prevPath = null;
  const aclaraciones = [];
  const extraNotes = [];
  const inputs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--out") outDir = args[++i];
    else if (args[i] === "--anterior") prevPath = args[++i];
    else if (args[i] === "--aclarado") { const [key, ...rest] = args[++i].split("|"); aclaraciones.push({ key: key.trim(), text: rest.join("|").trim() }); }
    else if (args[i] === "--nota") extraNotes.push(esc(args[++i]));
    else inputs.push(args[i]);
  }
  if (!inputs.length) {
    console.error("Uso: node scripts/auditar-planillas.mjs <archivo.xlsx | carpeta> [--out <carpeta>] [--nota \"texto\"] [--anterior <informe.json>]");
    process.exit(1);
  }
  // Carpetas recorridas un nivel hacia abajo (una por ejercicio, por ejemplo
  // 178/), sin entrar a la de informes.
  const walk = (p) => {
    if (!fs.statSync(p).isDirectory()) return [p];
    return fs.readdirSync(p).filter((f) => !f.startsWith("~$") && f !== "informes").flatMap((f) => {
      const full = path.join(p, f);
      return fs.statSync(full).isDirectory() ? fs.readdirSync(full).filter((g) => !g.startsWith("~$")).map((g) => path.join(full, g)) : [full];
    });
  };
  const all = inputs.flatMap(walk).filter((f) => /\.xlsx?$/i.test(f));
  const files = [], statements = [];
  for (const f of all) {
    const names = (() => { try { return XLSX.read(fs.readFileSync(f), { type: "buffer", bookSheets: true }).SheetNames; } catch { return []; } })();
    if (names.some((n) => headerKey(n) === "saldos")) { files.push(f); continue; }
    const st = readBrouStatement(f);
    if (st) statements.push(st);
    else console.warn(`· ${path.basename(f)}: no es una planilla con SALDOS ni un extracto que reconozca`);
  }
  if (!files.length) { console.error("No encontré ninguna planilla con hoja SALDOS."); process.exit(1); }

  const years = [];
  for (const f of files) {
    // A cada ejercicio le tocan los extractos que se superponen con su período.
    const probe = readSaldos(XLSX.read(fs.readFileSync(f), { type: "buffer", raw: true }));
    const mine = statements.filter((s) => !probe?.desde || !probe?.hasta || (s.desde <= probe.hasta && s.hasta >= probe.desde));
    const y = auditFile(f, mine, aclaraciones);
    if (!y.hasSaldos) { console.warn(`· ${path.basename(f)}: sin hoja SALDOS, se saltea`); continue; }
    if (!y.sheets.length) { console.warn(`· ${path.basename(f)}: no encontré una hoja de movimientos`); continue; }
    years.push(y);
  }
  if (!years.length) { console.error("Ningún archivo auditable."); process.exit(1); }
  for (const a of aclaraciones) if (!a.used) console.warn(`· --aclarado «${a.key}»: ningún hallazgo contiene ese texto`);
  years.sort((a, b) => Number(a.ejercicio) - Number(b.ejercicio));

  const chain = continuity(years);
  const generatedAt = new Date().toISOString();
  const dir = outDir ?? path.join(path.dirname(files[0]), "informes");
  fs.mkdirSync(dir, { recursive: true });
  const base = years.length === 1 ? `auditoria-${years[0].ejercicio}` : `auditoria-${years[0].ejercicio}-${years[years.length - 1].ejercicio}`;
  const prev = prevPath ? JSON.parse(fs.readFileSync(prevPath, "utf8")) : null;
  fs.writeFileSync(path.join(dir, `${base}.html`), renderHtml(years, chain, generatedAt, extraNotes, prev), "utf8");
  fs.writeFileSync(path.join(dir, `${base}.json`), JSON.stringify({ generatedAt, years, chain }, null, 2), "utf8");

  for (const y of years) {
    const total = y.findings.reduce((s, f) => s + f.items.length, 0);
    const acl = y.findings.reduce((s, f) => s + f.items.filter((it) => it.aclarado).length, 0);
    console.log(`\n${y.ejercicio} E.B. · ${y.movimientos} movimientos · ${total - acl} hallazgos pendientes${acl ? ` + ${acl} aclarados` : ""}`);
    for (const a of y.accounts.filter((x) => x.n || x.declared)) {
      console.log(`  ${`${a.cuenta} ${a.moneda}`.padEnd(22)} inicio ${money(a.inicio).padStart(12)}  neto ${money(a.neto).padStart(12)}  calc ${money(a.calculado).padStart(12)}  decl ${money(a.cierre).padStart(12)}  dif ${a.diferencia == null ? "—" : money(a.diferencia)}`);
    }
    for (const f of y.findings) console.log(`  [${f.sev.padEnd(5)}] ${String(f.items.length).padStart(3)}  ${f.title}`);
  }
  console.log(`\n→ ${path.join(dir, `${base}.html`)}`);
}

main();
