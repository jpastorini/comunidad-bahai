import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: "#C4A235",
        "gold-dark": "#96790E",
        "gold-light": "#D4B85A",
        terra: "#2A3F8F",
        "terra-light": "#3D56B0",
        amber: "#7E44B8",
        dark: "#2A2833",
        muted: "#7A7670",
        bg: "#F8F7F2",
        card: "#FFFFFF",
        green: "#6A8B5F",
        online: "#7ECF8B",
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
        "gold-grad": "linear-gradient(160deg, #96790E, #C4A235)",
        "terra-grad": "linear-gradient(135deg, #2A3F8F, #3D56B0)",
      },
    },
  },
  plugins: [],
};

export default config;
