import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:       '#0d1117',
        surface:  '#161b22',
        surface2: '#21262d',
        border:   '#30363d',
        text:     '#c9d1d9',
        dim:      '#8b949e',
        mga:      '#4ade80',
        sambo:    '#60a5fa',
        accent:   '#f78166',
      },
    },
  },
} satisfies Config
