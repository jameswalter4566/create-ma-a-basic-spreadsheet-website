/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        brand: {
          50: "#eefdf5",
          100: "#d6f9e6",
          200: "#b0f1d0",
          300: "#79e4b3",
          400: "#3fd090",
          500: "#16b573",
          600: "#0a935d",
          700: "#0a754d",
          800: "#0c5c40",
          900: "#0b4c37",
        },
      },
    },
  },
  plugins: [],
};
