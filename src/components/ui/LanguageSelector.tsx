"use client";

import { useLocale } from '@/i18n/useLocale';
import type { Locale } from '@/i18n/types';
import { SUPPORTED_LOCALES } from '@/i18n/types';
import styles from './LanguageSelector.module.css';

/**
 * 言語切替トグル（JA / EN）。
 *
 * 対応要件: FI-1 (言語切替UI)
 * 設計参照: doc/design/i18n.md §9, doc/design/component-design.md §2.6
 *
 * 責務:
 * - 現在の locale を useLocale() から取得し、対応ボタンを aria-pressed=true で強調
 * - クリックで setLocale() を呼び出す（ストア + localStorage + <html lang> を同時更新）
 * - aria-label と aria-pressed でアクセシビリティ対応
 *
 * DOM / localStorage の更新は setLocale が内部で行う（本コンポーネントは UI のみ）。
 */
export function LanguageSelector() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div className={styles.container} role="group" aria-label={t.languageSelector.label}>
      {SUPPORTED_LOCALES.map((target: Locale) => {
        const isActive = target === locale;
        const labelText = t.languageSelector[target];
        return (
          <button
            key={target}
            type="button"
            className={styles.button}
            aria-pressed={isActive}
            aria-label={labelText}
            onClick={() => setLocale(target)}
          >
            {labelText}
          </button>
        );
      })}
    </div>
  );
}
