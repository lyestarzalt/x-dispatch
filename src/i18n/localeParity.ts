interface TranslationNode {
  [key: string]: TranslationValue;
}

type TranslationValue = string | TranslationNode;

function isTranslationNode(value: TranslationValue): value is TranslationNode {
  return typeof value === 'object' && value !== null;
}

function flattenTranslationKeys(translation: TranslationNode, prefix = ''): string[] {
  return Object.entries(translation).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return isTranslationNode(value) ? flattenTranslationKeys(value, path) : [path];
  });
}

export function collectLocaleParityIssues(
  translations: Record<string, TranslationNode>,
  sourceLocale: string
): string[] {
  const sourceTranslation = translations[sourceLocale];

  if (!sourceTranslation) {
    return [`Missing source locale: ${sourceLocale}`];
  }

  const sourceKeys = new Set(flattenTranslationKeys(sourceTranslation));
  const issues: string[] = [];

  for (const [localeCode, translation] of Object.entries(translations)) {
    if (localeCode === sourceLocale) {
      continue;
    }

    const localeKeys = new Set(flattenTranslationKeys(translation));
    const missing = [...sourceKeys].filter((key) => !localeKeys.has(key)).sort();
    const extra = [...localeKeys].filter((key) => !sourceKeys.has(key)).sort();

    if (missing.length > 0) {
      issues.push(`${localeCode}: missing keys -> ${missing.join(', ')}`);
    }

    if (extra.length > 0) {
      issues.push(`${localeCode}: extra keys -> ${extra.join(', ')}`);
    }
  }

  return issues;
}
