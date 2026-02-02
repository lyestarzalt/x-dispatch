import { initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import de from './locales/de.json';
import en from './locales/en.json';
import fr from './locales/fr.json';

export const languages = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
] as const;

const resources = {
  en: { translation: en },
  fr: { translation: fr },
  de: { translation: de },
};

const savedLanguage =
  typeof localStorage !== 'undefined' ? localStorage.getItem('app-language') || 'en' : 'en';

i18n.use(initReactI18next).init({
  resources,
  lng: savedLanguage,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already escapes values
  },
  debug: false,
});

// Helper to change language and persist
export const changeLanguage = (lang: string) => {
  i18n.changeLanguage(lang);
  localStorage.setItem('app-language', lang);
};

const availableLanguages = Object.keys(resources);

type TranslationKeys = typeof en;
