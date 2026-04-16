import { useLocaleStore } from '@/stores/localeStore';
import { getMessages } from './messages';
import type { Messages } from './messages';
import type { Locale } from './types';

export interface UseLocaleResult {
  /** 現在の locale */
  locale: Locale;
  /** 現在の locale に対応する翻訳リソース（設計 §7 のキー名 `t`） */
  t: Messages;
  /** locale を切り替える（ストア + localStorage + <html lang> を同時更新） */
  setLocale: (locale: Locale) => void;
}

/**
 * 現在の locale と対応する翻訳リソースを取得するフック。
 *
 * 設計参照: doc/design/i18n.md §7
 *
 * 使用例:
 * ```tsx
 * const { t, locale, setLocale } = useLocale();
 * return <h1>{t.header.title}</h1>;
 * ```
 */
export function useLocale(): UseLocaleResult {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const t = getMessages(locale);
  return { locale, t, setLocale };
}
