// Extrae el logo y la firma del generador de recibos que vivía en Apps
// Script y los deja como PNG en public/recibo/.
//
//   node scripts/extract-recibo-assets.mjs <archivo.gs>
//
// El script original guardaba las dos imágenes como data URLs en las
// constantes LOGO_BASE64 y FIRMA_BASE64. Acá se recuperan y se escriben
// como archivos, para no cargar 40 KB de base64 en el bundle de la app.
//
// Si el archivo trae solo una de las dos, escribe esa y avisa: el recibo
// se emite igual sin la imagen que falte.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const source = process.argv[2];
if (!source) {
  console.error("Uso: node scripts/extract-recibo-assets.mjs <archivo.gs>");
  process.exit(1);
}

if (!existsSync(source)) {
  console.error(`No encontré el archivo: ${source}`);
  process.exit(1);
}

const text = readFileSync(source, "utf8");
const outDir = path.join(process.cwd(), "public", "recibo");
mkdirSync(outDir, { recursive: true });

/** Busca la data URL asignada a una constante concreta. */
function findByName(name) {
  const re = new RegExp(
    `${name}\\s*=\\s*["'](data:image/(png|jpeg|jpg);base64,[A-Za-z0-9+/=\\s]*)["']`
  );
  const m = text.match(re);
  return m ? m[1] : null;
}

/** Todas las data URLs del archivo, por si las constantes se renombraron. */
function findAll() {
  return [...text.matchAll(/data:image\/(?:png|jpeg|jpg);base64,[A-Za-z0-9+/=]+/g)]
    .map((m) => m[0]);
}

function write(dataUrl, filename) {
  const base64 = dataUrl.split(",")[1].replace(/\s/g, "");
  if (!base64) return false;
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length < 100) return false; // constante vacía o rota
  const dest = path.join(outDir, filename);
  writeFileSync(dest, bytes);
  console.log(`✓ ${filename}  (${(bytes.length / 1024).toFixed(1)} KB)`);
  return true;
}

let logo = findByName("LOGO_BASE64");
let firma = findByName("FIRMA_BASE64");

if (!logo || !firma) {
  const todas = findAll();
  console.error(
    `No encontré las constantes por nombre; uso el orden de aparición (${todas.length} imágenes).`
  );
  logo = logo ?? todas[0] ?? null;
  firma = firma ?? todas[1] ?? null;
}

let escritas = 0;
if (logo && write(logo, "logo.png")) escritas++;
else console.error("· Sin logo: el recibo se emite sin él.");

if (firma && write(firma, "firma.png")) escritas++;
else console.error("· Sin firma: el recibo se emite con la línea vacía.");

if (escritas === 0) {
  console.error("\nNo se pudo extraer ninguna imagen.");
  process.exit(1);
}

console.log(`\nListo: ${escritas} imagen(es) en public/recibo/.`);
