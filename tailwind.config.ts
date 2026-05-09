import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0a0a0f',
          900: '#111118',
          800: '#181823',
          700: '#22222f',
          600: '#2a2a3a',
          500: '#3a3a50',
          400: '#6b6b85',
          300: '#8a8aa0',
          200: '#b5b5cc',
          100: '#d5d5e5',
          50: '#f5f5fa',
        },
        brand: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
          950: '#3b0764',
        },
        accent: {
          lime: '#d4ff3a',
          pink: '#ff3a7a',
          cyan: '#3affce',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #7e22ce 0%, #a855f7 50%, #c084fc 100%)',
        'gradient-dark': 'linear-gradient(180deg, #111118 0%, #0a0a0f 100%)',
        'gradient-card': 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(168,85,247,0.02))',
      },
      boxShadow: {
        glow: '0 0 40px -10px rgba(168, 85, 247, 0.6)',
        card: '0 8px 32px -8px rgba(0, 0, 0, 0.4)',
      },
      animation: {
        'pulse-soft': 'pulseSoft 2.5s ease-in-out infinite',
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
