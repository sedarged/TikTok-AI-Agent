/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f5f7ff",
          100: "#e6ecff",
          200: "#c5d4ff",
          300: "#97b2ff",
          400: "#6b8bff",
          500: "#4b63ff",
          600: "#3647db",
          700: "#2d3ab3",
          800: "#273390",
          900: "#222a70"
        }
      }
    }
  },
  plugins: []
};
