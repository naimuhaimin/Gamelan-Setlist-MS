/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        stage: {
          bg: '#090a0f',
          card: '#12141d',
          cardHover: '#181b26',
          border: '#242a3a',
          accent: '#f59e0b', // Royal Gamelan Brass / Gold
          accentHover: '#fbbf24',
          cyan: '#06b6d4',
          emerald: '#10b981',
          danger: '#ef4444',
          muted: '#8e98ad',
          text: '#f8fafc',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'stage-title': ['3.75rem', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
        'stage-counter': ['5rem', { lineHeight: '1' }],
        'stage-cue': ['2rem', { lineHeight: '1.2' }],
      },
      boxShadow: {
        'glow-gold': '0 0 35px -5px rgba(245, 158, 11, 0.45)',
        'glow-cyan': '0 0 30px -5px rgba(6, 182, 212, 0.45)',
        'glow-emerald': '0 0 30px -5px rgba(16, 185, 129, 0.45)',
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: 1, transform: 'scale(1)' },
          '50%': { opacity: 0.85, transform: 'scale(1.02)' },
        },
        fadeIn: {
          '0%': { opacity: 0, transform: 'translateY(6px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
