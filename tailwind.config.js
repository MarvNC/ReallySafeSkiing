/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        russo: ['"Russo One"', 'sans-serif'],
      },
      colors: {
        sky: {
          light: '#b7e9ff',
          DEFAULT: '#87ceeb',
          dark: '#003250',
        },
        accent: {
          orange: '#ff6b35',
          red: '#D94B3D',
        },
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        blink: 'blinker 1.5s linear infinite',
      },
      keyframes: {
        blinker: {
          '50%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
