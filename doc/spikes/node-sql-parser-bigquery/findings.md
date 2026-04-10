# スパイク1: node-sql-parser BigQuery対応検証 — 結論

## 結論

**node-sql-parserはBigQuery対応パーサーとして採用可能。** 要件定義の対象範囲（SELECT/FROM/JOIN/WHERE/GROUP BY/HAVING/ORDER BY/CTE/サブクエリ/CTAS）はすべてパース可能。BigQuery固有構文も大部分に対応。非対応構文はDWHリネージュの主要ユースケースには影響が小さい。

## 検証結果サマリ

### 対応確認済み（要件定義の対象範囲）

| 構文 | 結果 | 備考 |
|---|---|---|
| SELECT / FROM / WHERE | ✅ | |
| JOIN (INNER/LEFT/RIGHT/FULL) | ✅ | |
| GROUP BY / HAVING | ✅ | |
| ORDER BY / LIMIT | ✅ | |
| CTE (WITH句、複数CTE) | ✅ | |
| サブクエリ (FROM/WHERE IN/EXISTS) | ✅ | 3段ネストも確認 |
| CREATE TABLE AS SELECT | ✅ | バッククォート識別子対応 |
| CASE式 | ✅ | |
| ウィンドウ関数 | ✅ | |

### 対応確認済み（BigQuery固有）

| 構文 | 結果 | 備考 |
|---|---|---|
| バッククォート識別子 | ✅ | `project.dataset.table` 形式 |
| STRUCT リテラル / アクセス | ✅ | |
| ARRAY / ARRAY_AGG | ✅ | |
| UNNEST | ✅ | カンマJOIN/CROSS JOIN形式、WITH OFFSET対応 |
| SAFE_CAST | ✅ | |
| IF / COUNTIF | ✅ | |
| SELECT * EXCEPT / REPLACE | ✅ | |
| STRING_AGG / GENERATE_ARRAY | ✅ | |
| PIVOT | ✅ | |
| QUALIFY | ⚠️ | WHERE句後に式を直接書く形式のみ対応。エイリアス参照は不可 |
| TABLESAMPLE | ⚠️ | BERNOULLI(PERCENT付き)とRESERVOIRのみ。SYSTEMは不可 |

### 非対応

| 構文 | 影響度 | 対策 |
|---|---|---|
| MERGE文 | 低 | リネージュ対象はSELECT/CTAS系。MERGEは対象外としてエラー表示 |
| WITH RECURSIVE | 低 | RECURSIVEキーワードを除去すればパース可能。前処理で対応可 |
| UNPIVOT | 低 | PIVOTは対応済。UNPIVOTは利用頻度が低い。エラー表示で対応 |
| UNNEST AS u(val) 形式 | 低 | AS val 形式なら対応。実用上の問題は小さい |

## AST構造の評価

リネージュ抽出に必要な情報はAST内に十分含まれている:

- **columns**: `column_ref` に `table` と `column` が分離されており、出自テーブルの特定が容易
- **from**: テーブル名、エイリアス、JOIN種別、ON条件が構造化されている
- **with (CTE)**: `name` + `stmt.ast` で再帰的にパース済み。CTE名とその内部構造を両方取得可能
- **CTAS**: `type="create"`, `query_expr` にSELECT文のASTが格納。テーブル名とSELECT構造を一括取得可能
- **aggr_func**: 関数名と引数が分離。集約関数内のカラム参照も追跡可能

## 設計への推奨事項

1. **database オプション**: パース時に `{ database: 'BigQuery' }` を必ず指定する
2. **WITH RECURSIVE**: 前処理で `WITH RECURSIVE` → `WITH` に置換するユーティリティを用意
3. **エラーハンドリング**: MERGE/UNPIVOT等の非対応構文は、パースエラー時に「この構文はサポート対象外です」と明示するUIを設計
4. **QUALIFY**: エイリアス参照（`QUALIFY rn = 1`）が使えないことをドキュメント化。式を直接書く形式は対応済みなので実用上は問題なし
