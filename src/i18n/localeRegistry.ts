import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import it from './locales/it.json';
import ja from './locales/ja.json';
import pl from './locales/pl.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';
import zh from './locales/zh.json';

export const localeTranslations = {
  en,
  es,
  fr,
  de,
  it,
  pt,
  ru,
  pl,
  ja,
  zh,
} as const;

export type LocaleCode = keyof typeof localeTranslations;

export const languages = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'pl', name: 'Polski' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' },
] as const satisfies ReadonlyArray<{ code: LocaleCode; name: string }>;

export const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  it: { translation: it },
  pt: { translation: pt },
  ru: { translation: ru },
  pl: { translation: pl },
  ja: { translation: ja },
  zh: { translation: zh },
} as const;
