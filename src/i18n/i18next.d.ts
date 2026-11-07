import 'i18next';

// The locales are not typed, so keys are plain strings and v27's strict
// interpolation checks have nothing to verify. Left on, they only reject the
// `(key, params?) => string` wrappers around `t`. Flip this once the
// resources are typed through `CustomTypeOptions['resources']`.
declare module 'i18next' {
  interface CustomTypeOptions {
    strictInterpolationChecks: false;
  }
}
