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
        "fade-up":          { "0%": { opacity: "0", transform: "translateY(8px)" },    "100%": { opacity: "1", transform: "translateY(0)" } },
        "fade-in":          { "0%": { opacity: "0" },                                   "100%": { opacity: "1" } },
        "scale-in":         { "0%": { opacity: "0", transform: "scale(0.95)" },         "100%": { opacity: "1", transform: "scale(1)" } },
        "slide-in-right":   { "0%": { opacity: "0", transform: "translateX(12px)" },    "100%": { opacity: "1", transform: "translateX(0)" } },
        "spin-slow":        { "100%": { transform: "rotate(360deg)" } },
        "pulse-glow":       { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.4" } },
        "shimmer":          { "from": { backgroundPosition: "-200% center" }, "to": { backgroundPosition: "200% center" } },
        "toast-in":         { "0%": { opacity: "0", transform: "translateY(16px) scale(0.96)" }, "100%": { opacity: "1", transform: "translateY(0) scale(1)" } },
        "progress-bar":     { "0%": { width: "0%" }, "100%": { width: "100%" } },
      },
      animation: {
        "fade-up":          "fade-up 0.25s ease-out",
        "fade-in":          "fade-in 0.2s ease-out",
        "scale-in":         "scale-in 0.2s cubic-bezier(0.34, 1.2, 0.64, 1)",
        "slide-in-right":   "slide-in-right 0.2s ease-out",
        "spin-slow":        "spin-slow 1s linear infinite",
        "pulse-glow":       "pulse-glow 2s ease-in-out infinite",
        "shimmer":          "shimmer 1.5s linear infinite",
        "toast-in":         "toast-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
