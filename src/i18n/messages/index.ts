import type { Locale } from '../types';
import { ja } from './ja';
import { en } from './en';
import type { Messages } from './ja';

export type { Messages } from './ja';
export { ja, en };

/**
 * locale → 翻訳リソースのマップ。
 */
export const messages: Record<Locale, Messages> = {
  ja,
  en,
};

/**
 * 指定の locale に対応する翻訳リソースを返す。
 */
export function getMessages(locale: Locale): Messages {
  return messages[locale];
}
