import { TableMeta, ColumnMeta } from '../../types';
import { LLMClient } from './client';

const SQL_SYSTEM_PROMPT = `你是一个 SQL 专家，负责将自然语言问题转换为 SQL 查询。

## 重要规则
1. 只返回纯 SQL 语句，不要包含任何解释或 markdown 代码块标记
2. 生成的 SQL 必须兼容 DuckDB
3. 仔细检查列名，必须使用数据库中实际存在的列名
4. 不要使用不存在的列
5. 对于日期比较，使用标准 SQL 语法
6. 对于中文字符串，正确处理编码`;

export class SQLBuilder {
  private client: LLMClient;

  constructor(client: LLMClient) {
    this.client = client;
  }

  async generateSQL(question: string, tables: TableMeta[]): Promise<string> {
    const tableInfo = tables.map(t => {
      const columns = t.columns.map(c => {
        return `  - ${c.name} (${c.type})${c.sampleValues.length > 0 ? ` 示例: ${c.sampleValues.slice(0, 3).join(', ')}` : ''}`;
      }).join('\n');
      return `表名: ${t.name}\n行数: ${t.rowCount}\n列:\n${columns}`;
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