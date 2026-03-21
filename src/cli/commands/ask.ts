import chalk from 'chalk';
import ora from 'ora';
import { getAllTablesMeta, executeSQLWithTime } from '../../core/engine/duckdb';
import { getLLMClient } from '../../core/llm/client';
import { SQLBuilder } from '../../core/llm/sql-builder';
import { getConfig } from '../../utils/config';
import { formatQueryResult } from '../../utils/output';

export async function askCommand(question: string, tableName?: string): Promise<void> {
  const config = getConfig();
  
  if (!config.llm.apiKey) {
    console.error(chalk.red('错误: 未配置 API Key'));
    console.log(chalk.dim('请设置环境变量 DATAMIND_API_KEY 或 ZHIPU_API_KEY'));
    process.exit(1);
  }

  // Get table metadata
  let tables = await getAllTablesMeta();
  
  if (tables.length === 0) {
    console.log(chalk.yellow('暂无数据表，请先使用 datamind import <file> 导入数据'));
    return;
  }

  // Filter by table name if specified
  if (tableName) {
    tables = tables.filter(t => t.name.toLowerCase() === tableName.toLowerCase());
    if (tables.length === 0) {
      console.error(chalk.red(`错误: 表 "${tableName}" 不存在`));
      process.exit(1);
    }
  }

  const spinner = ora('正在生成 SQL...').start();

  try {
    // Initialize LLM client
    const client = getLLMClient(config);
    const builder = new SQLBuilder(client);

    // Generate SQL
    const sql = await builder.generateSQL(question, tables);
    spinner.text = '正在执行查询...';

    // Execute SQL
    const { rows, time } = await executeSQLWithTime(sql);
    
    spinner.succeed(chalk.green('查询完成'));

    // Format output
    if (rows.length === 0) {
      console.log();
      console.log(chalk.yellow('查询无结果'));
      console.log(chalk.dim(`SQL: ${sql}`));
      return;
    }

    const columns = Object.keys(rows[0]);
    const rowsArray = rows.map(r => columns.map(c => r[c]));

    console.log();
    console.log(formatQueryResult({
      sql,
      columns,
      rows: rowsArray.slice(0, 50),
      rowCount: rows.length,
      executionTime: time
    }));

    if (rows.length > 50) {
      console.log(chalk.dim(`(显示前 50 行，共 ${rows.length} 行)`));
    }

  } catch (error) {
    spinner.fail(chalk.red('查询失败'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}