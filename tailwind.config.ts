import type { Config } from "tailwindcss";
const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface2)",
        border: "var(--border)",
        text: "var(--text)",
        muted: "var(--muted)",
        "accent-blue": "var(--accent-blue)",
        "accent-purple": "var(--accent-purple)",
        "accent-orange": "var(--accent-orange)",
        "accent-green": "var(--accent-green)",
        linkedin: "var(--accent-blue)",
        gmaps: "var(--accent-green)",
        amazon: "var(--accent-orange)",
      },
      borderRadius: { lg: "0.5rem", md: "0.375rem", sm: "0.25rem" },
      keyframes: {
        "fade-up": { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        "spin-slow": { "100%": { transform: "rotate(360deg)" } },
        "pulse-glow": { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.4" } },
      },
      animation: {
        "fade-up": "fade-up 0.3s ease-out",
        "spin-slow": "spin-slow 1s linear infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
