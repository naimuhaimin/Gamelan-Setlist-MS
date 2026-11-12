/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./components/**/*.{js,ts,jsx,tsx}', './app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Anjung Seni palette (from the logo). Values live in app/globals.css as CSS variables
        // so the app can switch between dark (default) and light themes.
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        raised: 'rgb(var(--raised) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        'line-strong': 'rgb(var(--line-strong) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        faint: 'rgb(var(--faint) / <alpha-value>)',
        brass: {
          DEFAULT: 'rgb(var(--brass) / <alpha-value>)', // gold leaf: primary actions, cues, loop
          strong: 'rgb(var(--brass-strong) / <alpha-value>)',
          soft: 'var(--brass-soft)',
          ink: 'rgb(var(--brass-ink) / <alpha-value>)',
        },
        bronze: 'rgb(var(--bronze) / <alpha-value>)',
        // Songket crimson: LIVE, adjusted-for-ceremony, thumbs down
        songket: {
          DEFAULT: 'rgb(var(--songket) / <alpha-value>)',
          light: 'rgb(var(--songket-light) / <alpha-value>)',
          soft: 'var(--songket-soft)',
        },
        // Batik jade: rhythms, beats, finished, thumbs up
        jade: {
          DEFAULT: 'rgb(var(--jade) / <alpha-value>)',
          light: 'rgb(var(--jade-light) / <alpha-value>)',
          soft: 'var(--jade-soft)',
        },
        // Crimson stop: breaks inside a Bahagian
        stop: {
          DEFAULT: 'rgb(var(--stop) / <alpha-value>)',
          light: 'rgb(var(--stop-light) / <alpha-value>)',
          soft: 'var(--stop-soft)',
        },
        'chart-song': 'rgb(var(--chart-song) / <alpha-value>)',
        'chart-break': 'rgb(var(--chart-break) / <alpha-value>)',
        live: 'rgb(var(--songket) / <alpha-value>)',
        ok: 'rgb(var(--jade) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
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
