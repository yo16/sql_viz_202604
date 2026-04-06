import { Parser } from 'node-sql-parser';
import type { AST, Option } from 'node-sql-parser';
import type { SqlDialect } from '@/types/api';

/** node-sql-parser の database オプション値への変換マップ */
const DIALECT_MAP: Record<SqlDialect, string> = {
  BigQuery: 'BigQuery',
  PostgreSQL: 'PostgreSQL',
  MySQL: 'MySQL',
  SQLite: 'SQLite',
};

/** 非対応構文のパターン */
const UNSUPPORTED_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /^MERGE\s/i,
    message: 'MERGE文はサポート対象外です。SELECT文またはCREATE TABLE AS SELECT文を入力してください。',
  },
  {
    pattern: /UNPIVOT/i,
    message: 'UNPIVOT構文はサポート対象外です。',
  },
];

/** パーサーのシングルトンインスタンス */
const parser = new Parser();

/**
 * WITH RECURSIVE を WITH に置換する前処理。
 * node-sql-parser が WITH RECURSIVE を正しくパースできない場合の対策。
 */
export function preprocessSql(sql: string): string {
  return sql.replace(/WITH\s+RECURSIVE\b/gi, 'WITH');
}

/**
 * SQL文字列から非対応構文を検出する。
 * 検出された場合はユーザーフレンドリーなエラーメッセージを返す。
 */
export function detectUnsupportedSyntax(sql: string): string | null {
  const trimmed = sql.trim();
  for (const { pattern, message } of UNSUPPORTED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return message;
    }
  }
  return null;
}

/**
 * SQL文字列をパースしてASTを返す。
 *
 * @param sql - パース対象のSQL文字列（単一ステートメント）
 * @param dialect - DB方言（デフォルト: 'BigQuery'）
 * @returns AST（Abstract Syntax Tree）
 * @throws パースエラーまたは非対応構文エラー
 */
export function parseSql(sql: string, dialect: SqlDialect = 'BigQuery'): AST | AST[] {
  // 1. 非対応構文チェック
  const unsupported = detectUnsupportedSyntax(sql);
  if (unsupported) {
    const error = new Error(unsupported);
    (error as Error & { type: string }).type = 'unsupported_syntax';
    throw error;
  }

  // 2. 前処理
  const preprocessed = preprocessSql(sql);

  // 3. パース実行
  const opt: Option = {
    database: DIALECT_MAP[dialect],
  };

  return parser.astify(preprocessed, opt);
}

/**
 * SQL文字列をセミコロンで分割する。
 * 文字列リテラル内のセミコロンは分割しない。
 * 空白のみのステートメントはスキップする。
 */
export function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const next = sql[i + 1];

    // ラインコメント処理
    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
      }
      current += char;
      continue;
    }

    // ブロックコメント処理
    if (inBlockComment) {
      current += char;
      if (char === '*' && next === '/') {
        current += next;
        i++;
        inBlockComment = false;
      }
      continue;
    }

    // シングルクォート文字列内
    if (inSingleQuote) {
      current += char;
      if (char === "'" && next === "'") {
        current += next;
        i++; // エスケープされたクォート
      } else if (char === "'") {
        inSingleQuote = false;
      }
      continue;
    }

    // ダブルクォート文字列内
    if (inDoubleQuote) {
      current += char;
      if (char === '"' && next === '"') {
        current += next;
        i++;
      } else if (char === '"') {
        inDoubleQuote = false;
      }
      continue;
    }

    // コメント開始検出
    if (char === '-' && next === '-') {
      inLineComment = true;
      current += char;
      continue;
    }
    if (char === '/' && next === '*') {
      inBlockComment = true;
      current += char + next;
      i++;
      continue;
    }

    // クォート開始検出
    if (char === "'") {
      inSingleQuote = true;
      current += char;
      continue;
    }
    if (char === '"') {
      inDoubleQuote = true;
      current += char;
      continue;
    }

    // セミコロンで分割
    if (char === ';') {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }

    current += char;
  }

  // 最後のステートメント
  const trimmed = current.trim();
  if (trimmed.length > 0) {
    statements.push(trimmed);
  }

  return statements;
}

/**
 * エラーを分類する。
 */
export function classifyError(error: unknown, sql: string): 'syntax_error' | 'unsupported_syntax' | 'parse_error' {
  if (error instanceof Error) {
    if ((error as Error & { type?: string }).type === 'unsupported_syntax') {
      return 'unsupported_syntax';
    }
  }
  // 非対応構文チェック
  if (detectUnsupportedSyntax(sql)) {
    return 'unsupported_syntax';
  }
  return 'syntax_error';
}

/**
 * エラーメッセージをユーザーフレンドリーに変換する。
 */
export function toUserFriendlyMessage(error: unknown, sql: string): string {
  if (error instanceof Error) {
    if ((error as Error & { type?: string }).type === 'unsupported_syntax') {
      return error.message;
    }
  }
  // 非対応構文のメッセージ
  const unsupported = detectUnsupportedSyntax(sql);
  if (unsupported) {
    return unsupported;
  }
  // 一般的なパースエラー
  if (error instanceof Error) {
    return `SQL構文エラー: ${error.message}`;
  }
  return 'SQL構文エラー: パースに失敗しました';
}
