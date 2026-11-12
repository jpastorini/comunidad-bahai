import type { Config } from "tailwindcss";

/** Un color de la paleta: variable CSS de globals.css, con opacidad. */
const c = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // Cada color es una variable CSS definida en globals.css (tres
      // canales RGB), para que un tema pueda redefinirla: lib/ui-theme.ts.
      // Los hexadecimales del tema clásico, de referencia, en lib/tokens.ts.
      colors: {
        gold: c("gold"), // #C4A235
        "gold-dark": c("gold-dark"), // #96790E
        "gold-light": c("gold-light"), // #D4B85A
        terra: c("terra"), // #2A3F8F
        "terra-light": c("terra-light"), // #3D56B0
        amber: c("amber"), // #7E44B8
        dark: c("dark"), // #2A2833
        // El fondo del comunicado nacional (057). Es "noche" con croma:
        // el casi-negro neutro que tenía antes se leía como luto, que es
        // justo lo que un comunicado del país no tiene que parecer.
        // ⚠️ No confundir con `green` (#6A8B5F), que es el salvia de los
        // ESTADOS ("en orden", "confirmado") y vive sobre fondo blanco.
        // Este es un fondo, y a esa distancia no se confunden.
        pine: c("pine"), // #1F3A2C
        muted: c("muted"), // #7A7670
        bg: c("bg"), // #F8F7F2
        card: c("card"), // #FFFFFF
        green: c("green"), // #6A8B5F
        online: c("online"), // #7ECF8B
      },
      fontFamily: {
        display: ["var(--font-cormorant)", "Georgia", "serif"],
        sans: ["var(--font-sora)", "system-ui", "sans-serif"],
        body: ["var(--font-outfit)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 2px 6px rgba(42,31,20,0.04)",
        "card-elevated": "0 2px 10px rgba(42,31,20,0.05)",
        "card-soft": "0 1px 4px rgba(42,31,20,0.04)",
      },
      backgroundImage: {
        "gold-grad":
          "linear-gradient(160deg, rgb(var(--c-gold-dark)), rgb(var(--c-gold)))",
        "terra-grad":
          "linear-gradient(135deg, rgb(var(--c-terra)), rgb(var(--c-terra-light)))",
        // La otra institución (057): mismo tratamiento que el terra, en
        // el verde pino de la tarjeta del comunicado nacional.
        "pine-grad":
          "linear-gradient(135deg, rgb(var(--c-pine)), rgb(var(--c-pine-light)))",
      },
    },
  },
  plugins: [],
};

export default config;
