import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito', 'sans-serif'],
        display: ['Baloo 2', 'cursive', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
