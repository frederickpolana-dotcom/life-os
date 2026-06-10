/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{js,jsx,ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        primary:       '#1D9E75',
        'teal-dark':   '#085041',
        'teal-med':    '#0F6E56',
        'teal-light':  '#E1F5EE',
        'teal-border': '#d4f0e6',
        'teal-pale':   '#f7fdfb',
        amber:         { DEFAULT: '#EF9F27' },
        purple:        { DEFAULT: '#7F77DD' },
        'green-done':  '#639922',
        'text-pri':    '#085041',
        'text-sec':    '#444441',
        'text-muted':  '#888780',
        'text-hint':   '#B4B2A9',
      },
      fontFamily: {
        sans: ['Nunito', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
        pill: '100px',
        sm:   '10px',
      },
    },
  },
  plugins: [],
}
