import { TableMeta, ColumnMeta } from '../../types';
import { LLMClient } from './client';

const SQL_SYSTEM_PROMPT = `你是一个 SQL 专家，负责将自然语言问题转换为 SQL 查询。

## 重要规则
1. 只返回纯 SQL 语句，不要包含任何解释或 markdown 代码块标记
2. 生成的 SQL 必须兼容 DuckDB
3. 表名和列名必须使用双引号包围，例如: SELECT "列名" FROM "表名"
4. 仔细检查列名，必须使用数据库中实际存在的列名
5. 不要使用不存在的列
6. 对于日期比较，使用标准 SQL 语法
7. 对于中文字符串，正确处理编码
8. 根据用户问题和表结构，生成最合适的 SQL 查询

## 文档单词匹配规则
当数据库中存在 _words 表和 _paragraphs 表时，说明用户导入了 Word 文档。
- _words 表包含 word（小写原始单词）、lemma（词形还原后的原形）、paragraph_id（段落编号）、position（段内位置）
- _paragraphs 表包含 paragraph_id、text（原始段落文本）、word_count
- vocabulary 表若存在 lemma 列，则该列为词汇原形

**重要：匹配时必须使用 lemma 列进行 JOIN，而非 word 列，这样可以将动词变体（如 walked/walking）、名词复数、形容词比较级等归一到原形进行统计。**

当用户查询单词出现次数时:
  SELECT v."word", COUNT(w."lemma") AS cnt
  FROM "vocabulary" v
  LEFT JOIN "xxx_words" w ON v."lemma" = w."lemma"
  GROUP BY v."word"
  ORDER BY cnt DESC

当用户查询单词出现位置时:
  SELECT w."word", w."lemma", w."paragraph_id", w."position", p."text"
  FROM "xxx_words" w
  JOIN "xxx_paragraphs" p ON w."paragraph_id" = p."paragraph_id"
  WHERE w."lemma" = '<目标单词原形>'`;

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
    const maxTables = 5;
    tablesToUse = tablesToUse.slice(0, maxTables);

    if (tablesToUse.length === 0) {
      return "SELECT '没有可用的数据表' AS message";
    }

    const tableInfo = tablesToUse.map(t => {
      // 限制列的数量，避免 prompt 过长
      const maxColumns = 20;
      const columns = t.columns.slice(0, maxColumns).map(c => {
        const samples = c.sampleValues.length > 0 ? ` 示例: ${c.sampleValues.slice(0, 2).join(', ')}` : '';
        return `  - "${c.name}" (${c.type})${samples}`;
      }).join('\n');
      const moreCols = t.columns.length > maxColumns ? `\n  ... 共 ${t.columns.length} 列` : '';
      return `表名: "${t.name}"\n行数: ${t.rowCount}\n列:\n${columns}${moreCols}`;
    }).join('\n\n');

    const prompt = `## 数据库 Schema

${tableInfo}

## 用户问题
${question}

请生成 SQL 查询语句。注意：表名和列名必须使用双引号，例如 SELECT "列名" FROM "表名"。只返回 SQL，不要任何解释或代码块标记。`;

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