/**
 * Design tokens — mirror of tailwind.config.ts colors.
 * Use these when you need raw hex values (SVG strokes, inline gradients, etc.).
 */
export const colors = {
  gold: "#C4A235",
  goldDark: "#96790E",
  goldLight: "#D4B85A",
  terra: "#2A3F8F",
  terraLight: "#3D56B0",
  amber: "#7E44B8",
  dark: "#2A2833",
  muted: "#7A7670",
  bg: "#F8F7F2",
  card: "#FFFFFF",
  green: "#6A8B5F",
  online: "#7ECF8B",
} as const;

export type ColorToken = keyof typeof colors;

/** Build "{hex}{alphaHex}" — e.g. tint("terra", "10") → "#2A3F8F10". */
export function tint(token: ColorToken, alpha: string = "10"): string {
  return `${colors[token]}${alpha}`;
}
