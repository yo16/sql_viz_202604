import { ja } from '@/i18n/messages/ja';
import type { Messages } from '@/i18n/messages/ja';

describe('i18n/messages/ja', () => {
  describe('英語固定文字列（両言語で同一値）', () => {
    it('header.title が "SQL Lineage Viz"', () => {
      expect(ja.header.title).toBe('SQL Lineage Viz');
    });

    it('footer.providerName が "Small Piece"', () => {
      expect(ja.footer.providerName).toBe('Small Piece');
    });

    it('footer.contactLabel が "Contact"', () => {
      expect(ja.footer.contactLabel).toBe('Contact');
    });

    it('languageSelector.ja が "JA"', () => {
      expect(ja.languageSelector.ja).toBe('JA');
    });

    it('languageSelector.en が "EN"', () => {
      expect(ja.languageSelector.en).toBe('EN');
    });
  });

  describe('footer 翻訳対象キーの値', () => {
    it('contactSentencePrefix', () => {
      expect(ja.footer.contactSentencePrefix).toBe('お気軽に');
    });

    it('contactSentenceSuffix', () => {
      expect(ja.footer.contactSentenceSuffix).toBe('からお問い合わせください');
    });
  });

  describe('languageSelector 翻訳対象キーの値', () => {
    it('label', () => {
      expect(ja.languageSelector.label).toBe('言語');
    });
  });

  describe('button 名前空間の全キー', () => {
    it('expandAll', () => {
      expect(ja.button.expandAll).toBe('全部開く');
    });

    it('collapseAll', () => {
      expect(ja.button.collapseAll).toBe('全部閉じる');
    });

    it('reset', () => {
      expect(ja.button.reset).toBe('リセット');
    });

    it('resetAriaLabel', () => {
      expect(ja.button.resetAriaLabel).toBe('すべてリセット');
    });

    it('parse', () => {
      expect(ja.button.parse).toBe('パース実行');
    });

    it('parsing', () => {
      expect(ja.button.parsing).toBe('実行中...');
    });

    it('clear', () => {
      expect(ja.button.clear).toBe('クリア');
    });

    it('clearAriaLabel', () => {
      expect(ja.button.clearAriaLabel).toBe('クリア');
    });
  });

  describe('panel 名前空間の全キー', () => {
    it('sqlInputTitle', () => {
      expect(ja.panel.sqlInputTitle).toBe('SQL入力');
    });

    it('sqlInputPlaceholder', () => {
      expect(ja.panel.sqlInputPlaceholder).toBe('SELECT * FROM users ...');
    });

    it('ctrlEnterHint', () => {
      expect(ja.panel.ctrlEnterHint).toBe('Ctrl + Enter で実行');
    });

    it('fileDropPlaceholder', () => {
      expect(ja.panel.fileDropPlaceholder).toBe('.sqlファイルをドロップ またはクリックで選択');
    });

    it('fileDropDragging', () => {
      expect(ja.panel.fileDropDragging).toBe('ここにドロップ');
    });

    it('fileDropAriaLabel', () => {
      expect(ja.panel.fileDropAriaLabel).toBe('.sqlファイルをドロップまたはクリックで選択');
    });

    it('removeFileAriaLabel に {fileName} placeholder を含む', () => {
      expect(ja.panel.removeFileAriaLabel).toContain('{fileName}');
    });

    it('dialectLabel', () => {
      expect(ja.panel.dialectLabel).toBe('DB方言');
    });
  });

  describe('node 名前空間の全キー', () => {
    it('queryPlaceholderTitle', () => {
      expect(ja.node.queryPlaceholderTitle).toBe('[問い合わせ]');
    });

    it('subqueryPlaceholderTitle', () => {
      expect(ja.node.subqueryPlaceholderTitle).toBe('[サブクエリ]');
    });

    it('unresolvedPrefix', () => {
      expect(ja.node.unresolvedPrefix).toBe('[未登録]');
    });

    it('unresolvedTable', () => {
      expect(ja.node.unresolvedTable).toBe('未登録テーブル');
    });

    it('inferredColumnCount に {count} placeholder を含む', () => {
      expect(ja.node.inferredColumnCount).toContain('{count}');
    });

    it('noColumnInfo', () => {
      expect(ja.node.noColumnInfo).toBe('カラム情報なし');
    });

    it('noInferredColumns', () => {
      expect(ja.node.noInferredColumns).toBe('推定カラムなし');
    });

    it('clickToDetail', () => {
      expect(ja.node.clickToDetail).toBe('クリックで詳細表示');
    });

    it('clickToCompact', () => {
      expect(ja.node.clickToCompact).toBe('クリックでコンパクト表示');
    });

    it('omittedNested', () => {
      expect(ja.node.omittedNested).toBe('...（省略）');
    });
  });

  describe('column 名前空間の全キー', () => {
    it('starOriginAriaLabel', () => {
      expect(ja.column.starOriginAriaLabel).toBe('SELECT * 由来');
    });

    it('starOriginTooltip に {name} placeholder を含む', () => {
      expect(ja.column.starOriginTooltip).toContain('{name}');
    });

    it('inferredAriaLabel', () => {
      expect(ja.column.inferredAriaLabel).toBe('推定カラム');
    });
  });

  describe('clause 名前空間の全キー', () => {
    it('collapse', () => {
      expect(ja.clause.collapse).toBe('折りたたむ');
    });

    it('expand', () => {
      expect(ja.clause.expand).toBe('展開');
    });
  });

  describe('sql 名前空間の全キー（日本語版は "句" 付き）', () => {
    const cases: Array<[keyof Messages['sql'], string]> = [
      ['clauseSelect', 'SELECT句'],
      ['clauseFrom', 'FROM句'],
      ['clauseWhere', 'WHERE句'],
      ['clauseGroupBy', 'GROUP BY句'],
      ['clauseHaving', 'HAVING句'],
      ['clauseOrderBy', 'ORDER BY句'],
    ];
    it.each(cases)('sql.%s が "%s"', (key, expected) => {
      expect(ja.sql[key]).toBe(expected);
    });
  });

  describe('error 名前空間の全キー', () => {
    it('title', () => {
      expect(ja.error.title).toBe('エラー');
    });

    it('countSuffix に {count} placeholder を含む', () => {
      expect(ja.error.countSuffix).toContain('{count}');
    });

    it('clearAriaLabel', () => {
      expect(ja.error.clearAriaLabel).toBe('エラーをクリア');
    });

    it('detailCloseAriaLabel', () => {
      expect(ja.error.detailCloseAriaLabel).toBe('SQL詳細を閉じる');
    });

    it('detailOpenAriaLabel', () => {
      expect(ja.error.detailOpenAriaLabel).toBe('SQL詳細を開く');
    });

    it('typeSyntaxError', () => {
      expect(ja.error.typeSyntaxError).toBe('構文エラー');
    });

    it('typeUnsupportedSyntax', () => {
      expect(ja.error.typeUnsupportedSyntax).toBe('非対応構文');
    });

    it('typeParseError', () => {
      expect(ja.error.typeParseError).toBe('パースエラー');
    });

    it('typeUnknown', () => {
      expect(ja.error.typeUnknown).toBe('エラー');
    });

    it('parseFailed', () => {
      expect(ja.error.parseFailed).toBe('SQL構文エラー');
    });

    it('emptyInput', () => {
      expect(ja.error.emptyInput).toBe('SQLが入力されていません');
    });

    it('fileReadFailed', () => {
      expect(ja.error.fileReadFailed).toBe('ファイル読み込みに失敗しました');
    });

    it('fileReadFailedDetail に {message} placeholder を含む', () => {
      expect(ja.error.fileReadFailedDetail).toContain('{message}');
    });

    it('unknownError', () => {
      expect(ja.error.unknownError).toBe('不明なエラー');
    });

    it('invalidFileType に {files} placeholder を含む', () => {
      expect(ja.error.invalidFileType).toContain('{files}');
    });

    it('apiRequestFailed', () => {
      expect(ja.error.apiRequestFailed).toBe('パースAPIの呼び出しに失敗しました');
    });
  });

  describe('confirm 名前空間の全キー', () => {
    it('resetAll', () => {
      expect(ja.confirm.resetAll).toBe('すべての入力をリセットしますか？');
    });
  });

  describe('Messages 型', () => {
    it('Messages 型として代入可能', () => {
      const messages: Messages = ja;
      expect(messages).toBe(ja);
    });

    it('全トップレベル名前空間が存在', () => {
      expect(ja.header).toBeDefined();
      expect(ja.footer).toBeDefined();
      expect(ja.languageSelector).toBeDefined();
      expect(ja.button).toBeDefined();
      expect(ja.panel).toBeDefined();
      expect(ja.node).toBeDefined();
      expect(ja.column).toBeDefined();
      expect(ja.clause).toBeDefined();
      expect(ja.sql).toBeDefined();
      expect(ja.error).toBeDefined();
      expect(ja.confirm).toBeDefined();
    });
  });
});
