import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Si están cargados el logo y la firma del recibo (public/recibo/, ver
 * scripts/extract-recibo-assets.mjs). Son opcionales: si faltan, el
 * recibo se emite igual, sin esas imágenes.
 */
export function receiptAssets(): { hasLogo: boolean; hasSignature: boolean } {
  const publicDir = path.join(process.cwd(), "public", "recibo");
  return {
    hasLogo: existsSync(path.join(publicDir, "logo.png")),
    hasSignature: existsSync(path.join(publicDir, "firma.png")),
  };
}
