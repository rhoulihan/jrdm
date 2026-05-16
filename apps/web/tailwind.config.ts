import type { Config } from "tailwindcss";
import { tokens } from "./src/theme/tokens";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: tokens.color.accent,
        surface: tokens.color.surface,
        "surface-alt": tokens.color.surfaceAlt,
        "jrdm-border": tokens.color.border,
        "jrdm-text": tokens.color.text,
        "jrdm-muted": tokens.color.textMuted,
      },
    },
  },
  plugins: [],
} satisfies Config;
