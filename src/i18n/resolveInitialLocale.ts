import type { Locale } from './types';
import { NAVIGATOR_UNAVAILABLE_FALLBACK } from './types';
import { readSavedLocale } from './persistence';

export function resolveInitialLocale(): Locale {
  const saved = readSavedLocale();
  if (saved) return saved;

  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en';
  }

  return NAVIGATOR_UNAVAILABLE_FALLBACK;
}
