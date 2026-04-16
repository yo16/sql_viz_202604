import { en } from '@/i18n/messages/en';
import { ja } from '@/i18n/messages/ja';
import type { Messages } from '@/i18n/messages/ja';

/**
 * 全キーパスを再帰的に列挙する。
 * オブジェクトをたどり、文字列リーフのキーパスを `'a.b.c'` 形式で返す。
 */
function collectKeyPaths(obj: unknown, prefix = ''): string[] {
  if (typeof obj === 'string') {
    return [prefix];
  }
  if (obj && typeof obj === 'object') {
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
      collectKeyPaths(v, prefix ? `${prefix}.${k}` : k)
    );
  }
  return [];
}

describe('i18n/messages/en', () => {
  describe('英語固定文字列（両言語で同一値）', () => {
    it('header.title が "SQL Lineage Viz"', () => {
      expect(en.header.title).toBe('SQL Lineage Viz');
      expect(en.header.title).toBe(ja.header.title);
    });

    it('footer.providerName が "Small Piece"', () => {
      expect(en.footer.providerName).toBe('Small Piece');
      expect(en.footer.providerName).toBe(ja.footer.providerName);
    });

    it('footer.contactLabel が "Contact"', () => {
      expect(en.footer.contactLabel).toBe('Contact');
      expect(en.footer.contactLabel).toBe(ja.footer.contactLabel);
    });

    it('languageSelector.ja が "JA"（両言語共通）', () => {
      expect(en.languageSelector.ja).toBe('JA');
      expect(en.languageSelector.ja).toBe(ja.languageSelector.ja);
    });

    it('languageSelector.en が "EN"（両言語共通）', () => {
      expect(en.languageSelector.en).toBe('EN');
      expect(en.languageSelector.en).toBe(ja.languageSelector.en);
    });

    it('panel.sqlInputPlaceholder が "SELECT * FROM users ..."（両言語共通: SQL例）', () => {
      expect(en.panel.sqlInputPlaceholder).toBe('SELECT * FROM users ...');
      expect(en.panel.sqlInputPlaceholder).toBe(ja.panel.sqlInputPlaceholder);
    });
  });

  describe('SQL clause ラベル（英語版は "clause" 省略）', () => {
    const cases: Array<[keyof Messages['sql'], string]> = [
      ['clauseSelect', 'SELECT'],
      ['clauseFrom', 'FROM'],
      ['clauseWhere', 'WHERE'],
      ['clauseGroupBy', 'GROUP BY'],
      ['clauseHaving', 'HAVING'],
      ['clauseOrderBy', 'ORDER BY'],
    ];
    it.each(cases)('sql.%s が "%s"', (key, expected) => {
      expect(en.sql[key]).toBe(expected);
    });

    it('英語版は日本語版と異なる（"句" が付かない）', () => {
      expect(en.sql.clauseSelect).not.toBe(ja.sql.clauseSelect);
    });
  });

  describe('ノード関連プレースホルダ', () => {
    it('queryPlaceholderTitle が "[Query]"', () => {
      expect(en.node.queryPlaceholderTitle).toBe('[Query]');
    });

    it('subqueryPlaceholderTitle が "[Subquery]"', () => {
      expect(en.node.subqueryPlaceholderTitle).toBe('[Subquery]');
    });

    it('unresolvedPrefix が "[Unresolved]"', () => {
      expect(en.node.unresolvedPrefix).toBe('[Unresolved]');
    });

    it('unresolvedTable が "Unresolved table"', () => {
      expect(en.node.unresolvedTable).toBe('Unresolved table');
    });

    it('inferredColumnCount に {count} placeholder を含む', () => {
      expect(en.node.inferredColumnCount).toContain('{count}');
    });

    it('noColumnInfo が "No column info"', () => {
      expect(en.node.noColumnInfo).toBe('No column info');
    });

    it('noInferredColumns が "No inferred columns"', () => {
      expect(en.node.noInferredColumns).toBe('No inferred columns');
    });

    it('clickToDetail が "Click to expand"', () => {
      expect(en.node.clickToDetail).toBe('Click to expand');
    });

    it('clickToCompact が "Click to collapse"', () => {
      expect(en.node.clickToCompact).toBe('Click to collapse');
    });

    it('omittedNested が "... (omitted)"', () => {
      expect(en.node.omittedNested).toBe('... (omitted)');
    });
  });

  describe('button 名前空間', () => {
    it('expandAll', () => expect(en.button.expandAll).toBe('Expand all'));
    it('collapseAll', () => expect(en.button.collapseAll).toBe('Collapse all'));
    it('reset', () => expect(en.button.reset).toBe('Reset'));
    it('resetAriaLabel', () => expect(en.button.resetAriaLabel).toBe('Reset all'));
    it('parse', () => expect(en.button.parse).toBe('Parse'));
    it('parsing', () => expect(en.button.parsing).toBe('Parsing...'));
    it('clear', () => expect(en.button.clear).toBe('Clear'));
    it('clearAriaLabel', () => expect(en.button.clearAriaLabel).toBe('Clear'));
  });

  describe('panel 名前空間', () => {
    it('sqlInputTitle', () => expect(en.panel.sqlInputTitle).toBe('SQL input'));
    it('ctrlEnterHint', () => expect(en.panel.ctrlEnterHint).toBe('Press Ctrl + Enter to run'));
    it('fileDropPlaceholder', () => expect(en.panel.fileDropPlaceholder).toBe('Drop .sql files here or click to select'));
    it('fileDropDragging', () => expect(en.panel.fileDropDragging).toBe('Drop here'));
    it('fileDropAriaLabel', () => expect(en.panel.fileDropAriaLabel).toBe('Drop .sql files or click to select'));
    it('removeFileAriaLabel に {fileName} を含む', () => expect(en.panel.removeFileAriaLabel).toContain('{fileName}'));
    it('dialectLabel', () => expect(en.panel.dialectLabel).toBe('Dialect'));
  });

  describe('column 名前空間', () => {
    it('starOriginAriaLabel', () => expect(en.column.starOriginAriaLabel).toBe('From SELECT *'));
    it('starOriginTooltip に {name} を含む', () => expect(en.column.starOriginTooltip).toContain('{name}'));
    it('inferredAriaLabel', () => expect(en.column.inferredAriaLabel).toBe('Inferred column'));
  });

  describe('clause 名前空間', () => {
    it('collapse', () => expect(en.clause.collapse).toBe('Collapse'));
    it('expand', () => expect(en.clause.expand).toBe('Expand'));
  });

  describe('error 名前空間', () => {
    it('title', () => expect(en.error.title).toBe('Error'));
    it('countSuffix に {count} を含む', () => expect(en.error.countSuffix).toContain('{count}'));
    it('clearAriaLabel', () => expect(en.error.clearAriaLabel).toBe('Clear errors'));
    it('detailCloseAriaLabel', () => expect(en.error.detailCloseAriaLabel).toBe('Close SQL detail'));
    it('detailOpenAriaLabel', () => expect(en.error.detailOpenAriaLabel).toBe('Open SQL detail'));
    it('typeSyntaxError', () => expect(en.error.typeSyntaxError).toBe('Syntax error'));
    it('typeUnsupportedSyntax', () => expect(en.error.typeUnsupportedSyntax).toBe('Unsupported syntax'));
    it('typeParseError', () => expect(en.error.typeParseError).toBe('Parse error'));
    it('typeUnknown', () => expect(en.error.typeUnknown).toBe('Error'));
    it('parseFailed', () => expect(en.error.parseFailed).toBe('SQL syntax error'));
    it('emptyInput', () => expect(en.error.emptyInput).toBe('No SQL input'));
    it('fileReadFailed', () => expect(en.error.fileReadFailed).toBe('Failed to read file'));
    it('fileReadFailedDetail に {message} を含む', () => expect(en.error.fileReadFailedDetail).toContain('{message}'));
    it('unknownError', () => expect(en.error.unknownError).toBe('Unknown error'));
    it('invalidFileType に {files} を含む', () => expect(en.error.invalidFileType).toContain('{files}'));
    it('apiRequestFailed', () => expect(en.error.apiRequestFailed).toBe('Failed to call parse API'));
  });

  describe('confirm 名前空間', () => {
    it('resetAll', () => expect(en.confirm.resetAll).toBe('Reset all inputs?'));
  });

  describe('languageSelector の翻訳対象キー', () => {
    it('label が "Language"', () => {
      expect(en.languageSelector.label).toBe('Language');
    });
  });

  describe('footer の翻訳対象キー', () => {
    it('contactSentencePrefix', () => expect(en.footer.contactSentencePrefix).toBe('Feel free to '));
    it('contactSentenceSuffix', () => expect(en.footer.contactSentenceSuffix).toBe(' us'));
  });

  describe('キー集合の一致（ja と同一構造）', () => {
    it('ja と en の全キーパスが完全一致すること', () => {
      const jaKeys = collectKeyPaths(ja).sort();
      const enKeys = collectKeyPaths(en).sort();
      expect(enKeys).toEqual(jaKeys);
    });

    it('Messages 型として代入可能', () => {
      const messages: Messages = en;
      expect(messages).toBe(en);
    });
  });

  describe('翻訳対象キーが日本語版と異なる値を持つこと（一部抜粋）', () => {
    it('button.expandAll が ja と en で異なる', () => {
      expect(en.button.expandAll).not.toBe(ja.button.expandAll);
    });

    it('node.queryPlaceholderTitle が ja と en で異なる', () => {
      expect(en.node.queryPlaceholderTitle).not.toBe(ja.node.queryPlaceholderTitle);
    });

    it('error.parseFailed が ja と en で異なる', () => {
      expect(en.error.parseFailed).not.toBe(ja.error.parseFailed);
    });
  });
});
