/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#f0f5ff',
          100: '#e5edff',
          200: '#cddbfe',
          300: '#a4bdfc',
          400: '#7594f9',
          500: '#4e67f5',
          600: '#3543e8',
          700: '#2831ce',
          800: '#232aa6',
          900: '#212884',
          950: '#0b0f2c', // Deep dark space color
        },
        dark: {
          900: '#050714',
          800: '#0b1021',
          700: '#151b30',
          600: '#232a45',
        },
        neon: {
          blue: '#00f0ff',
          pink: '#ff00e5',
          purple: '#8a2be2',
        }
      },
      animation: {
        'fade-in':      'fadeIn 0.5s ease forwards',
        'slide-up':     'slideUp 0.45s cubic-bezier(0.16,1,0.3,1) forwards',
        'slide-in':     'slideIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards',
        'scale-in':     'scaleIn 0.35s cubic-bezier(0.16,1,0.3,1) forwards',
        'pulse-ring':   'pulseRing 2s ease-in-out infinite',
        'float':        'float 6s ease-in-out infinite',
        'shimmer':      'shimmer 2s linear infinite',
        'spin-slow':    'spin 8s linear infinite',
        'bounce-dot':   'bounceDot 1.4s ease-in-out infinite',
        'wave-bar':     'waveBar 1.2s ease-in-out infinite',
        'glow-pulse':   'glowPulse 3s ease-in-out infinite',
        'typing':       'typing 1s step-end infinite',
        'progress':     'progress 2s ease-in-out infinite',
        'gradient-x':   'gradientX 3s ease infinite',
        'aurora':       'aurora 20s ease infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:   { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideIn:   { from: { opacity: 0, transform: 'translateX(-12px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
        scaleIn:   { from: { opacity: 0, transform: 'scale(0.92)' }, to: { opacity: 1, transform: 'scale(1)' } },
        pulseRing: {
          '0%, 100%': { transform: 'scale(1)', opacity: 0.6 },
          '50%':       { transform: 'scale(1.15)', opacity: 0.2 },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':       { transform: 'translateY(-10px)' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to:   { backgroundPosition: '200% 0' },
        },
        bounceDot: {
          '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: 0.4 },
          '40%':            { transform: 'scale(1)',   opacity: 1 },
        },
        waveBar: {
          '0%, 100%': { transform: 'scaleY(0.25)' },
          '50%':       { transform: 'scaleY(1)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: 0.5 },
          '50%':       { opacity: 1 },
        },
        typing: {
          '0%, 100%': { opacity: 1 },
          '50%':       { opacity: 0 },
        },
        progress: {
          '0%':   { transform: 'translateX(-100%)' },
          '50%':  { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        gradientX: {
          '0%, 100%': {
              'background-size': '200% 200%',
              'background-position': 'left center'
          },
          '50%': {
              'background-size': '200% 200%',
              'background-position': 'right center'
          },
        },
        aurora: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        }
      },
      boxShadow: {
        'glass': '0 4px 30px rgba(0, 0, 0, 0.5)',
        'neon-brand': '0 0 20px rgba(78, 103, 245, 0.4), inset 0 0 10px rgba(78, 103, 245, 0.2)',
        'neon-pink': '0 0 20px rgba(255, 0, 229, 0.4), inset 0 0 10px rgba(255, 0, 229, 0.2)',
        'neon-cyan': '0 0 20px rgba(0, 240, 255, 0.4), inset 0 0 10px rgba(0, 240, 255, 0.2)',
        'glow': '0 0 15px rgba(255, 255, 255, 0.1)',
        'card': '0 10px 40px -10px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
}
