import { NextRequest, NextResponse } from 'next/server';
import { validateParseRequest } from '@/lib/validators/sqlInputValidator';
import { parseSql, splitStatements, classifyError, toUserFriendlyMessage } from '@/lib/parser/sqlParser';
import { extractQueryStructure } from '@/lib/parser/astExtractor';
import type { ParsedQuery, ParseError, ParseResponse, SqlDialect } from '@/types/api';

/**
 * POST /api/parse — SQL文字列をパースし構造化データを返す。
 *
 * パイプライン:
 * 1. リクエストボディ取得
 * 2. バリデーション (sqlInputValidator)
 * 3. SQL分割 (splitStatements)
 * 4. 各ステートメントをパース (parseSql → extractQueryStructure)
 * 5. 成功分は queries、失敗分は errors に格納して返却
 *
 * 設計参照: doc/design/api-design.md セクション5
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. リクエストボディ取得
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'リクエストボディのJSON解析に失敗しました',
          details: { field: 'body', constraint: 'json' },
        },
        { status: 400 }
      );
    }

    // 2. バリデーション
    const validation = validateParseRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: validation.error!.message,
          details: validation.error,
        },
        { status: 400 }
      );
    }

    const { sql, dialect = 'BigQuery' } = body as { sql: string; dialect?: SqlDialect };

    // 3. SQL分割（セミコロン区切り）
    const statements = splitStatements(sql);

    if (statements.length === 0) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'SQL文字列が空です',
          details: { field: 'sql', constraint: 'required' },
        },
        { status: 400 }
      );
    }

    // 4. 各ステートメントをパース
    const queries: ParsedQuery[] = [];
    const errors: ParseError[] = [];

    for (const stmt of statements) {
      try {
        const ast = parseSql(stmt, dialect);
        const parsed = extractQueryStructure(ast, stmt);
        queries.push(parsed);
      } catch (e) {
        errors.push({
          rawSql: stmt,
          message: toUserFriendlyMessage(e, stmt),
          errorType: classifyError(e, stmt),
        });
      }
    }

    // 5. レスポンス
    const response: ParseResponse = { queries, errors };
    return NextResponse.json(response);
  } catch {
    // 予期しないサーバーエラー
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: 'パース処理中に予期しないエラーが発生しました',
      },
      { status: 500 }
    );
  }
}
