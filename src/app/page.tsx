import { MainView } from '@/components/layout/MainView';

/**
 * メインページ。
 *
 * Server Component として静的シェルを提供し、
 * インタラクティブな MainView は "use client" で分離されている。
 *
 * 設計参照: doc/design/component-design.md セクション1 (コンポーネントツリー)
 */
export default function Home() {
  return <MainView />;
}
