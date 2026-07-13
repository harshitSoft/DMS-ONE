export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1E293B",
        brand: "#4F46E5",
        accent: "#F59E0B"
      },
      boxShadow: {
        soft: "0 14px 40px rgba(15, 23, 42, 0.08)",
        card: "0 4px 18px rgba(15, 23, 42, 0.055)",
        "card-hover": "0 16px 38px rgba(15, 23, 42, 0.10)"
      },
      fontFamily: {
        display: ["Manrope", "Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
