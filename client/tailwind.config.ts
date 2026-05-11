import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        sentinel: {
          navy: "#0a192f",
          gold: "#f59e0b"
        }
      }
    }
  },
  plugins: []
} satisfies Config;
