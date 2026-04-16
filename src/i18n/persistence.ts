import type { Locale } from './types';

const STORAGE_KEY = 'sql-viz-locale';

export function readSavedLocale(): Locale | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'ja' || v === 'en' ? v : null;
  } catch {
    return null;
  }
}

export function writeSavedLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // 保存失敗は致命的でないため握りつぶす
  }
}
