import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Base colors - dark gaming aesthetic
        background: {
          DEFAULT: "#0a0a0f",
          secondary: "#12121a",
        },
        surface: {
          DEFAULT: "rgba(255, 255, 255, 0.03)",
          hover: "rgba(255, 255, 255, 0.06)",
          border: "rgba(255, 255, 255, 0.08)",
        },
        // Accent colors
        accent: {
          purple: "#a855f7",
          cyan: "#22d3ee",
          DEFAULT: "#a855f7",
        },
        // Game result colors
        win: "#22c55e",
        loss: "#ef4444",
        // Text colors
        foreground: {
          DEFAULT: "#ffffff",
          muted: "#a1a1aa",
          subtle: "#71717a",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-accent": "linear-gradient(135deg, #a855f7 0%, #22d3ee 100%)",
        "noise": "url('/noise.svg')",
      },
      boxShadow: {
        glow: "0 0 20px rgba(168, 85, 247, 0.3)",
        "glow-cyan": "0 0 20px rgba(34, 211, 238, 0.3)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.5s ease-out",
        "count-up": "countUp 1s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        countUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
