export const tokens = {
  color: {
    accent: "#C74634", // Oracle red
    surface: "#FAF9F7",
    surfaceAlt: "#FFFFFF",
    border: "#E3E0DB",
    text: "#1A1A1A",
    textMuted: "#6B6B6B",
    danger: "#B00020",
    warning: "#8A6D00",
  },
  edge: {
    "1:1": "#2E7D32",
    "1:N": "#1565C0",
  },
} as const;

export type Tokens = typeof tokens;
