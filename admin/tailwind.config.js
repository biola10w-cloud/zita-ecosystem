/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1A1A2E',
        accent: '#E8B84B',
        'accent-soft': '#FDF3DC',
        surface: '#FAF8F5',
      },
    },
  },
  plugins: [],
};
