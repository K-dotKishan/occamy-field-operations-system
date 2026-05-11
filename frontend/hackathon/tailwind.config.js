export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "occamy-1": "#3b758c",
        "occamy-2": "#1797a6",
        "occamy-blue": "#3b758c",
        "occamy-teal": "#1797a6",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #3b758c 0%, #1797a6 100%)",
      },
    },
  },
  plugins: [],
}
