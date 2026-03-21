import chalk from 'chalk';
import ora from 'ora';
import { analyzeTable, formatAnalysisResult } from '../../core/analyzer/insights';
import { getAllTablesMeta, getTableMeta } from '../../core/engine/duckdb';
import { QueryError } from '../../utils/errors';
import {
  runAdvancedAnalysis,
  formatAdvancedAnalysisResult,
  AdvancedAnalysisOptions
} from '../../analyzer';

export async function analyzeCommand(
  tableName?: string,
  options: {
    forecast?: boolean;
    anomaly?: boolean;
    association?: boolean;
    correlation?: boolean;
    horizon?: number;
    column?: string;
    threshold?: number;
    minSupport?: number;
    minConfidence?: number;
    method?: 'pearson' | 'spearman';
  } = {}
): Promise<void> {
  const spinner = ora('正在分析数据...').start();
  
  try {
    // 判断是否需要执行高级分析
    const needsAdvancedAnalysis = options.forecast || options.anomaly || 
                                   options.association || options.correlation;
    
    if (needsAdvancedAnalysis && tableName) {
      // 执行高级分析
      spinner.text = `正在执行高级分析...`;
      
      // 确定分析类型
      let analysisType: AdvancedAnalysisOptions['type'] = 'auto';
      
      if (options.forecast) analysisType = 'forecast';
      else if (options.anomaly) analysisType = 'anomaly';
      else if (options.association) analysisType = 'association';
      else if (options.correlation) analysisType = 'correlation';
      
      const advancedOptions: AdvancedAnalysisOptions = {
        type: analysisType,
        targetColumn: options.column,
        forecastHorizon: options.horizon,
        anomalyThreshold: options.threshold,
        minSupport: options.minSupport,
        minConfidence: options.minConfidence,
        correlationMethod: options.method
      };
      
      const result = await runAdvancedAnalysis(tableName, advancedOptions);
      
      spinner.succeed(chalk.green('高级分析完成'));
      console.log(formatAdvancedAnalysisResult(result));
      
    } else if (tableName) {
      // 分析单个表（基础分析）
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
    if (error instanceof QueryError) {
      throw error;
    }
    throw new QueryError(error instanceof Error ? error.message : String(error));
  }
}