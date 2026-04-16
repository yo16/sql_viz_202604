/**
 * 日本語翻訳リソース。
 *
 * このファイルは Messages 型のソース。`en.ts` は `Messages` 型に適合する形で記述し、
 * キー欠落をコンパイル時に検出する。
 *
 * 英語固定の文字列（"SQL Lineage Viz", "Small Piece", "Contact" 等）は
 * 両言語で同じ値を持つが、キー自体は持たせて呼出側を統一する。
 *
 * 参照: doc/design/i18n.md §6
 */
export const ja = {
  header: {
    /** ヘッダータイトル — 両言語で英語固定 */
    title: 'SQL Lineage Viz',
  },
  footer: {
    /** プロバイダ名 — 英語固定 */
    providerName: 'Small Piece',
    /** Contact リンクラベル — 英語固定 */
    contactLabel: 'Contact',
    /** Contact リンクの周辺文言 (前置き) */
    contactSentencePrefix: 'お気軽に',
    /** Contact リンクの周辺文言 (後置き) */
    contactSentenceSuffix: 'からお問い合わせください',
  },
  languageSelector: {
    /** aria-label */
    label: '言語',
    /** 日本語ボタンの表示テキスト — 両言語共通 */
    ja: 'JA',
    /** 英語ボタンの表示テキスト — 両言語共通 */
    en: 'EN',
  },
  button: {
    /** F1-4: 全部開くボタン */
    expandAll: '全部開く',
    /** F1-4: 全部閉じるボタン */
    collapseAll: '全部閉じる',
    /** F1-7: リセットボタン */
    reset: 'リセット',
    /** F1-7: リセットボタン aria-label */
    resetAriaLabel: 'すべてリセット',
    /** F1-1: パース実行ボタン */
    parse: 'パース実行',
    /** F1-1: パース実行中表示 */
    parsing: '実行中...',
    /** SQL入力欄のクリアボタン */
    clear: 'クリア',
    /** クリアボタン aria-label */
    clearAriaLabel: 'クリア',
  },
  panel: {
    /** SQL入力パネルのラベル */
    sqlInputTitle: 'SQL入力',
    /** SQL入力 textarea のプレースホルダ */
    sqlInputPlaceholder: 'SELECT * FROM users ...',
    /** Ctrl+Enter ヒント */
    ctrlEnterHint: 'Ctrl + Enter で実行',
    /** ファイルドロップゾーンのテキスト (通常時) */
    fileDropPlaceholder: '.sqlファイルをドロップ またはクリックで選択',
    /** ファイルドロップゾーンのテキスト (ドラッグ中) */
    fileDropDragging: 'ここにドロップ',
    /** ファイルドロップゾーンの aria-label */
    fileDropAriaLabel: '.sqlファイルをドロップまたはクリックで選択',
    /** ファイル削除ボタンの aria-label テンプレート ({fileName} を置換) */
    removeFileAriaLabel: '{fileName} を削除',
    /** DB方言セレクタのラベル */
    dialectLabel: 'DB方言',
  },
  node: {
    /** F1-6: 単純SELECTクエリのプレースホルダタイトル */
    queryPlaceholderTitle: '[問い合わせ]',
    /** F1-8: WHERE IN/EXISTS サブクエリのプレースホルダタイトル */
    subqueryPlaceholderTitle: '[サブクエリ]',
    /** F2-2: 未登録テーブルの表示プレフィックス (UnresolvedBoxNode の左肩) */
    unresolvedPrefix: '[未登録]',
    /** F2-2: 未登録テーブルのフルラベル */
    unresolvedTable: '未登録テーブル',
    /** F2-4: 推定カラム件数表示テンプレート ({count} を置換) */
    inferredColumnCount: '{count} 件の推定カラム',
    /** F2-4: 推定カラムなしのフォールバック (count=0) */
    noColumnInfo: 'カラム情報なし',
    /** F2-4: detail 表示で推定カラムが0件のとき */
    noInferredColumns: '推定カラムなし',
    /** F1-4: compact 表示モード時のクリックヒント (ツールチップ) */
    clickToDetail: 'クリックで詳細表示',
    /** F1-4: detail 表示モード時のクリックヒント (ツールチップ) */
    clickToCompact: 'クリックでコンパクト表示',
    /** F1-8: ネスト上限超過の省略表示 */
    omittedNested: '...（省略）',
  },
  column: {
    /** F2-5: SELECT * 由来カラムの aria-label */
    starOriginAriaLabel: 'SELECT * 由来',
    /** F2-5: SELECT * 由来カラムのツールチップテンプレート ({name} を置換) */
    starOriginTooltip: 'SELECT * から伝播: {name}',
    /** F2-4: 推定カラムの aria-label */
    inferredAriaLabel: '推定カラム',
  },
  clause: {
    /** ClauseBoxNode の縦展開 (展開状態のツールチップ) */
    collapse: '折りたたむ',
    /** ClauseBoxNode の縦展開 (折りたたみ状態のツールチップ) */
    expand: '展開',
  },
  sql: {
    /** SELECT 句ラベル — 英語版は "clause" を省略して "SELECT" のみ */
    clauseSelect: 'SELECT句',
    /** FROM 句ラベル */
    clauseFrom: 'FROM句',
    /** WHERE 句ラベル */
    clauseWhere: 'WHERE句',
    /** GROUP BY 句ラベル */
    clauseGroupBy: 'GROUP BY句',
    /** HAVING 句ラベル */
    clauseHaving: 'HAVING句',
    /** ORDER BY 句ラベル */
    clauseOrderBy: 'ORDER BY句',
  },
  error: {
    /** ErrorDisplay の見出し */
    title: 'エラー',
    /** ErrorDisplay の件数表示テンプレート ({count} を置換) */
    countSuffix: '({count}件)',
    /** ErrorDisplay のクリアボタン aria-label */
    clearAriaLabel: 'エラーをクリア',
    /** ErrorDisplay の SQL詳細展開ボタン aria-label (展開時) */
    detailCloseAriaLabel: 'SQL詳細を閉じる',
    /** ErrorDisplay の SQL詳細展開ボタン aria-label (折りたたみ時) */
    detailOpenAriaLabel: 'SQL詳細を開く',
    /** errorType ラベル: syntax_error */
    typeSyntaxError: '構文エラー',
    /** errorType ラベル: unsupported_syntax */
    typeUnsupportedSyntax: '非対応構文',
    /** errorType ラベル: parse_error */
    typeParseError: 'パースエラー',
    /** errorType ラベル: 不明なケースのフォールバック */
    typeUnknown: 'エラー',
    /** SQL構文エラーの見出し (詳細原文 = node-sql-parser 由来は英語のまま併記) */
    parseFailed: 'SQL構文エラー',
    /** 入力が空の場合 */
    emptyInput: 'SQLが入力されていません',
    /** ファイル読み込み失敗 */
    fileReadFailed: 'ファイル読み込みに失敗しました',
    /** ファイル読み込みエラーのテンプレート ({message} を置換) */
    fileReadFailedDetail: 'ファイル読み込みエラー: {message}',
    /** 不明なエラー (fileReadFailedDetail の {message} に埋め込む) */
    unknownError: '不明なエラー',
    /** 拡張子バリデーションエラーのテンプレート ({files} を置換) */
    invalidFileType: '.sql ファイルのみ受け付けます: {files}',
    /** パース API 呼び出し失敗 */
    apiRequestFailed: 'パースAPIの呼び出しに失敗しました',
  },
  confirm: {
    /** ResetButton の確認ダイアログ */
    resetAll: 'すべての入力をリセットしますか？',
  },
} as const;

/**
 * 翻訳リソースの型。`ja.ts` を正のソースとし `en.ts` はこの型に適合させる。
 *
 * `ja` は `as const` で各文字列が literal type に固定されているため、そのまま
 * `typeof ja` を使うと `en.ts` で異なる文字列を入れたときに型エラーになる。
 * 文字列型を `string` に広げる `Widen` を介して構造のみを型として抽出する。
 */
type Widen<T> = T extends string
  ? string
  : { [K in keyof T]: Widen<T[K]> };

export type Messages = Widen<typeof ja>;
