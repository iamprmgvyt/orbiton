/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#060612',
        bg2: '#0d0d1e',
        surface: 'rgba(255, 255, 255, 0.035)',
        surface2: 'rgba(255, 255, 255, 0.06)',
        border: 'rgba(255, 255, 255, 0.08)',
        border2: 'rgba(255, 255, 255, 0.13)',
        accent: '#7c3aed',
        accent2: '#3b82f6',
        accent3: '#a855f7',
        text: '#f1f5f9',
        text2: '#cbd5e1',
        muted: '#64748b',
      }
    },
  },
  plugins: [],
}
