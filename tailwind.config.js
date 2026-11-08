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
          DEFAULT: '#e3ad48', // gold leaf: primary actions, cues, loop
          strong: '#f4c76c',
          soft: 'rgba(227, 173, 72, 0.16)',
          ink: '#1c1207',
        },
        bronze: '#7a5222', // the logo's carved-corner bronze
        // Songket crimson: LIVE, adjusted-for-ceremony, thumbs down
        songket: {
          DEFAULT: '#d0463b',
          light: '#f3a092',
          soft: 'rgba(208, 70, 59, 0.16)',
        },
        // Batik jade: rhythms, beats, finished, thumbs up
        jade: {
          DEFAULT: '#2fa884',
          light: '#7fdcbc',
          soft: 'rgba(47, 168, 132, 0.16)',
        },
        live: '#d0463b',
        ok: '#2fa884',
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
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(227,173,72,0.55)' },
          '50%': { boxShadow: '0 0 0 10px rgba(227,173,72,0)' },
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
