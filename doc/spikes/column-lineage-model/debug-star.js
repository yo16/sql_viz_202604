/**
 * SELECT * のAST構造を確認
 */
const { Parser } = require('node-sql-parser');
const parser = new Parser();

const ast = parser.astify('SELECT * FROM table_b', { database: 'BigQuery' });
console.log('SELECT * AST columns:');
console.log(JSON.stringify(ast.columns, null, 2));
