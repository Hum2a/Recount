/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/options/**/*.{html,js}"],
  theme: {
    extend: {
      colors: {
        recount: {
          surface: "#f8fafc",
          border: "#e2e8f0",
          accent: "#4f46e5",
          accentHover: "#4338ca",
        },
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
      },
    },
  },
  plugins: [],
};
