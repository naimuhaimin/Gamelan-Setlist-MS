/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./components/**/*.{js,ts,jsx,tsx}', './app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Stage palette: near-black for projection, one brass accent for cues & primary actions.
        bg: '#0b0c10',
        surface: '#13151c',
        raised: '#1a1d26',
        line: '#262a36',
        'line-strong': '#343a4a',
        ink: '#f3f4f6',
        muted: '#9aa1b2',
        faint: '#6b7285',
        brass: {
          DEFAULT: '#f5b335',
          strong: '#ffc54d',
          soft: 'rgba(245, 179, 53, 0.14)',
          ink: '#1a1203',
        },
        live: '#ef4444',
        ok: '#22c55e',
        danger: '#f87171',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'none' } },
        sheetUp: { from: { opacity: 0, transform: 'translateY(24px)' }, to: { opacity: 1, transform: 'none' } },
        cuePulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(245,179,53,0.55)' },
          '50%': { boxShadow: '0 0 0 10px rgba(245,179,53,0)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 160ms ease-out',
        'sheet-up': 'sheetUp 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'cue-pulse': 'cuePulse 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
