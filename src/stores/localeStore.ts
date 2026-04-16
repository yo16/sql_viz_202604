import { create } from 'zustand';
import type { Locale } from '@/i18n/types';
import { SSR_INITIAL_LOCALE } from '@/i18n/types';
import { writeSavedLocale } from '@/i18n/persistence';

/**
 * locale ストアの状態型。
 * 設計参照: doc/design/i18n.md §5
 */
export interface LocaleState {
  /** 現在の locale。初期値は SSR_INITIAL_LOCALE ('en')。 */
  locale: Locale;
}

/** locale ストアのアクション型。 */
export interface LocaleActions {
  /**
   * ユーザー操作による locale 切替。
   * ストア更新 + localStorage 保存 + `<html lang>` 更新を同時に行う。
   */
  setLocale: (locale: Locale) => void;
  /**
   * hydration 直後の初期反映専用。
   * ストアの locale のみを更新し、DOM や localStorage には触らない。
   * `<html lang>` は <body> 直後のインラインスクリプトが既に確定済みのため、
   * ここで上書きしないことを保証する。
   * 設計参照: doc/design/i18n.md §8.4
   */
  _initializeLocale: (locale: Locale) => void;
}

export type LocaleStore = LocaleState & LocaleActions;

export const useLocaleStore = create<LocaleStore>((set) => ({
  locale: SSR_INITIAL_LOCALE,

  setLocale: (locale) => {
    set({ locale });
    writeSavedLocale(locale);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', locale);
    }
  },

  _initializeLocale: (locale) => {
    set({ locale });
  },
}));
