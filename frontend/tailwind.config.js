/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Halo USD lavender / eggplant palette
        brand: {
          50: '#F4F1F9',
          100: '#E3DDF1',
          200: '#D6CEE9',
          300: '#A99BD4',
          400: '#8B7CC4',
          500: '#7E6FB3',
          600: '#6E5FA8',
          700: '#574A86',
          800: '#3D3460',
          900: '#272140',
        },
        'neon-cyan': '#7E6FB3',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease forwards',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.16,1,0.3,1) forwards',
        'marquee': 'marquee 25s linear infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: 0, transform: 'scale(0.98)' }, to: { opacity: 1, transform: 'scale(1)' } },
        marquee: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(15, 23, 42, 0.04)',
        'card': '0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 4px -1px rgba(15, 23, 42, 0.03)',
        'elevated': '0 12px 24px -4px rgba(15, 23, 42, 0.12), 0 8px 16px -4px rgba(15, 23, 42, 0.05)',
        'glow-violet': '0 0 20px rgba(126, 111, 179, 0.5)',
      },
    },
  },
  plugins: [],
}
