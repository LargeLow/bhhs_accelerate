/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./client/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        bhhs: {
          maroon: '#670038',
          dark: '#4a0028',
          light: '#8a0050',
          cream: '#F5F1F2',
        },
      },
      fontFamily: {
        serif: ['Marcellus', 'Georgia', 'serif'],
        sans: ['Manrope', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
