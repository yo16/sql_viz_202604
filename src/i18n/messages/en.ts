import type { Messages } from './ja';

/**
 * 英語翻訳リソース。
 *
 * `Messages` 型（= `typeof ja`）に適合させることで、ja.ts とのキー集合一致を
 * コンパイル時に検証する。新規キー追加時は ja.ts → en.ts の順で更新する。
 *
 * 英語固定の文字列（"SQL Lineage Viz", "Small Piece", "Contact" 等）は
 * 両言語で同じ値を持つ。
 *
 * SQL clause ラベルは英語版では "clause" を省略して句名のみとする
 * （日本語版は "SELECT句" / 英語版は "SELECT"）。
 *
 * 参照: doc/design/i18n.md §6
 */
export const en: Messages = {
  header: {
    title: 'SQL Lineage Viz',
  },
  footer: {
    providerName: 'Small Piece',
    contactLabel: 'Contact',
    contactSentencePrefix: 'Feel free to ',
    contactSentenceSuffix: ' us',
  },
  languageSelector: {
    label: 'Language',
    ja: 'JA',
    en: 'EN',
  },
  button: {
    expandAll: 'Expand all',
    collapseAll: 'Collapse all',
    reset: 'Reset',
    resetAriaLabel: 'Reset all',
    parse: 'Parse',
    parsing: 'Parsing...',
    clear: 'Clear',
    clearAriaLabel: 'Clear',
  },
  panel: {
    sqlInputTitle: 'SQL input',
    sqlInputPlaceholder: 'SELECT * FROM users ...',
    ctrlEnterHint: 'Press Ctrl + Enter to run',
    fileDropPlaceholder: 'Drop .sql files here or click to select',
    fileDropDragging: 'Drop here',
    fileDropAriaLabel: 'Drop .sql files or click to select',
    removeFileAriaLabel: 'Remove {fileName}',
    dialectLabel: 'Dialect',
  },
  node: {
    queryPlaceholderTitle: '[Query]',
    subqueryPlaceholderTitle: '[Subquery]',
    unresolvedPrefix: '[Unresolved]',
    unresolvedTable: 'Unresolved table',
    inferredColumnCount: '{count} inferred columns',
    noColumnInfo: 'No column info',
    noInferredColumns: 'No inferred columns',
    clickToDetail: 'Click to expand',
    clickToCompact: 'Click to collapse',
    omittedNested: '... (omitted)',
  },
  column: {
    starOriginAriaLabel: 'From SELECT *',
    starOriginTooltip: 'Propagated from SELECT *: {name}',
    inferredAriaLabel: 'Inferred column',
  },
  clause: {
    collapse: 'Collapse',
    expand: 'Expand',
  },
  sql: {
    clauseSelect: 'SELECT',
    clauseFrom: 'FROM',
    clauseWhere: 'WHERE',
    clauseGroupBy: 'GROUP BY',
    clauseHaving: 'HAVING',
    clauseOrderBy: 'ORDER BY',
  },
  error: {
    title: 'Error',
    countSuffix: '({count})',
    clearAriaLabel: 'Clear errors',
    detailCloseAriaLabel: 'Close SQL detail',
    detailOpenAriaLabel: 'Open SQL detail',
    typeSyntaxError: 'Syntax error',
    typeUnsupportedSyntax: 'Unsupported syntax',
    typeParseError: 'Parse error',
    typeUnknown: 'Error',
    parseFailed: 'SQL syntax error',
    emptyInput: 'No SQL input',
    fileReadFailed: 'Failed to read file',
    fileReadFailedDetail: 'File read error: {message}',
    unknownError: 'Unknown error',
    invalidFileType: 'Only .sql files are accepted: {files}',
    apiRequestFailed: 'Failed to call parse API',
  },
  confirm: {
    resetAll: 'Reset all inputs?',
  },
};
