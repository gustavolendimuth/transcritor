import type { Config } from 'tailwindcss';

export default {
  content: ['./src/client/index.html', './src/client/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'ctp-base': '#1e1e2e',
        'ctp-mantle': '#181825',
        'ctp-surface0': '#313244',
        'ctp-surface1': '#45475a',
        'ctp-surface2': '#585b70',
        'ctp-overlay0': '#6c7086',
        'ctp-text': '#cdd6f4',
        'ctp-subtext0': '#a6adc8',
        'ctp-subtext1': '#bac2de',
        'ctp-mauve': '#cba6f7',
        'ctp-mauve-dim': '#b592e8',
        'ctp-green': '#a6e3a1',
        'ctp-red': '#f38ba8',
        'ctp-yellow': '#f9e2af',
        'ctp-peach': '#fab387',
        'ctp-teal': '#94e2d5',
        'ctp-sky': '#89dceb',
        'ctp-blue': '#89b4fa',
        'ctp-pink': '#f5c2e7',
      },
      fontFamily: {
        display: ['Fraunces', 'ui-serif', 'serif'],
        body: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
