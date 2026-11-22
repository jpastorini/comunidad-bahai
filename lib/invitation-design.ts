// El diseño de una invitación hecho por AI: lo que Claude devuelve, ya
// revisado. Puro (lo usan el servidor al generar y la tarjeta al dibujar).
//
// La regla del producto: **la AI dibuja, la app escribe.** Claude elige
// colores, composición e ilustración; el título, la fecha, la hora y el
// lugar los pone la tarjeta con el texto exacto. El dibujo no lleva letras.

import type { InvitationFormat } from "./invitation";

export type InvitationTextPosition = "arriba" | "centro" | "abajo";

export type InvitationDesign = {
  /** Para qué formato se dibujó: el lienzo no es el mismo. */
  format: InvitationFormat;
  backgroundTop: string;
  backgroundBottom: string;
  ink: string;
  soft: string;
  accent: string;
  textPosition: InvitationTextPosition;
  /** Contenido SVG ya saneado (sin la etiqueta <svg> de afuera). */
  svg: string;
};

/** Qué parte del alto ocupa el dibujo cuando el texto va arriba o abajo. */
export const ART_SHARE = 0.42;

// ── Colores ─────────────────────────────────────────────────────────

const HEX = /^#[0-9a-fA-F]{6}$/;

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** El peor contraste de un color contra las dos puntas del fondo. */
function worst(color: string, top: string, bottom: string): number {
  return Math.min(contrast(color, top), contrast(color, bottom));
}

// ── SVG ─────────────────────────────────────────────────────────────

// El dibujo lo escribe un modelo a partir de texto que tipeó una persona,
// y va al DOM con innerHTML: no se confía en él. Se reconstruye desde
// cero con una lista de etiquetas y atributos permitidos; todo lo demás
// (scripts, <text>, <image>, <foreignObject>, estilos, eventos, enlaces
// hacia afuera y el texto suelto entre etiquetas) no pasa.

const TAGS: Record<string, string> = {
  g: "g",
  path: "path",
  circle: "circle",
  ellipse: "ellipse",
  rect: "rect",
  line: "line",
  polyline: "polyline",
  polygon: "polygon",
  defs: "defs",
  lineargradient: "linearGradient",
  radialgradient: "radialGradient",
  stop: "stop",
  clippath: "clipPath",
  mask: "mask",
  pattern: "pattern",
  use: "use",
};

const ATTRS: Record<string, string> = {};
for (const name of [
  "d", "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2", "fx", "fy",
  "width", "height", "points", "fill", "stroke", "stroke-width", "stroke-linecap",
  "stroke-linejoin", "stroke-dasharray", "stroke-opacity", "fill-opacity", "opacity",
  "transform", "id", "offset", "stop-color", "stop-opacity", "gradientUnits",
  "gradientTransform", "spreadMethod", "fill-rule", "clip-rule", "clip-path", "mask",
  "patternUnits", "patternTransform", "href",
]) {
  ATTRS[name.toLowerCase()] = name;
}

const TAG_RE = /<\s*(\/?)\s*([a-zA-Z][\w]*)((?:\s+[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)\s*>/g;
const ATTR_RE = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const SAFE_VALUE = /^[\w\s#.,()%+\-:;/]*$/;

const MAX_ELEMENTS = 500;
const MAX_LENGTH = 60000;

function safeValue(name: string, value: string): boolean {
  if (!SAFE_VALUE.test(value)) return false;
  if (name === "href") return /^#[\w-]+$/.test(value);
  const lower = value.toLowerCase();
  if (lower.includes("javascript") || lower.includes("expression")) return false;
  // Una referencia interna (url(#degrade)) sí; cualquier otra url, no.
  const urls = lower.match(/url\(/g)?.length ?? 0;
  const internal = lower.match(/url\(#[\w-]+\)/g)?.length ?? 0;
  return urls === internal;
}

/** Devuelve el SVG reconstruido con lo permitido, o "" si no quedó nada. */
export function sanitizeInvitationSvg(input: string): string {
  let out = "";
  let elements = 0;
  for (const match of input.matchAll(TAG_RE)) {
    const closing = match[1] === "/";
    const tag = TAGS[match[2].toLowerCase()];
    if (!tag) continue;
    if (closing) {
      out += `</${tag}>`;
      continue;
    }
    if (++elements > MAX_ELEMENTS) break;
    let attrs = "";
    for (const a of match[3].matchAll(ATTR_RE)) {
      const name = ATTRS[a[1].toLowerCase()];
      const value = (a[2] ?? a[3] ?? "").trim();
      if (!name || !safeValue(name, value)) continue;
      attrs += ` ${name}="${value}"`;
    }
    out += `<${tag}${attrs}${match[4] === "/" ? "/" : ""}>`;
    if (out.length > MAX_LENGTH) return "";
  }
  return elements > 0 ? out : "";
}

// ── Lo que devuelve el modelo → un diseño usable ────────────────────

export type RawInvitationDesign = {
  background_top?: unknown;
  background_bottom?: unknown;
  ink?: unknown;
  soft?: unknown;
  accent?: unknown;
  text_position?: unknown;
  svg?: unknown;
};

/**
 * Valida y corrige lo que devolvió el modelo. null si no sirve.
 *
 * Los colores del TEXTO no se le creen al modelo: si la tinta no
 * contrasta con el fondo, se cambia por un oscuro o un blanco. Una
 * invitación linda que no se lee no sirve.
 */
export function buildInvitationDesign(
  raw: RawInvitationDesign,
  format: InvitationFormat
): InvitationDesign | null {
  const hex = (v: unknown): string | null =>
    typeof v === "string" && HEX.test(v.trim()) ? v.trim() : null;

  const top = hex(raw.background_top);
  const bottom = hex(raw.background_bottom);
  if (!top || !bottom || typeof raw.svg !== "string") return null;

  const svg = sanitizeInvitationSvg(raw.svg);
  if (!svg) return null;

  const dark = "#1F1D29";
  const light = "#FFFFFF";
  const fallbackInk = worst(dark, top, bottom) >= worst(light, top, bottom) ? dark : light;

  let ink = hex(raw.ink) ?? fallbackInk;
  if (worst(ink, top, bottom) < 5) ink = fallbackInk;
  let soft = hex(raw.soft) ?? ink;
  if (worst(soft, top, bottom) < 3.5) soft = ink;
  let accent = hex(raw.accent) ?? ink;
  if (worst(accent, top, bottom) < 3) accent = ink;

  const position =
    raw.text_position === "arriba" || raw.text_position === "centro"
      ? raw.text_position
      : "abajo";

  return {
    format,
    backgroundTop: top,
    backgroundBottom: bottom,
    ink,
    soft,
    accent,
    textPosition: position,
    svg,
  };
}
