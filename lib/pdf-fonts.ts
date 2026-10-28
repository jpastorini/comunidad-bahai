import "server-only";
import fs from "node:fs";
import path from "node:path";
import {
  BOOKLET_FONT_FILES,
  type BookletFontSources,
} from "@/components/feast/FeastBooklet";

/**
 * Dónde están las TTF de los PDF (Cormorant y Outfit). Viven en
 * public/fonts: en local y en Vercel (gracias a outputFileTracingIncludes
 * de la ruta) están en el filesystem; si no estuvieran, se piden por URL a
 * la propia app, que las sirve como estático.
 *
 * Lo usan el folleto de la Fiesta y la hoja interna de Tesorería. Una ruta
 * nueva que lo use tiene que sumar "./public/fonts/**" a su include en
 * next.config.mjs.
 */
export function pdfFontSources(origin: string): BookletFontSources {
  const dir = path.join(process.cwd(), "public", "fonts");
  const out = {} as BookletFontSources;
  for (const name of BOOKLET_FONT_FILES) {
    const local = path.join(dir, `${name}.ttf`);
    out[name] = fs.existsSync(local) ? local : `${origin}/fonts/${name}.ttf`;
  }
  return out;
}
