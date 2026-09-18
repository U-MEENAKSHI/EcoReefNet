/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ocean: {
          900: '#061325', // Dark navy background
          800: '#0a1d33', // Lighter navy for cards
          700: '#122f4d', // Border accents
        },
        accent: {
          cyan: '#00f0ff',
          teal: '#20c997',
        },
        status: {
          healthy: '#059669', // Emerald
          bleached: '#f59e0b', // Amber/Coral
          dead: '#dc2626', // Crimson Red
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
