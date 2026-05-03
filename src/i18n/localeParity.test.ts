import { describe, expect, it } from 'vitest';
import { collectLocaleParityIssues } from './localeParity';
import { languages, localeTranslations } from './localeRegistry';

describe('locale parity', () => {
  it('keeps every registered locale in sync with en.json keys', () => {
    expect(collectLocaleParityIssues(localeTranslations, 'en')).toEqual([]);
  });

  it('keeps the language picker aligned with the registered locale set', () => {
    expect(languages.map(({ code }) => code).sort()).toEqual(
      Object.keys(localeTranslations).sort()
    );
  });
});
