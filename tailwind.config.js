/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.ejs",
    "./public/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        admin: {
          800: '#1e293b',
          900: '#0f172a',
        },
        saffron: {
          50:  '#fffbf0',
          100: '#FFF0E6',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#FF9933', // Deep saffron
          600: '#E68A2E',
          700: '#b45309',
          800: '#92400e',
          900: '#804C19'
        },
        maroon: {
          700: '#7f1d1d',
          800: '#6b1a1a',
          900: '#4c0519',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Playfair Display', 'serif']
      }
    }
  },
  plugins: [],
}
