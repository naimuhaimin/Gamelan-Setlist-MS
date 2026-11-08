/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./components/**/*.{js,ts,jsx,tsx}', './app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Anjung Seni palette (from the logo): warm black, ivory, carved bronze & gold.
        bg: '#0d0b09',
        surface: '#171411',
        raised: '#201c18',
        line: '#2f2923',
        'line-strong': '#433a31',
        ink: '#f4eee4', // ivory
        muted: '#ab9f8f',
        faint: '#786d60',
        brass: {
          DEFAULT: '#c99a52', // gold leaf: primary actions, cues
          strong: '#ddb46e',
          soft: 'rgba(201, 154, 82, 0.15)',
          ink: '#1c1207',
        },
        bronze: '#7a5222', // the logo's carved-corner bronze
        live: '#e5484d',
        ok: '#46a758',
        danger: '#f2797c',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
        script: ['var(--font-script)', 'cursive'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'none' } },
        sheetUp: { from: { opacity: 0, transform: 'translateY(24px)' }, to: { opacity: 1, transform: 'none' } },
        cuePulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(201,154,82,0.55)' },
          '50%': { boxShadow: '0 0 0 10px rgba(201,154,82,0)' },
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
