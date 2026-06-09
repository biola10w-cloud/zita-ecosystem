import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1A1A2E', accent: '#E8B84B', 'accent-soft': '#FDF3DC',
        surface: '#F7F6F3', border: '#E8E6E1', muted: '#6B6B8A',
      },
      fontFamily: { sans: ['DM Sans', 'sans-serif'], display: ['Lora', 'serif'], mono: ['DM Mono', 'monospace'] },
      boxShadow: { card: '0 1px 3px rgba(26,26,46,0.06), 0 4px 12px rgba(26,26,46,0.04)', btn: '0 2px 8px rgba(232,184,75,0.35)' },
    },
  },
  plugins: [],
};
export default config;
