import * as XLSX from "xlsx";
import type { CellMatrix } from "./bank-statements";

/**
 * El único lugar que importa SheetJS. Convierte el archivo que exporta la
 * plataforma (xlsx, xls viejo del BROU o csv) en la matriz de celdas que
 * entienden los parsers de `lib/bank-statements.ts`.
 *
 * Server-only: SheetJS pesa y el archivo lo lee el server action. Se pide
 * `raw: true` para que los números lleguen como números y las fechas del
 * BROU como su serial de Excel, que `cellDate()` sabe convertir; el texto
 * formateado ("1,600.00", "9/18/26") depende del locale de quien exportó
 * y es justamente lo que no queremos interpretar.
 */
export function readStatementRows(buffer: Buffer): CellMatrix {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false, cellNF: false });
  // La hoja con más filas: el BROU exporta una sola, pero un xlsx armado a
  // mano puede traer una hoja vacía adelante.
  let best: CellMatrix = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<CellMatrix[number]>(ws, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: true,
    });
    if (rows.length > best.length) best = rows;
  }
  return best;
}
