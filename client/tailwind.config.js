/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        orange: {
          DEFAULT: '#ff5a1f',
          50: '#fff5f0',
          100: '#ffe8de',
          200: '#ffd0bd',
          300: '#ffa88f',
          400: '#ff7853',
          500: '#ff5a1f',
          600: '#eb3e00',
          700: '#c22e00',
          800: '#9b2605',
          900: '#7e240a',
        },
        brand: {
          50: '#fff5f0',
          100: '#ffe8de',
          200: '#ffd0bd',
          500: '#ff5a1f',
          600: '#eb3e00',
          700: '#c22e00',
          900: '#7e240a',
        },
        paper: {
          DEFAULT: '#dfe0e2',
          bright: '#f4f4f2',
          deep: '#c7c9cc',
        },
        ink: {
          DEFAULT: '#0c0c0d',
          muted: '#626368',
        },
        dark: {
          DEFAULT: '#090909',
          surface: '#111113',
          card: '#161619',
        }
      },
      fontFamily: {
        sans: ['"Manrope"', 'Arial', 'sans-serif'],
        display: ['"Manrope"', 'Arial', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'monospace'],
      }
    },
  },
  plugins: [],
}
