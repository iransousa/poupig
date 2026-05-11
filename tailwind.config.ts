import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Surfaces — RGB triplets pra suportar alpha (bg-bg-1/50 etc)
        bg: {
          0: 'rgb(var(--p-bg-0-rgb) / <alpha-value>)',
          1: 'rgb(var(--p-bg-1-rgb) / <alpha-value>)',
          2: 'rgb(var(--p-bg-2-rgb) / <alpha-value>)',
          3: 'rgb(var(--p-bg-3-rgb) / <alpha-value>)',
        },
        fg: {
          DEFAULT: 'rgb(var(--p-fg-rgb) / <alpha-value>)',
          mid: 'rgba(247, 247, 248, 0.62)',
          dim: 'rgba(247, 247, 248, 0.38)',
        },
        line: {
          DEFAULT: 'rgb(var(--p-line-rgb) / 0.06)',
          strong: 'rgb(var(--p-line-rgb) / 0.10)',
        },
        accent: {
          DEFAULT: 'rgb(var(--p-accent-rgb) / <alpha-value>)',
          dim: '#D93270',
          soft: 'rgba(255, 61, 133, 0.12)',
        },

        // Semantic
        positive: 'rgb(var(--p-green-rgb) / <alpha-value>)',
        warning: 'rgb(var(--p-amber-rgb) / <alpha-value>)',
        danger: 'rgb(var(--p-red-rgb) / <alpha-value>)',

        // Aliases — paleta rosa (compat com classes brand-*/ink-* legadas)
        brand: {
          50: '#FFE5EF',
          100: '#FFCCDE',
          200: '#FFAAC8',
          300: '#FF88B2',
          400: '#FF6699',
          500: '#FF3D85',
          600: '#D93270',
          700: '#B3275B',
          800: '#8C1D47',
          900: '#661332',
        },
        ink: {
          50: '#F7F7F8',
          100: '#E5E5E8',
          200: '#C9C9CE',
          300: '#A0A0A8',
          400: '#6C6C73',
          500: '#3F3F46',
          600: '#252528',
          700: '#1C1C1F',
          800: '#141416',
          900: '#0A0A0B',
          950: '#000000',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Geist', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', '"Geist Mono"', 'ui-monospace', 'monospace'],
        display: ['var(--font-sans)', 'Geist', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '10px',
        md: '14px',
        lg: '20px',
        xl: '28px',
        '2xl': '20px',
        '3xl': '28px',
        '4xl': '32px',
        '5xl': '40px',
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, var(--p-pink-dim) 0%, var(--p-accent) 100%)',
        'gradient-dark': 'linear-gradient(180deg, var(--p-bg-1) 0%, var(--p-bg-0) 100%)',
        'gradient-card': 'linear-gradient(135deg, var(--p-pink-soft), transparent)',
      },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,0.02) inset, 0 1px 2px rgba(0,0,0,0.4)',
        pop: '0 20px 40px -20px rgba(0,0,0,0.6)',
        accent: '0 8px 24px -8px rgba(255, 61, 133, 0.5)',
        glow: '0 8px 24px -8px rgba(255, 61, 133, 0.5)',
      },
      animation: {
        'pulse-soft': 'pulseSoft 2.5s ease-in-out infinite',
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.36s cubic-bezier(0.2, 0.9, 0.3, 1)',
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
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.2, 0.9, 0.3, 1)',
      },
      transitionDuration: {
        fast: '120ms',
        base: '240ms',
        slow: '360ms',
      },
    },
  },
  plugins: [],
};

export default config;
