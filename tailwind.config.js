/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#FF6B8A',
        'primary-light': '#FFE4EC',
        'primary-dark': '#E0506E',
        warm: '#FFF5F5',
        'warm-dark': '#FFEAEA',
      }
    },
  },
  plugins: [],
}
