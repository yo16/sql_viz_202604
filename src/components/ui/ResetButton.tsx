"use client";

import { useLineageStore } from '@/stores/lineageStore';
import styles from './ResetButton.module.css';

/**
 * 全状態リセットボタン。
 *
 * 対応機能要件: F1-7
 * 設計参照: doc/design/component-design.md セクション2.5
 *
 * lineageStore.resetAll() を呼び出し、flowStore も連動してクリアされる。
 * 誤操作防止のため確認ダイアログを表示してから実行する。
 */
export function ResetButton() {
  const resetAll = useLineageStore((s) => s.resetAll);

  const handleClick = () => {
    const confirmed = window.confirm('すべての入力をリセットしますか？');
    if (confirmed) {
      resetAll();
    }
  };

  return (
    <button
      type="button"
      className={styles.button}
      onClick={handleClick}
      aria-label="すべてリセット"
    >
      リセット
    </button>
  );
}
