import { initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import { resources } from './localeRegistry';

export { languages } from './localeRegistry';

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
