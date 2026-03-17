import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-inter)", "Inter", "sans-serif"],
        mono: ["var(--font-inter)", "Inter", "monospace"],
      },
      colors: {
        clause: {
          bg: "var(--clause-bg)",
          surface: "var(--clause-surface)",
          surface2: "var(--clause-surface2)",
          border: "var(--clause-border)",
          border2: "var(--clause-border2)",
          accent: "var(--clause-accent)",
          accent2: "var(--clause-accent2)",
          accent3: "var(--clause-accent3)",
          accent4: "var(--clause-accent4)",
          warning: "var(--clause-warning)",
          text: "var(--clause-text)",
          text2: "var(--clause-text2)",
          text3: "var(--clause-text3)",
          "accent-hover": "var(--clause-accent-hover)",
          "connected-border": "var(--clause-connected-border)",
          "connected-bg": "var(--clause-connected-bg)",
        },
      },
      keyframes: {
        "clause-pulse": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(0.75)" },
        },
        "clause-fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "clause-pulse": "clause-pulse 2s infinite",
        "clause-fade-up": "clause-fade-up 0.5s ease forwards",
        "clause-fade-up-delay-1": "clause-fade-up 0.5s 0.1s ease forwards",
        "clause-fade-up-card-1": "clause-fade-up 0.35s 0.15s ease forwards",
        "clause-fade-up-card-2": "clause-fade-up 0.35s 0.2s ease forwards",
        "clause-fade-up-card-3": "clause-fade-up 0.35s 0.25s ease forwards",
        "clause-fade-up-card-4": "clause-fade-up 0.35s 0.3s ease forwards",
        "clause-fade-up-card-5": "clause-fade-up 0.35s 0.35s ease forwards",
      },
    },
  },
  plugins: [],
};

export default config;

