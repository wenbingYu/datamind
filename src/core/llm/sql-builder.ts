import { TableMeta, ColumnMeta } from '../../types';
import { LLMClient } from './client';

const SQL_SYSTEM_PROMPT = `你是一个 SQL 专家，负责将自然语言问题转换为 SQL 查询。

## 重要规则
1. 只返回纯 SQL 语句，不要包含任何解释或 markdown 代码块标记
2. 生成的 SQL 必须兼容 DuckDB
3. 仔细检查列名，必须使用数据库中实际存在的列名
4. 不要使用不存在的列
5. 对于日期比较，使用标准 SQL 语法
6. 对于中文字符串，正确处理编码
7. 根据用户问题和表结构，生成最合适的 SQL 查询`;

export class SQLBuilder {
  private client: LLMClient;

  constructor(client: LLMClient) {
    this.client = client;
  }

  async generateSQL(question: string, tables: TableMeta[]): Promise<string> {
    // 分离正常表和 UUID 格式表
    const normalTables = tables.filter(t => {
      if (t.rowCount === 0) return false;
      // 检查表名是否像 UUID（纯十六进制）
      return !/^[a-f0-9]{32,}$/i.test(t.name);
    });

    const uuidTables = tables.filter(t => {
      if (t.rowCount === 0) return false;
      // UUID 格式的表名
      return /^[a-f0-9]{32,}$/i.test(t.name);
    });

    // 优先使用正常表，如果没有再使用 UUID 表
    let tablesToUse = normalTables.length > 0 ? normalTables : uuidTables;

    // 限制表的数量，避免 prompt 过长
    const maxTables = 3;
    tablesToUse = tablesToUse.slice(0, maxTables);

    if (tablesToUse.length === 0) {
      return "SELECT '没有可用的数据表' AS message";
    }

    const tableInfo = tablesToUse.map(t => {
      // 限制列的数量，避免 prompt 过长
      const maxColumns = 20;
      const columns = t.columns.slice(0, maxColumns).map(c => {
        const samples = c.sampleValues.length > 0 ? ` 示例: ${c.sampleValues.slice(0, 2).join(', ')}` : '';
        return `  - ${c.name} (${c.type})${samples}`;
      }).join('\n');
      const moreCols = t.columns.length > maxColumns ? `\n  ... 共 ${t.columns.length} 列` : '';
      return `表名: ${t.name}\n行数: ${t.rowCount}\n列:\n${columns}${moreCols}`;
    }).join('\n\n');

    const prompt = `## 数据库 Schema

${tableInfo}

## 用户问题
${question}

请生成 SQL 查询语句。只返回 SQL，不要任何解释或代码块标记。`;

    const response = await this.client.chat(prompt, SQL_SYSTEM_PROMPT);
    
    // Clean up the response - remove markdown code blocks if present
    let sql = response.trim();
    sql = sql.replace(/```sql\s*/gi, '');
    sql = sql.replace(/```\s*/g, '');
    sql = sql.trim();
    
    // Validate SQL - check for dangerous operations
    const lowerSQL = sql.toLowerCase();
    if (lowerSQL.includes('drop ') || lowerSQL.includes('delete ') || lowerSQL.includes('truncate ')) {
      throw new Error('安全限制：不允许执行删除操作');
    }
    
    return sql;
  }

  async explainSQL(sql: string, result: any[]): Promise<string> {
    const prompt = `## SQL 查询
${sql}

## 查询结果
${JSON.stringify(result.slice(0, 10), null, 2)}

请用中文简洁解释这个查询的结果。`;

    return await this.client.chat(prompt);
  }
}