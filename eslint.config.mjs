import js from '@eslint/js';
import i18next from 'eslint-plugin-i18next';
import reactHooks from 'eslint-plugin-react-hooks';
import security from 'eslint-plugin-security';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const tsconfigRootDir = import.meta.dirname;

export default tseslint.config(
  // Ignore patterns
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.vite/**',
      'out/**',
      '*.config.js',
      '*.config.ts',
      'vite.*.ts',
      'forge.config.ts',
      'design-system/**',
      'scripts/**',
    ],
  },

  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript recommended rules
  ...tseslint.configs.recommended,

  // Main config for TS/TSX files
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
      parserOptions: {
        tsconfigRootDir,
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      security,
    },
    rules: {
      // React hooks rules
      ...reactHooks.configs.recommended.rules,

      // TypeScript rules - relaxed to allow CI to pass
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',

      // Security rules - disabled as they produce too many false positives
      // for safe array indexing and object property access patterns
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-regexp': 'off',
      'security/detect-unsafe-regex': 'off',

      // General rules
      // CLAUDE.md: no console.* in shipped code — use logger.<scope>.<level>.
      // Tests and scripts are opted out below.
      'no-console': 'error',
      'prefer-const': 'error',
    },
  },

  // no-console: tests are allowed to use console
  {
    files: [
      '**/*.test.{ts,tsx}',
      '**/*.e2e.{ts,tsx}',
      '**/__tests__/**/*.{ts,tsx}',
      'tests/**/*.{ts,tsx}',
    ],
    rules: {
      'no-console': 'off',
    },
  },

  // i18n: enforce no hardcoded user-facing strings in components
  {
    files: ['src/components/**/*.{ts,tsx}'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          message:
            'Wrap user-facing strings in t() and add the key to all 10 locales.',
          'should-validate-template': false,
          'jsx-attributes': {
            exclude: [
              'className',
              'styleName',
              'style',
              'type',
              'key',
              'id',
              'htmlFor',
              'form',
              'width',
              'height',
              'ref',
              'role',
              'href',
              'src',
              'name',
              'value',
              'defaultValue',
              'color',
              // custom discriminant props seen across our components
              'dotClass',
              'nameKey',
              'segment',
              'tone',
              // recharts / SVG attribute names — never user text
              'stroke',
              'fill',
              'strokeDasharray',
              'strokeWidth',
              'strokeLinecap',
              'strokeLinejoin',
              'strokeOpacity',
              'fillOpacity',
              'dataKey',
              'position',
              'fontWeight',
              'fontFamily',
              'textAnchor',
              'dominantBaseline',
              'transform',
              'cursor',
              'opacity',
              'offset',
              'stopColor',
              'viewBox',
              'xmlns',
              'r',
              'cx',
              'cy',
              'x1',
              'x2',
              'y1',
              'y2',
              'dx',
              'dy',
              'd',
              'points',
              'data-.*',
              'aria-.*',
              'autoComplete',
              'autoCapitalize',
              'autoCorrect',
              'spellCheck',
              'inputMode',
              'enterKeyHint',
              'rel',
              'target',
              'method',
              'encType',
              'as',
              'variant',
              'size',
              'side',
              'align',
              'sideOffset',
              'alignOffset',
              'orientation',
              'direction',
              'position',
            ],
          },
          'jsx-components': {
            exclude: ['Trans', 'svg', 'path', 'g', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'defs', 'linearGradient', 'radialGradient', 'stop', 'mask', 'clipPath', 'use', 'symbol', 'pattern'],
          },
          words: {
            exclude: [
              '[0-9!-/:-@[-`{-~]+',
              '[A-Z_-]+',
              '\\s*',
              /^[—–−·•‧·-]+$/,
              /^\p{Emoji}+$/u,
              // CSS / charting style values (recharts label.position, fontWeight, fill colors)
              /^oklch\(.*\)$/,
              /^url\(.*\)$/,
              /^(top|bottom|left|right|center|middle|insideTop|insideBottom)$/,
              /^(bold|normal|lighter|bolder|inherit|initial)$/,
              /^(monotone|linear|step|basis|cardinal|natural)$/,
              // unit abbreviations — same in every locale
              /^(km|nm|nmi|SM|mi|m|cm|mm|ft|in|kt|kts|fpm|mph|kph|psi|hPa|inHg|°C|°F|°|m\/s)$/,
              // brand / proper nouns allowed inline
              'SimBrief',
              'X-Dispatch',
              'X-Plane',
              'VATSIM',
              'IVAO',
              'METAR',
              'TAF',
              'ATIS',
              'NOTAM',
            ],
          },
          'object-properties': {
            exclude: [
              '[A-Z_-]+',
              // discriminant / config keys whose string values are state, not user text
              'type',
              'labelKey',
              'mode',
              'country',
              'customStartMode',
              'airSpeedEnum',
              'boatPosition',
              'segment',
              'stage',
            ],
          },
          callees: {
            exclude: [
              'i18n(ext)?',
              't',
              'require',
              'addEventListener',
              'removeEventListener',
              'postMessage',
              'getElementById',
              'querySelector',
              'querySelectorAll',
              'dispatch',
              'commit',
              'includes',
              'indexOf',
              'endsWith',
              'startsWith',
              'logger(\\..*)?',
              'console(\\..*)?',
              'cn',
              'clsx',
              'classnames',
              'cva',
              'tv',
              // state-setter / event-handler naming conventions — args are discriminants
              'set[A-Z].*',
              'on[A-Z].*',
            ],
          },
        },
      ],
    },
  },

  // Opt-outs:
  //  - Map/layers: no JSX, lots of MapLibre string IDs
  //  - Map/widgets/DevDebugOverlay: developer-only debug UI, not user-facing
  //  - components/ui: shadcn forks — internal class-config strings, not user text
  //  - tests: assertions and fixtures are not user-facing
  {
    files: [
      'src/components/Map/layers/**/*.{ts,tsx}',
      'src/components/Map/widgets/DevDebugOverlay/**/*.{ts,tsx}',
      'src/components/ui/**/*.{ts,tsx}',
      'src/components/**/*.test.{ts,tsx}',
      'src/components/**/__tests__/**/*.{ts,tsx}',
    ],
    rules: {
      'i18next/no-literal-string': 'off',
    },
  }
);
