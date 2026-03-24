/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.ejs",
    "./public/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        saffron: {
          500: '#FF9933', // Deep saffron
          600: '#E68A2E',
        }
      }
    },
  },
  plugins: [],
}
