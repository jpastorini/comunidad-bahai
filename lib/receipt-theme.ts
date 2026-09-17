/**
 * Los temas de color del recibo (060).
 *
 * Por qué presets y no un color elegido a mano: la hoja A5 no usa "un"
 * color. Usa tres paradas de degradé en el encabezado, dos fondos de
 * banda con su borde, cuatro tonos de texto sobre el degradé y otros
 * cuatro sobre el papel, más la barra de la cita, los subrayados de los
 * campos y el renglón de la firma. Todo eso tiene que mantener contraste
 * entre sí y al imprimir. Con un hex libre alguien elige un amarillo y el
 * título del encabezado desaparece.
 *
 * Módulo puro y sin dependencias: lo importan la hoja (cliente), el
 * formulario de ajustes (cliente) y las dos páginas (servidor).
 */

export type ReceiptTheme = "terracota" | "azul" | "verde" | "ciruela";

export const RECEIPT_THEMES: ReceiptTheme[] = [
  "terracota",
  "azul",
  "verde",
  "ciruela",
];

export const DEFAULT_RECEIPT_THEME: ReceiptTheme = "terracota";

export type ReceiptPalette = {
  label: string;
  /** Para el selector: de qué se trata el tema en una línea. */
  hint: string;
  /** Encabezado: las tres paradas del degradé. */
  gradFrom: string;
  gradVia: string;
  gradTo: string;
  /** Textos sobre el degradé, de más a menos peso. */
  onDark: string;
  onDarkSoft: string;
  onDarkFaint: string;
  /** El papel. */
  paper: string;
  /** La banda de N.° de recibo y fecha, arriba y abajo. */
  bandBg: string;
  bandBorder: string;
  bandText: string;
  /** El bloque de la cita de la Casa Universal. */
  quoteBg: string;
  quoteBar: string;
  quoteText: string;
  quoteAttr: string;
  /** Los campos (etiqueta, valor, subrayado) y el corte punteado. */
  label_: string;
  value: string;
  rule: string;
  dash: string;
  /** El renglón de la firma. */
  signRule: string;
  signName: string;
  /** El adorno del pie. */
  ornament: string;
};

export const RECEIPT_PALETTES: Record<ReceiptTheme, ReceiptPalette> = {
  // El de siempre, extraído del recibo que emitía el Apps Script sobre la
  // planilla. Queda de default para que ninguna Asamblea vea un cambio
  // que no pidió.
  terracota: {
    label: "Terracota",
    hint: "El de siempre, heredado del recibo de la planilla.",
    gradFrom: "#7a3b1e",
    gradVia: "#a0522d",
    gradTo: "#c47a3a",
    onDark: "#ffecd0",
    onDarkSoft: "#fff8ee",
    onDarkFaint: "#fff0d2",
    paper: "#fffdf7",
    bandBg: "#f5ede0",
    bandBorder: "#e0c9a6",
    bandText: "#8b5e2a",
    quoteBg: "#fdf3e3",
    quoteBar: "#c47a3a",
    quoteText: "#6b3e1e",
    quoteAttr: "#a0682a",
    label_: "#9b6530",
    value: "#3d1f08",
    rule: "#c9a46a",
    dash: "#d4a96a",
    signRule: "#b8884a",
    signName: "#5a3010",
    ornament: "#c47a3a",
  },
  // El que emite hoy la Tesorería Nacional en papel.
  azul: {
    label: "Azul oscuro",
    hint: "El de la Tesorería Nacional.",
    gradFrom: "#14304d",
    gradVia: "#1d4a75",
    gradTo: "#3a6f9e",
    onDark: "#e4effb",
    onDarkSoft: "#f4f9ff",
    onDarkFaint: "#dbeafe",
    paper: "#fdfdfb",
    bandBg: "#eef3f9",
    bandBorder: "#c9d8e8",
    bandText: "#2f5a80",
    quoteBg: "#f2f7fc",
    quoteBar: "#3a6f9e",
    quoteText: "#1b3a5c",
    quoteAttr: "#4a76a0",
    label_: "#446a91",
    value: "#10233a",
    rule: "#a8c0d8",
    dash: "#b6cbe0",
    signRule: "#8aa8c4",
    signName: "#17324f",
    ornament: "#3a6f9e",
  },
  // El verde pino del comunicado nacional (057), acá sobre papel.
  verde: {
    label: "Verde pino",
    hint: "Sobrio, en la línea del comunicado nacional.",
    gradFrom: "#1b3628",
    gradVia: "#2c5741",
    gradTo: "#4d7f62",
    onDark: "#e5f0e7",
    onDarkSoft: "#f3fbf5",
    onDarkFaint: "#dcecdf",
    paper: "#fcfdfa",
    bandBg: "#eef4ee",
    bandBorder: "#cadbcd",
    bandText: "#3a6048",
    quoteBg: "#f2f8f3",
    quoteBar: "#4d7f62",
    quoteText: "#1f3f2d",
    quoteAttr: "#4f7c60",
    label_: "#497a5c",
    value: "#12291c",
    rule: "#aac8b4",
    dash: "#b8d3c0",
    signRule: "#8fb49c",
    signName: "#1b3b28",
    ornament: "#4d7f62",
  },
  ciruela: {
    label: "Ciruela",
    hint: "Cálido y distinto, sin parecerse a ningún estado de la app.",
    gradFrom: "#46203f",
    gradVia: "#6b3260",
    gradTo: "#95538a",
    onDark: "#f7e6f3",
    onDarkSoft: "#fdf4fb",
    onDarkFaint: "#f2dcee",
    paper: "#fffcfe",
    bandBg: "#f6eef4",
    bandBorder: "#ddc6d8",
    bandText: "#6f3f66",
    quoteBg: "#fbf3f9",
    quoteBar: "#95538a",
    quoteText: "#43203c",
    quoteAttr: "#7e5276",
    label_: "#7d4c74",
    value: "#2c1228",
    rule: "#cfaec8",
    dash: "#d8bcd2",
    signRule: "#b992b1",
    signName: "#3e1b38",
    ornament: "#95538a",
  },
};

/** Tolera cualquier cosa que venga de la base o de un formulario. */
export function receiptPalette(theme: string | null | undefined): ReceiptPalette {
  const key = (theme ?? "") as ReceiptTheme;
  return RECEIPT_PALETTES[key] ?? RECEIPT_PALETTES[DEFAULT_RECEIPT_THEME];
}

export function isReceiptTheme(value: string): value is ReceiptTheme {
  return (RECEIPT_THEMES as string[]).includes(value);
}

/** Lo que dice el renglón sobre el nombre, si nadie lo cambió. */
export const DEFAULT_TREASURER_TITLE = "Tesorero/a de la Asamblea";
