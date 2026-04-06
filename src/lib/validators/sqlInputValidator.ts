import type { SqlDialect } from '@/types/api';

/** SQL文字列の最大長 */
export const SQL_MAX_LENGTH = 100_000;

/** 有効なDB方言の一覧 */
export const VALID_DIALECTS: SqlDialect[] = ['BigQuery', 'PostgreSQL', 'MySQL', 'SQLite'];

/** バリデーション結果 */
export interface ValidationResult {
  valid: boolean;
  error?: {
    field: string;
    message: string;
    constraint: string;
  };
}

/**
 * POST /api/parse のリクエストボディをバリデーションする。
 *
 * バリデーション順序:
 * 1. body が object であること
 * 2. sql フィールドが string であること
 * 3. sql が空文字列でないこと（トリム後）
 * 4. sql が 100,000 文字以内であること
 * 5. dialect が指定されていれば SqlDialect のいずれかであること
 */
export function validateParseRequest(body: unknown): ValidationResult {
  // 1. body が object であること
  if (body === null || typeof body !== 'object') {
    return {
      valid: false,
      error: {
        field: 'body',
        message: 'リクエストボディが不正です',
        constraint: 'object',
      },
    };
  }

  const obj = body as Record<string, unknown>;

  // 2. sql フィールドが string であること
  if (typeof obj.sql !== 'string') {
    return {
      valid: false,
      error: {
        field: 'sql',
        message: 'SQL文字列が空です',
        constraint: 'required',
      },
    };
  }

  // 3. sql が空文字列でないこと（トリム後）
  if (obj.sql.trim().length === 0) {
    return {
      valid: false,
      error: {
        field: 'sql',
        message: 'SQL文字列が空です',
        constraint: 'required',
      },
    };
  }

  // 4. sql が 100,000 文字以内であること
  if (obj.sql.length > SQL_MAX_LENGTH) {
    return {
      valid: false,
      error: {
        field: 'sql',
        message: `SQL文字列が長すぎます（最大${SQL_MAX_LENGTH.toLocaleString()}文字）`,
        constraint: 'max_length',
      },
    };
  }

  // 5. dialect が指定されていれば SqlDialect のいずれかであること
  if (obj.dialect !== undefined) {
    if (typeof obj.dialect !== 'string' || !VALID_DIALECTS.includes(obj.dialect as SqlDialect)) {
      return {
        valid: false,
        error: {
          field: 'dialect',
          message: `サポートされていないDB方言です: ${String(obj.dialect)}`,
          constraint: 'enum',
        },
      };
    }
  }

  return { valid: true };
}
