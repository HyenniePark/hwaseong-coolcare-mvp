import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#16211f",
        paper: "#f7f8f3",
        cool: "#C84A00",
        river: "#2563eb",
        heat: "#f97316",
        alert: "#be123c",
        line: "#dbe4de",
      },
      boxShadow: {
        soft: "0 18px 45px rgba(22, 33, 31, 0.09)",
      },
    },
  },
  plugins: [],
} satisfies Config;
