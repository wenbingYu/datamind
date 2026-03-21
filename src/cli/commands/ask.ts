import chalk from 'chalk';
import ora from 'ora';
import { getAllTablesMeta, executeSQLWithTime } from '../../core/engine/duckdb';
import { getLLMClient } from '../../core/llm/client';
import { SQLBuilder } from '../../core/llm/sql-builder';
import { getConfig, validateConfig } from '../../utils/config';
import { formatQueryResult } from '../../utils/output';
import { 
  generateChartConfig, 
  inferChartType, 
  renderASCIChart, 
  saveChartConfig, 
  saveChartHTML,
  ChartType 
} from '../../utils/charts';
import { recommendTables } from '../../core/engine/lancedb';
import { QueryError } from '../../utils/errors';

export async function askCommand(
  question: string, 
  tableName?: string, 
  chartType?: string, 
  outputPath?: string
): Promise<void> {
  const config = getConfig();
  
  // 提前验证 API Key 配置
  validateConfig(config);

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
  } else {
    // 尝试使用向量索引推荐相关表
    try {
      const recommended = await recommendTables(question);
      if (recommended.length > 0) {
        const recommendedTables = tables.filter(t => recommended.includes(t.name));
        if (recommendedTables.length > 0) {
          tables = recommendedTables;
        }
      }
    } catch {
      // 忽略错误，使用所有表
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

    const queryResult = {
      sql,
      columns,
      rows: rowsArray,
      rowCount: rows.length,
      executionTime: time
    };

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

    // 图表生成
    if (chartType) {
      const validChartTypes: ChartType[] = ['bar', 'line', 'pie', 'scatter'];
      const type = chartType as ChartType;
      
      if (!validChartTypes.includes(type)) {
        console.log(chalk.yellow(`不支持的图表类型: ${chartType}`));
        console.log(chalk.dim(`支持的类型: ${validChartTypes.join(', ')}`));
      } else {
        const chartConfig = generateChartConfig(type, queryResult, { title: question });
        
        if (outputPath) {
          // 保存到文件
          const ext = outputPath.toLowerCase().split('.').pop();
          
          if (ext === 'json') {
            await saveChartConfig(chartConfig, outputPath);
            console.log();
            console.log(chalk.green(`✓ 图表配置已保存到: ${outputPath}`));
          } else if (ext === 'html') {
            await saveChartHTML(chartConfig, outputPath);
            console.log();
            console.log(chalk.green(`✓ 图表 HTML 已保存到: ${outputPath}`));
            console.log(chalk.dim(`  在浏览器中打开查看`));
          } else {
            // 默认保存为 HTML
            await saveChartHTML(chartConfig, outputPath.endsWith('.html') ? outputPath : outputPath + '.html');
            console.log();
            console.log(chalk.green(`✓ 图表已保存到: ${outputPath}.html`));
          }
        } else {
          // 在终端显示 ASCII 图表
          console.log();
          console.log(chalk.cyan('📊 图表预览'));
          console.log(renderASCIChart(chartConfig, type));
        }
      }
    }

  } catch (error) {
    spinner.fail(chalk.red('查询失败'));
    if (error instanceof QueryError) {
      throw error;
    }
    throw new QueryError(error instanceof Error ? error.message : String(error));
  }
}