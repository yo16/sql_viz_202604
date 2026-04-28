// @jest-environment node
/**
 * ビルド成果物検証テスト
 *
 * next build --webpack で生成されたチャンクファイル名に `~` が含まれないことを検証する。
 * next.config.ts の webpack カスタム設定が正しく機能しているかを確認。
 *
 * 前提条件: テスト実行前に `npm run build` を実行し、`.next/static/` が存在すること。
 *
 * 注意: ディレクトリ名は `build-output` としている。`build` は `.gitignore` の
 *       `build/` パターンにマッチして除外されるため。
 */

import { existsSync, readdirSync, lstatSync } from 'node:fs';
import { join, basename, relative } from 'node:path';

const STATIC_DIR = join(process.cwd(), '.next', 'static');

function listFilesRecursive(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = lstatSync(full);
    if (stat.isSymbolicLink()) {
      // 循環参照防止のため symlink は辿らず、リンク自体を1ファイルとしてカウント
      out.push(full);
      continue;
    }
    if (stat.isDirectory()) {
      out.push(...listFilesRecursive(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

describe('build artifacts: no tilde in filenames', () => {
  it('should have no files containing "~" in their basenames under .next/static', () => {
    if (!existsSync(STATIC_DIR)) {
      throw new Error(
        '.next/static が存在しません。テスト実行前に `npm run build` を実行してください。\n' +
        `Expected directory: ${STATIC_DIR}`
      );
    }

    const allFiles = listFilesRecursive(STATIC_DIR);

    expect(allFiles.length).toBeGreaterThan(0); // ビルドが実行されていることの確認

    const offenders = allFiles
      .filter((f) => basename(f).includes('~'))
      .map((f) => relative(STATIC_DIR, f));

    expect(offenders).toEqual([]);
  });
});
