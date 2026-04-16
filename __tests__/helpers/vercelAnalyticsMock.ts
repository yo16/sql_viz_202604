/**
 * @vercel/analytics/next の Jest モック。
 *
 * 本体は ESM（.mjs）のみ配布されており ts-jest のデフォルト設定で解釈できないため、
 * テスト環境では描画しない空コンポーネントに置き換える。
 * プロダクション動作（Vercel Analytics 送信）はランタイムでのみ有効。
 */
import type { ReactElement } from 'react';

export function Analytics(): ReactElement | null {
  return null;
}
