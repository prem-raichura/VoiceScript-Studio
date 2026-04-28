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
          50:  '#eef3ff',
          100: '#dce6ff',
          200: '#b9cdff',
          300: '#8aaaff',
          400: '#5b82ff',
          500: '#3a5bff',
          600: '#2338f5',
          700: '#1c2cd8',
          800: '#1c29ae',
          900: '#1c2889',
          950: '#141866',
        },
      },
      animation: {
        'fade-in':      'fadeIn 0.5s ease forwards',
        'slide-up':     'slideUp 0.45s cubic-bezier(0.16,1,0.3,1) forwards',
        'slide-in':     'slideIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards',
        'scale-in':     'scaleIn 0.35s cubic-bezier(0.16,1,0.3,1) forwards',
        'pulse-ring':   'pulseRing 2s ease-in-out infinite',
        'float':        'float 3s ease-in-out infinite',
        'shimmer':      'shimmer 1.8s linear infinite',
        'spin-slow':    'spin 3s linear infinite',
        'bounce-dot':   'bounceDot 1.4s ease-in-out infinite',
        'wave-bar':     'waveBar 1.2s ease-in-out infinite',
        'glow-pulse':   'glowPulse 2s ease-in-out infinite',
        'typing':       'typing 1s step-end infinite',
        'progress':     'progress 2s ease-in-out infinite',
        'rotate-slow':  'spin 8s linear infinite',
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
          '50%':       { transform: 'translateY(-6px)' },
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
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(58,91,255,0.0)' },
          '50%':       { boxShadow: '0 0 20px 6px rgba(58,91,255,0.18)' },
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
      },
      boxShadow: {
        'card':    '0 1px 3px rgba(20,24,102,0.06), 0 8px 24px rgba(20,24,102,0.06)',
        'card-lg': '0 2px 8px rgba(20,24,102,0.08), 0 16px 48px rgba(20,24,102,0.10)',
        'brand':   '0 4px 24px rgba(58,91,255,0.28)',
        'brand-sm':'0 2px 12px rgba(58,91,255,0.22)',
        'glow':    '0 0 0 3px rgba(58,91,255,0.18)',
        'inner-brand': 'inset 0 1px 0 rgba(255,255,255,0.15)',
      },
    },
  },
  plugins: [],
}
