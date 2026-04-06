import { useLineageStore } from './lineageStore';
import { useFlowStore } from './flowStore';

/**
 * ストア間の購読設定を初期化する。
 *
 * lineageStore の状態変更（tables の更新）を flowStore が購読し、
 * syncFromLineage でノード/エッジを自動再生成する。
 *
 * この関数はアプリケーション起動時に1回だけ呼び出す。
 * 設計参照: doc/design/component-design.md セクション6.2「ストア間の連携」
 *
 * @returns unsubscribe 関数（テストやクリーンアップ用）
 */
export function initStoreSubscriptions(): () => void {
  const unsubscribe = useLineageStore.subscribe((state) => {
    useFlowStore.getState().syncFromLineage(state.tables);
  });

  return unsubscribe;
}
