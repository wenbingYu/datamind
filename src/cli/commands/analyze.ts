import chalk from 'chalk';
import ora from 'ora';
import { analyzeTable, formatAnalysisResult } from '../../core/analyzer/insights';
import { getAllTablesMeta, getTableMeta } from '../../core/engine/duckdb';

export async function analyzeCommand(tableName?: string): Promise<void> {
  const spinner = ora('正在分析数据...').start();
  
  try {
    if (tableName) {
      // 分析单个表
      spinner.text = `正在分析表 ${tableName}...`;
      const result = await analyzeTable(tableName);
      spinner.succeed(chalk.green('分析完成'));
      console.log(formatAnalysisResult(result));
    } else {
      // 分析所有表
      const tables = await getAllTablesMeta();
      
      if (tables.length === 0) {
        spinner.fail(chalk.yellow('暂无数据表，请先使用 datamind import <file> 导入数据'));
        return;
      }
      
      spinner.succeed(chalk.green(`发现 ${tables.length} 个表`));
      
      for (const table of tables) {
        console.log(formatAnalysisResult(await analyzeTable(table.name)));
        console.log();
      }
    }
  } catch (error) {
    spinner.fail(chalk.red('分析失败'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}