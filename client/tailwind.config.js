/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // New theme: midnight navy + warm cream + coral accent
        navy: {
          950: '#0b0f1a',
          900: '#0f1625',
          800: '#161e30',
          700: '#1e2840',
          600: '#263352',
          500: '#2f3f63',
        },
        cream: {
          50:  '#fdfaf4',
          100: '#f8f2e0',
          200: '#f0e6c4',
          300: '#e4d4a0',
        },
        coral: {
          300: '#ff9f8a',
          400: '#ff7c63',
          500: '#f55a3c',
          600: '#d94228',
        },
        teal: {
          400: '#3ecfcf',
          500: '#2ab8b8',
        },
        card: {
          bg:     '#fdfaf4',
          border: '#d8cba8',
        },
      },
      animation: {
        'slide-up':    'slideUp 0.3s ease-out forwards',
        'fade-in':     'fadeIn 0.4s ease-out forwards',
        'bounce-in':   'bounceIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards',
        'trump-reveal':'trumpReveal 0.8s cubic-bezier(0.34,1.56,0.64,1) forwards',
        'pulse-glow':  'pulseGlow 2s ease-in-out infinite',
        'card-play':   'cardPlay 0.3s ease-out',
      },
      keyframes: {
        slideUp:     { '0%': { transform:'translateY(24px)', opacity:0 }, '100%': { transform:'translateY(0)', opacity:1 } },
        fadeIn:      { '0%': { opacity:0 }, '100%': { opacity:1 } },
        bounceIn:    { '0%': { transform:'scale(0.3)', opacity:0 }, '60%': { transform:'scale(1.08)' }, '100%': { transform:'scale(1)', opacity:1 } },
        trumpReveal: { '0%': { transform:'scale(0) rotateY(180deg)', opacity:0 }, '60%': { transform:'scale(1.15) rotateY(8deg)', opacity:1 }, '100%': { transform:'scale(1) rotateY(0deg)', opacity:1 } },
        pulseGlow:   { '0%,100%': { boxShadow:'0 0 0 0 rgba(245,90,60,0.4)' }, '50%': { boxShadow:'0 0 0 8px rgba(245,90,60,0)' } },
        cardPlay:    { '0%': { transform:'translateY(0) scale(1)' }, '40%': { transform:'translateY(-28px) scale(1.08)' }, '100%': { transform:'translateY(0) scale(1)' } },
      },
    },
  },
  plugins: [],
};
