import type { TableNode } from '@/types/lineage';

/**
 * SELECT * のカラムを上流テーブルから伝播する。
 *
 * 対応機能要件: F2-5
 * 処理順: トポロジカルソート順（上流 → 下流）
 */
export function propagateSelectStar(
  tables: Map<string, TableNode>
): Map<string, TableNode> {
  const sortedTableIds = topologicalSort(tables);

  for (const tableId of sortedTableIds) {
    const table = tables.get(tableId);
    if (!table) continue;

    const starColumns = Array.from(table.columns.values())
      .filter((col) => col.isFromStar);

    for (const starCol of starColumns) {
      if (starCol.exprType === 'star') {
        expandStar(table, tables);
      } else if (starCol.exprType === 'table_star') {
        const sourceTableId = starCol.dependencies[0]?.sourceTableId;
        if (sourceTableId) {
          expandTableStar(table, sourceTableId, tables);
        }
      }
    }
  }

  return tables;
}

/**
 * SELECT * を展開し、FROM の全テーブルのカラムを伝播する。
 */
export function expandStar(
  targetTable: TableNode,
  allTables: Map<string, TableNode>
): void {
  targetTable.columns.delete('*');

  for (const sourceTableId of targetTable.dependsOn) {
    const sourceTable = allTables.get(sourceTableId);
    if (!sourceTable) continue;

    for (const [colName] of sourceTable.columns) {
      if (!targetTable.columns.has(colName)) {
        targetTable.columns.set(colName, {
          columnName: colName,
          tableId: targetTable.id,
          certainty: 'propagated',
          dependencies: [{
            sourceTableId: sourceTableId,
            sourceColumn: colName,
            type: 'star',
          }],
          isFromStar: true,
          exprType: 'column_ref',
        });
      }
    }
  }
}

/**
 * SELECT t.* を展開し、指定テーブルのカラムのみ伝播する。
 */
export function expandTableStar(
  targetTable: TableNode,
  sourceTableId: string,
  allTables: Map<string, TableNode>
): void {
  const sourceTable = allTables.get(sourceTableId);
  if (!sourceTable) return;

  // t.* カラムを削除（displayName が "テーブル名.*" 形式のものを探す）
  for (const [key, col] of targetTable.columns) {
    if (col.exprType === 'table_star' && col.dependencies[0]?.sourceTableId === sourceTableId) {
      targetTable.columns.delete(key);
      break;
    }
  }

  for (const [colName] of sourceTable.columns) {
    if (!targetTable.columns.has(colName)) {
      targetTable.columns.set(colName, {
        columnName: colName,
        tableId: targetTable.id,
        certainty: 'propagated',
        dependencies: [{
          sourceTableId: sourceTableId,
          sourceColumn: colName,
          type: 'star',
        }],
        isFromStar: true,
        exprType: 'column_ref',
      });
    }
  }
}

/**
 * テーブル間の依存関係からトポロジカルソートを実行する。
 * 循環依存がある場合は警告を返し、処理を続行する。
 */
export function topologicalSort(
  tables: Map<string, TableNode>
): string[] {
  const visited = new Set<string>();
  const visiting = new Set<string>(); // 循環検出用
  const sorted: string[] = [];

  function visit(tableId: string) {
    if (visited.has(tableId)) return;
    if (visiting.has(tableId)) {
      // 循環依存を検出 — スキップして続行
      return;
    }

    visiting.add(tableId);

    const table = tables.get(tableId);
    if (table) {
      for (const depId of table.dependsOn) {
        visit(depId);
      }
    }

    visiting.delete(tableId);
    visited.add(tableId);
    sorted.push(tableId);
  }

  for (const tableId of tables.keys()) {
    visit(tableId);
  }

  return sorted;
}
