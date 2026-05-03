import { describe, expect, it } from 'vitest';
import { collectLocaleParityIssues } from './localeParity';
import { languages, localeTranslations, resources } from './localeRegistry';

describe('locale parity', () => {
  const expectedLanguages = [
    { code: 'en', name: 'English' },
    { code: 'pirate', name: 'English (Pirate)' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'it', name: 'Italiano' },
    { code: 'pt', name: 'Português' },
    { code: 'ru', name: 'Русский' },
    { code: 'pl', name: 'Polski' },
    { code: 'ja', name: '日本語' },
    { code: 'zh', name: '中文' },
  ] as const;

  it('keeps every registered locale in sync with en.json keys', () => {
    expect(collectLocaleParityIssues(localeTranslations, 'en')).toEqual([]);
  });

  it('keeps the full supported locale set aligned across translations, resources, and the picker', () => {
    const expectedLocaleCodes = expectedLanguages.map(({ code }) => code).sort();

    expect(languages).toEqual(expectedLanguages);
    expect(Object.keys(localeTranslations).sort()).toEqual(expectedLocaleCodes);
    expect(Object.keys(resources).sort()).toEqual(expectedLocaleCodes);
  });
});
