/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /* monday.com primary blue */
        brand: {
          50:  '#e6f2ff',
          100: '#b3d8ff',
          200: '#80bdff',
          300: '#4da3ff',
          400: '#2689ff',
          500: '#0073ea',
          600: '#0060cc',
          700: '#004ea8',
          800: '#003c84',
          900: '#002b60',
        },
        /* Dark sidebar — monday.com uses #1f2d3d */
        surface: {
          sidebar: '#1f2d3d',
          'sidebar-hover': '#29394d',
          'sidebar-active': '#344a5e',
          header: '#ffffff',
          page:   '#f6f7fb',
          card:   '#ffffff',
          input:  '#ffffff',
          dark:   {
            sidebar: '#1a1f2e',
            page:    '#111827',
            card:    '#1e2433',
            input:   '#2a3245',
          }
        },
        /* Stage pill colours */
        stage: {
          imported:          '#7c3aed',
          'connection-sent': '#d97706',
          connected:         '#059669',
          engaging:          '#2563eb',
          'dm-ready':        '#7c3aed',
          'dm-sent':         '#db2777',
          replied:           '#0891b2',
          won:               '#16a34a',
          lost:              '#dc2626',
          archived:          '#6b7280',
        },
      },
      fontFamily: {
        sans: ['Figtree', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', '14px'],
        xs:    ['11px', '15px'],
        sm:    ['12px', '16px'],
        base:  ['13px', '18px'],
        md:    ['14px', '20px'],
        lg:    ['16px', '22px'],
        xl:    ['18px', '24px'],
        '2xl': ['22px', '28px'],
        '3xl': ['28px', '34px'],
      },
      borderRadius: {
        DEFAULT: '6px',
        sm:   '4px',
        md:   '6px',
        lg:   '8px',
        xl:   '12px',
        '2xl':'16px',
        full: '9999px',
      },
      boxShadow: {
        card:   '0 1px 3px 0 rgba(0,0,0,.06), 0 1px 2px -1px rgba(0,0,0,.06)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,.10), 0 2px 4px -1px rgba(0,0,0,.06)',
        panel:  '0 8px 30px 0 rgba(0,0,0,.12)',
        modal:  '0 20px 60px 0 rgba(0,0,0,.20)',
        inner:  'inset 0 1px 2px 0 rgba(0,0,0,.05)',
      },
      animation: {
        'fade-in':     'fadeIn 200ms ease-out forwards',
        'slide-right': 'slideRight 220ms cubic-bezier(.2,.6,.4,1) forwards',
        'slide-up':    'slideUp 200ms ease-out forwards',
        'scale-in':    'scaleIn 180ms cubic-bezier(.2,.6,.4,1) forwards',
        'pulse-soft':  'pulseSoft 2s ease-in-out infinite',
        'shimmer':     'shimmer 1.6s linear infinite',
        'bounce-sm':   'bounceSm 400ms cubic-bezier(.2,.6,.4,1) forwards',
        'spin-fast':   'spin 0.6s linear infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        slideRight:{ from: { opacity: '0', transform: 'translateX(32px)' }, to: { opacity: '1', transform: 'none' } },
        slideUp:   { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'none' } },
        scaleIn:   { from: { opacity: '0', transform: 'scale(.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
        pulseSoft: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.45' } },
        shimmer:   { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
        bounceSm:  { '0%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.06)' }, '100%': { transform: 'scale(1)' } },
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(.2,.6,.4,1)',
      },
    },
  },
  plugins: [],
}
