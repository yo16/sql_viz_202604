/** サポートするロケールのユニオン型 */
export type Locale = 'ja' | 'en';

/** サポートするロケールの一覧 */
export const SUPPORTED_LOCALES: readonly Locale[] = ['ja', 'en'] as const;

/**
 * SSR 時の初期 locale。
 * metadata 英語固定および SSR `<html lang="en">` と整合させるため "en"。
 * Zustand localeStore の初期値もこの値を使う。
 */
export const SSR_INITIAL_LOCALE: Locale = 'en';

/**
 * クライアント側で navigator.language が取得できないときのフォールバック (FI-2)。
 * 要件定義により "ja" で固定。SSR 初期値とは独立した概念。
 */
export const NAVIGATOR_UNAVAILABLE_FALLBACK: Locale = 'ja';

/**
 * 翻訳リソースで未定義キーが参照されたときのフォールバック (FI-4)。
 * 英語リソースを最終フォールバックとする。
 */
export const MESSAGE_FALLBACK_LOCALE: Locale = 'en';
