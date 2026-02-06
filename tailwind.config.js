/** @type {import('tailwindcss').Config} */
module.exports = {
  // No darkMode - X-Plane uses single dark theme
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      fontFamily: {
        sans: ['Roboto', 'system-ui', 'sans-serif'],
        mono: ['Roboto Mono', 'monospace'],
      },
      colors: {
        // Core colors with oklch and alpha support
        border: 'oklch(var(--border) / <alpha-value>)',
        input: 'oklch(var(--input) / <alpha-value>)',
        ring: 'oklch(var(--ring) / <alpha-value>)',
        background: 'oklch(var(--background) / <alpha-value>)',
        foreground: 'oklch(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'oklch(var(--primary) / <alpha-value>)',
          foreground: 'oklch(var(--primary-foreground) / <alpha-value>)'
        },
        secondary: {
          DEFAULT: 'oklch(var(--secondary) / <alpha-value>)',
          foreground: 'oklch(var(--secondary-foreground) / <alpha-value>)'
        },
        destructive: {
          DEFAULT: 'oklch(var(--destructive) / <alpha-value>)',
          foreground: 'oklch(var(--destructive-foreground) / <alpha-value>)'
        },
        success: {
          DEFAULT: 'oklch(var(--success) / <alpha-value>)',
          foreground: 'oklch(var(--success-foreground) / <alpha-value>)'
        },
        warning: {
          DEFAULT: 'oklch(var(--warning) / <alpha-value>)',
          foreground: 'oklch(var(--warning-foreground) / <alpha-value>)'
        },
        info: {
          DEFAULT: 'oklch(var(--info) / <alpha-value>)',
          foreground: 'oklch(var(--info-foreground) / <alpha-value>)'
        },
        violet: {
          DEFAULT: 'oklch(var(--violet) / <alpha-value>)',
          foreground: 'oklch(var(--violet-foreground) / <alpha-value>)'
        },
        muted: {
          DEFAULT: 'oklch(var(--muted) / <alpha-value>)',
          foreground: 'oklch(var(--muted-foreground) / <alpha-value>)'
        },
        accent: {
          DEFAULT: 'oklch(var(--accent) / <alpha-value>)',
          foreground: 'oklch(var(--accent-foreground) / <alpha-value>)'
        },
        popover: {
          DEFAULT: 'oklch(var(--popover) / <alpha-value>)',
          foreground: 'oklch(var(--popover-foreground) / <alpha-value>)'
        },
        card: {
          DEFAULT: 'oklch(var(--card) / <alpha-value>)',
          foreground: 'oklch(var(--card-foreground) / <alpha-value>)'
        },
        // X-Plane extended colors
        xp: {
          'accent-hover': 'oklch(var(--xp-accent-hover) / <alpha-value>)',
          'accent-muted': 'oklch(var(--xp-accent-muted) / <alpha-value>)',
          'accent-subtle': 'oklch(var(--xp-accent-subtle) / <alpha-value>)',
          'accent-glow': 'oklch(var(--xp-accent-glow) / <alpha-value>)',
          'text-secondary': 'oklch(var(--xp-text-secondary) / <alpha-value>)',
          'text-disabled': 'oklch(var(--xp-text-disabled) / <alpha-value>)',
        },
        // Chart colors for map layers
        chart: {
          vor: 'oklch(var(--chart-vor) / <alpha-value>)',
          ndb: 'oklch(var(--chart-ndb) / <alpha-value>)',
          dme: 'oklch(var(--chart-dme) / <alpha-value>)',
          waypoint: 'oklch(var(--chart-waypoint) / <alpha-value>)',
          ils: 'oklch(var(--chart-ils) / <alpha-value>)',
          runway: 'oklch(var(--chart-runway) / <alpha-value>)',
          taxiway: 'oklch(var(--chart-taxiway) / <alpha-value>)'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        },
        'rain': {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '10%': { opacity: '1' },
          '100%': { transform: 'translateY(100px)', opacity: '0' }
        },
        'snow': {
          '0%': { transform: 'translateY(-10px) translateX(0)', opacity: '0' },
          '10%': { opacity: '1' },
          '100%': { transform: 'translateY(100px) translateX(20px)', opacity: '0' }
        },
        'lightning': {
          '0%, 89%, 91%, 93%, 100%': { opacity: '0' },
          '90%, 92%': { opacity: '0.8' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'rain': 'rain 0.5s linear infinite',
        'snow': 'snow 3s ease-in-out infinite',
        'lightning': 'lightning 4s ease-in-out infinite'
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
}
