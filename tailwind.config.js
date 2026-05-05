/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./client/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        bhhs: {
          maroon: '#5A1F2E',
          dark: '#3d1520',
          light: '#7a2f42',
          cream: '#F5F0EB',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
