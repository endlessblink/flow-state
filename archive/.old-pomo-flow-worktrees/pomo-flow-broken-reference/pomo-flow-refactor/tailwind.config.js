/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './index.html',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      // Import design tokens into Tailwind
      colors: {
        // Primary brand colors
        primary: {
          50: 'rgb(var(--color-primary-50) / <alpha-value>)',
          100: 'rgb(var(--color-primary-100) / <alpha-value>)',
          200: 'rgb(var(--color-primary-200) / <alpha-value>)',
          300: 'rgb(var(--color-primary-300) / <alpha-value>)',
          400: 'rgb(var(--color-primary-400) / <alpha-value>)',
          500: 'rgb(var(--color-primary-500) / <alpha-value>)',
          600: 'rgb(var(--color-primary-600) / <alpha-value>)',
          700: 'rgb(var(--color-primary-700) / <alpha-value>)',
          800: 'rgb(var(--color-primary-800) / <alpha-value>)',
          900: 'rgb(var(--color-primary-900) / <alpha-value>)',
        },

        // Pomodoro colors
        pomodoro: {
          50: 'rgb(var(--color-pomodoro-50) / <alpha-value>)',
          100: 'rgb(var(--color-pomodoro-100) / <alpha-value>)',
          200: 'rgb(var(--color-pomodoro-200) / <alpha-value>)',
          300: 'rgb(var(--color-pomodoro-300) / <alpha-value>)',
          400: 'rgb(var(--color-pomodoro-400) / <alpha-value>)',
          500: 'rgb(var(--color-pomodoro-500) / <alpha-value>)',
          600: 'rgb(var(--color-pomodoro-600) / <alpha-value>)',
          700: 'rgb(var(--color-pomodoro-700) / <alpha-value>)',
          800: 'rgb(var(--color-pomodoro-800) / <alpha-value>)',
          900: 'rgb(var(--color-pomodoro-900) / <alpha-value>)',
        },

        // Success colors
        success: {
          50: 'rgb(var(--color-success-50) / <alpha-value>)',
          100: 'rgb(var(--color-success-100) / <alpha-value>)',
          200: 'rgb(var(--color-success-200) / <alpha-value>)',
          300: 'rgb(var(--color-success-300) / <alpha-value>)',
          400: 'rgb(var(--color-success-400) / <alpha-value>)',
          500: 'rgb(var(--color-success-500) / <alpha-value>)',
          600: 'rgb(var(--color-success-600) / <alpha-value>)',
          700: 'rgb(var(--color-success-700) / <alpha-value>)',
          800: 'rgb(var(--color-success-800) / <alpha-value>)',
          900: 'rgb(var(--color-success-900) / <alpha-value>)',
        },

        // Warning colors
        warning: {
          50: 'rgb(var(--color-warning-50) / <alpha-value>)',
          100: 'rgb(var(--color-warning-100) / <alpha-value>)',
          200: 'rgb(var(--color-warning-200) / <alpha-value>)',
          300: 'rgb(var(--color-warning-300) / <alpha-value>)',
          400: 'rgb(var(--color-warning-400) / <alpha-value>)',
          500: 'rgb(var(--color-warning-500) / <alpha-value>)',
          600: 'rgb(var(--color-warning-600) / <alpha-value>)',
          700: 'rgb(var(--color-warning-700) / <alpha-value>)',
          800: 'rgb(var(--color-warning-800) / <alpha-value>)',
          900: 'rgb(var(--color-warning-900) / <alpha-value>)',
        },

        // Neutral grays
        slate: {
          50: 'rgb(var(--color-slate-50) / <alpha-value>)',
          100: 'rgb(var(--color-slate-100) / <alpha-value>)',
          200: 'rgb(var(--color-slate-200) / <alpha-value>)',
          300: 'rgb(var(--color-slate-300) / <alpha-value>)',
          400: 'rgb(var(--color-slate-400) / <alpha-value>)',
          500: 'rgb(var(--color-slate-500) / <alpha-value>)',
          600: 'rgb(var(--color-slate-600) / <alpha-value>)',
          700: 'rgb(var(--color-slate-700) / <alpha-value>)',
          800: 'rgb(var(--color-slate-800) / <alpha-value>)',
          900: 'rgb(var(--color-slate-900) / <alpha-value>)',
        },

        // Semantic colors
        surface: {
          primary: 'rgb(var(--color-surface-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-surface-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--color-surface-tertiary) / <alpha-value>)',
        },

        text: {
          primary: 'rgb(var(--color-text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--color-text-tertiary) / <alpha-value>)',
          muted: 'rgb(var(--color-text-muted) / <alpha-value>)',
        },

        border: {
          primary: 'rgb(var(--color-border-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-border-secondary) / <alpha-value>)',
          subtle: 'rgb(var(--color-border-subtle) / <alpha-value>)',
        },

        // Canvas colors
        canvas: {
          bg: 'rgb(var(--color-canvas-bg-primary) / <alpha-value>)',
          grid: 'rgb(var(--color-canvas-grid) / <alpha-value>)',
          selection: 'rgb(var(--color-canvas-selection) / <alpha-value>)',
          hover: 'rgb(var(--color-canvas-hover) / <alpha-value>)',
        },
      },

      // Typography
      fontFamily: {
        sans: 'var(--font-family-sans)',
        mono: 'var(--font-family-mono)',
        display: 'var(--font-family-display)',
      },

      fontSize: {
        // Display sizes
        'display-2xl': ['var(--text-display-2xl)', { lineHeight: 'var(--leading-none)' }],
        'display-xl': ['var(--text-display-xl)', { lineHeight: 'var(--leading-tight)' }],
        'display-lg': ['var(--text-display-lg)', { lineHeight: 'var(--leading-tight)' }],

        // Heading sizes
        'heading-xl': ['var(--text-heading-xl)', { lineHeight: 'var(--leading-snug)' }],
        'heading-lg': ['var(--text-heading-lg)', { lineHeight: 'var(--leading-snug)' }],
        'heading-md': ['var(--text-heading-md)', { lineHeight: 'var(--leading-snug)' }],
        'heading-sm': ['var(--text-heading-sm)', { lineHeight: 'var(--leading-normal)' }],

        // Body sizes
        'body-xl': ['var(--text-body-xl)', { lineHeight: 'var(--leading-relaxed)' }],
        'body-lg': ['var(--text-body-lg)', { lineHeight: 'var(--leading-normal)' }],
        'body-md': ['var(--text-body-md)', { lineHeight: 'var(--leading-normal)' }],
        'body-sm': ['var(--text-body-sm)', { lineHeight: 'var(--leading-normal)' }],
        'body-xs': ['var(--text-body-xs)', { lineHeight: 'var(--leading-normal)' }],

        // Timer sizes
        'timer-xl': ['var(--text-timer-xl)', { lineHeight: 'var(--leading-none)' }],
        'timer-lg': ['var(--text-timer-lg)', { lineHeight: 'var(--leading-none)' }],
        'timer-md': ['var(--text-timer-md)', { lineHeight: 'var(--leading-none)' }],
        'timer-sm': ['var(--text-timer-sm)', { lineHeight: 'var(--leading-none)' }],
      },

      letterSpacing: {
        tighter: 'var(--tracking-tighter)',
        tight: 'var(--tracking-tight)',
        normal: 'var(--tracking-normal)',
        wide: 'var(--tracking-wide)',
        wider: 'var(--tracking-wider)',
      },

      // Spacing system
      spacing: {
        '0.5': 'var(--spacing-0_5)',
        '1.5': 'var(--spacing-1_5)',
        '2.5': 'var(--spacing-2_5)',
        '3.5': 'var(--spacing-3_5)',
        '18': 'var(--spacing-18)',
        '72': 'var(--spacing-72)',
        '80': 'var(--spacing-80)',
        '96': 'var(--spacing-96)',

        // Layout-specific spacing
        'sidebar-collapsed': 'var(--sidebar-width-collapsed)',
        'sidebar-normal': 'var(--sidebar-width-normal)',
        'sidebar-expanded': 'var(--sidebar-width-expanded)',
        'header-height': 'var(--header-height)',
        'task-row': 'var(--task-row-height)',
        'task-card-width': 'var(--task-card-width)',
        'canvas-node-width': 'var(--canvas-node-width)',
        'canvas-node-height': 'var(--canvas-node-height)',
      },

      // Border radius
      borderRadius: {
        'none': 'var(--radius-none)',
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
        'full': 'var(--radius-full)',
      },

      // Box shadows
      boxShadow: {
        'sm': 'var(--shadow-sm)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
        'xl': 'var(--shadow-xl)',
        '2xl': 'var(--shadow-2xl)',
        'primary': 'var(--shadow-primary)',
        'success': 'var(--shadow-success)',
        'warning': 'var(--shadow-warning)',
        'danger': 'var(--shadow-danger)',
        'focus': 'var(--shadow-focus)',
        'card': 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        'modal': 'var(--shadow-modal)',
        'dropdown': 'var(--shadow-dropdown)',
      },

      // Animation durations
      transitionDuration: {
        'instant': 'var(--duration-instant)',
        'fast': 'var(--duration-fast)',
        'normal': 'var(--duration-normal)',
        'slow': 'var(--duration-slow)',
        'extra-slow': 'var(--duration-extra-slow)',
      },

      // Animation timing functions
      transitionTimingFunction: {
        'ease-in-out': 'var(--ease-in-out)',
        'ease-out': 'var(--ease-out)',
        'ease-in': 'var(--ease-in)',
        'back-out': 'var(--ease-back-out)',
        'back-in-out': 'var(--ease-back-in-out)',
      },

      // Z-index layers
      zIndex: {
        'dropdown': 'var(--z-dropdown)',
        'sticky': 'var(--z-sticky)',
        'fixed': 'var(--z-fixed)',
        'modal-backdrop': 'var(--z-modal-backdrop)',
        'modal': 'var(--z-modal)',
        'popover': 'var(--z-popover)',
        'tooltip': 'var(--z-tooltip)',
        'toast': 'var(--z-toast)',
      },

      // Custom animations
      keyframes: {
        'slide-in-up': {
          'from': { opacity: '0', transform: 'translateY(var(--spacing-4))' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          'from': { opacity: '0' },
          'to': { opacity: '1' },
        },
        'scale-in': {
          'from': { opacity: '0', transform: 'scale(0.95)' },
          'to': { opacity: '1', transform: 'scale(1)' },
        },
        'timer-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
        'timer-pulse': {
          '0%': {
            transform: 'scale(1)',
            'box-shadow': '0 0 0 0 rgb(var(--color-pomodoro-400) / 0.4)',
          },
          '70%': {
            transform: 'scale(1.02)',
            'box-shadow': '0 0 0 8px rgb(var(--color-pomodoro-400) / 0)',
          },
          '100%': {
            transform: 'scale(1)',
            'box-shadow': '0 0 0 0 rgb(var(--color-pomodoro-400) / 0)',
          },
        },
        'shimmer': {
          '0%': { left: '-100%' },
          '100%': { left: '100%' },
        },
        'node-select': {
          '0%': {
            transform: 'scale(1)',
            'box-shadow': '0 0 0 0 rgb(var(--color-canvas-selection) / 0.4)',
          },
          '100%': {
            transform: 'scale(1.02)',
            'box-shadow': '0 0 0 4px rgb(var(--color-canvas-selection) / 0.2)',
          },
        },
      },

      animation: {
        'slide-in-up': 'slide-in-up var(--duration-normal) var(--ease-out)',
        'fade-in': 'fade-in var(--duration-normal) var(--ease-out)',
        'scale-in': 'scale-in var(--duration-normal) var(--ease-back-out)',
        'timer-blink': 'timer-blink 1s infinite var(--ease-in-out)',
        'timer-pulse': 'timer-pulse 3s infinite var(--ease-in-out)',
        'shimmer': 'shimmer 1.5s infinite',
        'node-select': 'node-select var(--duration-normal) var(--ease-back-out)',
      },

      // Canvas-specific utilities
      width: {
        'canvas-node': 'var(--canvas-node-width)',
        'task-card': 'var(--task-card-width)',
        'sidebar': 'var(--sidebar-width-normal)',
        'sidebar-collapsed': 'var(--sidebar-width-collapsed)',
      },

      height: {
        'canvas-node': 'var(--canvas-node-height)',
        'task-row': 'var(--task-row-height)',
        'header': 'var(--header-height)',
      },

      minHeight: {
        'task-card': 'var(--task-card-min-height)',
      },

      // Grid utilities for layouts
      gridTemplateColumns: {
        'sidebar-main': 'var(--sidebar-width-normal) 1fr',
        'sidebar-collapsed-main': 'var(--sidebar-width-collapsed) 1fr',
        'calendar-week': 'auto repeat(7, 1fr)',
        'kanban-auto': 'repeat(auto-fit, var(--task-card-width))',
      },

      // Backdrop filters for modern effects
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
      },
    },
  },
  plugins: [
    // Custom plugin for design system utilities
    function({ addUtilities, addComponents, theme }) {
      // Add custom utilities
      addUtilities({
        // Interactive element utilities
        '.interactive-element': {
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '0',
            height: '0',
            borderRadius: '50%',
            background: 'var(--color-primary-500)',
            opacity: '0',
            transform: 'translate(-50%, -50%)',
            transition: 'all var(--duration-fast) var(--ease-out)',
          },
          '&:active::before': {
            width: '100%',
            height: '100%',
            opacity: '0.1',
          },
        },

        // GPU acceleration utilities
        '.gpu-accelerated': {
          transform: 'translateZ(0)',
          willChange: 'transform',
        },

        // Focus ring utilities
        '.focus-ring': {
          '&:focus-visible': {
            outline: 'none',
            boxShadow: 'var(--shadow-focus)',
            borderColor: 'var(--color-primary-500)',
          },
        },

        // Loading state utilities
        '.loading-shimmer': {
          position: 'relative',
          overflow: 'hidden',
          '&::after': {
            content: '""',
            position: 'absolute',
            top: '0',
            left: '-100%',
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent 0%, rgba(107, 124, 255, 0.1) 50%, transparent 100%)',
            animation: 'shimmer 1.5s infinite',
          },
        },
      });

      // Add component classes
      addComponents({
        // Base task styling
        '.task-base': {
          background: 'var(--color-surface-primary)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-card)',
          transition: 'all var(--duration-fast) var(--ease-in-out)',
          cursor: 'pointer',

          '&:hover': {
            borderColor: 'var(--color-primary-300)',
            boxShadow: 'var(--shadow-card-hover)',
            transform: 'translateY(-1px)',
          },

          '&.selected': {
            borderColor: 'var(--color-primary-500)',
            boxShadow: 'var(--shadow-primary)',
            background: 'var(--color-primary-50)',
          },

          '&.dragging': {
            opacity: '0.8',
            transform: 'rotate(1deg) scale(1.02)',
            boxShadow: 'var(--shadow-xl)',
            zIndex: 'var(--z-modal)',
          },
        },

        // Button styles
        '.btn': {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--spacing-2)',
          padding: 'var(--spacing-3) var(--spacing-6)',
          borderRadius: 'var(--radius-button)',
          fontSize: 'var(--text-body-md)',
          fontWeight: 'var(--font-weight-medium)',
          border: '1px solid transparent',
          cursor: 'pointer',
          transition: 'all var(--duration-fast) var(--ease-in-out)',
          textDecoration: 'none',

          '&:disabled': {
            opacity: '0.5',
            cursor: 'not-allowed',
          },
        },

        '.btn-primary': {
          background: 'var(--color-primary-500)',
          color: 'white',
          borderColor: 'var(--color-primary-500)',

          '&:hover:not(:disabled)': {
            background: 'var(--color-primary-600)',
            borderColor: 'var(--color-primary-600)',
          },

          '&:active': {
            transform: 'scale(0.98)',
          },
        },

        '.btn-secondary': {
          background: 'var(--color-surface-primary)',
          color: 'var(--color-text-primary)',
          borderColor: 'var(--color-border-primary)',

          '&:hover:not(:disabled)': {
            background: 'var(--color-slate-100)',
            borderColor: 'var(--color-slate-300)',
          },
        },

        '.btn-ghost': {
          background: 'transparent',
          color: 'var(--color-text-secondary)',

          '&:hover:not(:disabled)': {
            background: 'var(--color-slate-100)',
            color: 'var(--color-text-primary)',
          },
        },

        // Timer widget styles
        '.timer-widget': {
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-4)',
          padding: 'var(--spacing-3) var(--spacing-6)',
          background: 'var(--color-surface-primary)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-2xl)',
          boxShadow: 'var(--shadow-sm)',
          transition: 'all var(--duration-normal) var(--ease-in-out)',

          '&.timer-active': {
            background: 'linear-gradient(135deg, var(--color-pomodoro-50) 0%, var(--color-pomodoro-100) 100%)',
            borderColor: 'var(--color-pomodoro-300)',
            boxShadow: 'var(--shadow-danger)',
          },

          '&.timer-break': {
            background: 'linear-gradient(135deg, var(--color-success-50) 0%, var(--color-success-100) 100%)',
            borderColor: 'var(--color-success-300)',
            boxShadow: 'var(--shadow-success)',
          },
        },
      });
    },

    // RTL support plugin - adds logical properties and direction variants
    function({ addUtilities, addVariant }) {
      // Add RTL and LTR variants for conditional styling
      addVariant('rtl', '[dir="rtl"] &')
      addVariant('ltr', '[dir="ltr"] &')

      // Add logical property utilities for RTL support
      addUtilities({
        // Margin inline (start/end instead of left/right)
        '.ms-0': { 'margin-inline-start': '0' },
        '.ms-1': { 'margin-inline-start': '0.25rem' },
        '.ms-2': { 'margin-inline-start': '0.5rem' },
        '.ms-3': { 'margin-inline-start': '0.75rem' },
        '.ms-4': { 'margin-inline-start': '1rem' },
        '.ms-5': { 'margin-inline-start': '1.25rem' },
        '.ms-6': { 'margin-inline-start': '1.5rem' },
        '.ms-8': { 'margin-inline-start': '2rem' },
        '.ms-auto': { 'margin-inline-start': 'auto' },

        '.me-0': { 'margin-inline-end': '0' },
        '.me-1': { 'margin-inline-end': '0.25rem' },
        '.me-2': { 'margin-inline-end': '0.5rem' },
        '.me-3': { 'margin-inline-end': '0.75rem' },
        '.me-4': { 'margin-inline-end': '1rem' },
        '.me-5': { 'margin-inline-end': '1.25rem' },
        '.me-6': { 'margin-inline-end': '1.5rem' },
        '.me-8': { 'margin-inline-end': '2rem' },
        '.me-auto': { 'margin-inline-end': 'auto' },

        // Padding inline
        '.ps-0': { 'padding-inline-start': '0' },
        '.ps-1': { 'padding-inline-start': '0.25rem' },
        '.ps-2': { 'padding-inline-start': '0.5rem' },
        '.ps-3': { 'padding-inline-start': '0.75rem' },
        '.ps-4': { 'padding-inline-start': '1rem' },
        '.ps-5': { 'padding-inline-start': '1.25rem' },
        '.ps-6': { 'padding-inline-start': '1.5rem' },
        '.ps-8': { 'padding-inline-start': '2rem' },
        '.ps-10': { 'padding-inline-start': '2.5rem' },
        '.ps-12': { 'padding-inline-start': '3rem' },

        '.pe-0': { 'padding-inline-end': '0' },
        '.pe-1': { 'padding-inline-end': '0.25rem' },
        '.pe-2': { 'padding-inline-end': '0.5rem' },
        '.pe-3': { 'padding-inline-end': '0.75rem' },
        '.pe-4': { 'padding-inline-end': '1rem' },
        '.pe-5': { 'padding-inline-end': '1.25rem' },
        '.pe-6': { 'padding-inline-end': '1.5rem' },
        '.pe-8': { 'padding-inline-end': '2rem' },
        '.pe-10': { 'padding-inline-end': '2.5rem' },
        '.pe-12': { 'padding-inline-end': '3rem' },

        // Inset (positioning) - for absolute/fixed positioned elements
        '.start-0': { 'inset-inline-start': '0' },
        '.start-2': { 'inset-inline-start': '0.5rem' },
        '.start-4': { 'inset-inline-start': '1rem' },
        '.start-6': { 'inset-inline-start': '1.5rem' },
        '.start-auto': { 'inset-inline-start': 'auto' },

        '.end-0': { 'inset-inline-end': '0' },
        '.end-2': { 'inset-inline-end': '0.5rem' },
        '.end-4': { 'inset-inline-end': '1rem' },
        '.end-6': { 'inset-inline-end': '1.5rem' },
        '.end-auto': { 'inset-inline-end': 'auto' },

        // Text alignment
        '.text-start': { 'text-align': 'start' },
        '.text-end': { 'text-align': 'end' },

        // Border radius (logical corners)
        '.rounded-s': { 'border-start-start-radius': '0.25rem', 'border-end-start-radius': '0.25rem' },
        '.rounded-e': { 'border-start-end-radius': '0.25rem', 'border-end-end-radius': '0.25rem' },
        '.rounded-s-lg': { 'border-start-start-radius': '0.5rem', 'border-end-start-radius': '0.5rem' },
        '.rounded-e-lg': { 'border-start-end-radius': '0.5rem', 'border-end-end-radius': '0.5rem' },
        '.rounded-s-xl': { 'border-start-start-radius': '1.25rem', 'border-end-start-radius': '1.25rem' },
        '.rounded-e-xl': { 'border-start-end-radius': '1.25rem', 'border-end-end-radius': '1.25rem' },
      })
    },

    // Form plugin for better form styling
    require('@tailwindcss/forms')({
      strategy: 'class',
    }),

    // Typography plugin for better text utilities
    require('@tailwindcss/typography'),

    // Aspect ratio plugin for responsive containers
    require('@tailwindcss/aspect-ratio'),
  ],
};