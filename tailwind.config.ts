import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:       '#ffffff',
        surface:  '#f8f9fa',
        surface2: '#f0f1f3',
        border:   '#e2e4e8',
        text:     '#111318',
        dim:      '#6b7280',
        mga:      '#16a34a',
        sambo:    '#2563eb',
        accent:   '#dc2626',
      },
    },
  },
} satisfies Config
