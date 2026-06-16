/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'mud-light': '#E6E2DB',
        'mud-dark': '#3E3A37',
        'mud-base': '#918C86',
        'mud-clay': '#B59182',
        'mud-moss': '#7A8276',
      },
      backgroundImage: {
        'gradient-mud-warm': 'linear-gradient(to bottom right, #E6E2DB, #B59182)',
        'gradient-mud-cool': 'linear-gradient(to bottom right, #E6E2DB, #7A8276)',
        'gradient-mud-dark': 'linear-gradient(to bottom right, #3E3A37, #918C86)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease forwards',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.16,1,0.3,1) forwards',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: 0, transform: 'scale(0.98)' }, to: { opacity: 1, transform: 'scale(1)' } },
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(62, 58, 55, 0.05)',
        'card': '0 4px 12px -2px rgba(62, 58, 55, 0.08), 0 2px 4px -1px rgba(62, 58, 55, 0.04)',
        'elevated': '0 12px 24px -4px rgba(62, 58, 55, 0.1), 0 8px 16px -4px rgba(62, 58, 55, 0.05)',
      },
    },
  },
  plugins: [],
}
