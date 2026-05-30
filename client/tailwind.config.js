/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      fontFamily: {
        // friendly, rounded feel with safe system fallbacks
        sans: ['"Nunito"', 'ui-rounded', 'system-ui', 'sans-serif'],
      },
      colors: {
        // soft warm paper + a happy stegosaurus green
        paper: '#fbf7f0',
        stego: {
          50: '#f0faf3',
          200: '#bfe8cc',
          400: '#6cc88a',
          500: '#49b56c',
          600: '#369254',
          700: '#2b7444',
        },
      },
      boxShadow: {
        polaroid: '0 10px 30px -10px rgba(0,0,0,0.25)',
      },
    },
  },
  plugins: [],
};
