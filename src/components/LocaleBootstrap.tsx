"use client";

import { useEffect } from 'react';
import { useLocaleStore } from '@/stores/localeStore';
import { resolveInitialLocale } from '@/i18n/resolveInitialLocale';

/**
 * クライアント側で初期 locale を解決し `localeStore` に反映する副作用専用コンポーネント。
 *
 * 設計参照: doc/design/i18n.md §8.4
 *
 * 責務:
 * - hydration 後の `useEffect` で `resolveInitialLocale()` を実行し、
 *   `_initializeLocale` でストアに初期 locale を反映する
 * - DOM (`<html lang>`) および `localStorage` には**触らない**
 *   （DOM は `<body>` 直後のインラインスクリプトが既に確定済みのため）
 *
 * レンダリング結果は null。
 */
export function LocaleBootstrap(): null {
  useEffect(() => {
    const initial = resolveInitialLocale();
    useLocaleStore.getState()._initializeLocale(initial);
  }, []);

  return null;
}
