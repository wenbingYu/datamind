/**
 * 高级分析引擎 - 统一入口
 * Advanced Analytics Engine - Unified Entry Point
 * 
 * 提供时间序列预测、异常检测、关联分析、相关性分析功能
 * 与 DuckDB 集成，支持自动选择分析方法
 */

import { executeSQL, getTableMeta } from '../core/engine/duckdb';
import { TableMeta, ColumnMeta } from '../types';

// 导出所有模块
export * from './forecast';
export * from './anomaly';
export * from './association';
export * from './correlation';

// 导入具体功能
import {
  autoForecast,
  ForecastResult,
  ForecastOptions,
  ForecastReport,
  formatForecastReport
} from './forecast';

import {
  detectAnomalies,
  AnomalyResult,
  AnomalyOptions,
  AnomalyReport,
  formatAnomalyReport
} from './anomaly';

import {
  analyzeAssociation,
  AssociationResult,
  AssociationOptions,
  AssociationReport,
  formatAssociationReport,
  createTransactions
} from './association';

import {
  analyzeCorrelation,
  CorrelationAnalysisResult,
  CorrelationReport,
  formatCorrelationReport
} from './correlation';

// ==================== 类型定义 ====================

export type AnalysisType = 'forecast' | 'anomaly' | 'association' | 'correlation' | 'auto';

export interface AdvancedAnalysisOptions {
  type: AnalysisType;
  
  // 预测选项
  forecastHorizon?: number;
  
  // 异常检测选项
  anomalyMethods?: ('zscore' | 'iqr' | 'mad' | 'window' | 'kmeans')[];
  anomalyThreshold?: number;
  
  // 关联分析选项
  minSupport?: number;
  minConfidence?: number;
  minLift?: number;
  
  // 相关性分析选项
  correlationMethod?: 'pearson' | 'spearman';
  
  // 通用选项
  targetColumn?: string;
  dateColumn?: string;
  categoryColumns?: string[];
  valueColumns?: string[];
}

export interface AdvancedAnalysisResult {
  type: AnalysisType;
  tableName: string;
  success: boolean;
  data?: any;
  report?: any;
  error?: string;
}

// ==================== 辅助函数 ====================

function toNumber(val: any): number | undefined {
  if (val === null || val === undefined) return undefined;
  if (typeof val === 'bigint') return Number(val);
  if (typeof val === 'number') return val;
  return Number(val);
}

async function getNumericColumnData(tableName: string, columnName: string): Promise<number[]> {
  const result = await executeSQL(
    `SELECT "${columnName}" FROM "${tableName}" WHERE "${columnName}" IS NOT NULL ORDER BY rowid`
  );
  return result.map(row => toNumber(row[columnName])).filter((v): v is number => v !== undefined);
}

async function getDateSortedNumericData(
  tableName: string,
  dateColumn: string,
  valueColumn: string
): Promise<number[]> {
  const result = await executeSQL(
    `SELECT "${valueColumn}" FROM "${tableName}" WHERE "${dateColumn}" IS NOT NULL AND "${valueColumn}" IS NOT NULL ORDER BY "${dateColumn}"`
  );
  return result.map(row => toNumber(row[valueColumn])).filter((v): v is number => v !== undefined);
}

async function getMultiColumnData(
  tableName: string,
  columns: string[]
): Promise<{ [column: string]: number }[]> {
  const cols = columns.map(c => `"${c}"`).join(', ');
  const result = await executeSQL(
    `SELECT ${cols} FROM "${tableName}"`
  );
  
  return result.map(row => {
    const obj: { [column: string]: number } = {};
    for (const col of columns) {
      const val = toNumber(row[col]);
      if (val !== undefined) {
        obj[col] = val;
      }
    }
    return obj;
  }).filter(row => Object.keys(row).length > 0);
}

async function getCategoryTransactions(
  tableName: string,
  columns: string[]
): Promise<Set<string>[]> {
  const cols = columns.map(c => `"${c}"`).join(', ');
  const result = await executeSQL(
    `SELECT ${cols} FROM "${tableName}"`
  );
  
  return result.map(row => {
    const transaction = new Set<string>();
    for (const col of columns) {
      const val = row[col];
      if (val !== null && val !== undefined) {
        transaction.add(`${col}=${String(val)}`);
      }
    }
    return transaction;
  }).filter(t => t.size > 0);
}

// ==================== 时间序列预测 ====================

async function runForecast(
  tableName: string,
  options: AdvancedAnalysisOptions
): Promise<AdvancedAnalysisResult> {
  const meta = await getTableMeta(tableName);
  if (!meta) {
    return { type: 'forecast', tableName, success: false, error: `表 "${tableName}" 不存在` };
  }
  
  // 确定数值列和日期列
  const numericColumns = meta.columns.filter(c => c.type === 'number').map(c => c.name);
  const dateColumns = meta.columns.filter(c => c.type === 'date').map(c => c.name);
  
  if (numericColumns.length === 0) {
    return { type: 'forecast', tableName, success: false, error: '没有可用的数值列进行预测' };
  }
  
  // 选择目标列
  const targetColumn = options.targetColumn || numericColumns[0];
  const dateColumn = options.dateColumn || dateColumns[0];
  
  let data: number[];
  
  if (dateColumn) {
    // 按日期排序获取数据
    data = await getDateSortedNumericData(tableName, dateColumn, targetColumn);
  } else {
    // 直接获取数据（假设已排序）
    data = await getNumericColumnData(tableName, targetColumn);
  }
  
  if (data.length < 3) {
    return { type: 'forecast', tableName, success: false, error: '数据点不足，至少需要 3 个数据点进行预测' };
  }
  
  // 执行预测
  const forecastOptions: ForecastOptions = {
    horizon: options.forecastHorizon || 5
  };
  
  const result = autoForecast(data, forecastOptions);
  const report = formatForecastReport(data, result);
  
  return {
    type: 'forecast',
    tableName,
    success: true,
    data: result,
    report
  };
}

// ==================== 异常检测 ====================

async function runAnomaly(
  tableName: string,
  options: AdvancedAnalysisOptions
): Promise<AdvancedAnalysisResult> {
  const meta = await getTableMeta(tableName);
  if (!meta) {
    return { type: 'anomaly', tableName, success: false, error: `表 "${tableName}" 不存在` };
  }
  
  // 确定数值列
  const numericColumns = meta.columns.filter(c => c.type === 'number').map(c => c.name);
  
  if (numericColumns.length === 0) {
    return { type: 'anomaly', tableName, success: false, error: '没有可用的数值列进行异常检测' };
  }
  
  // 选择目标列
  const targetColumn = options.targetColumn || numericColumns[0];
  
  const data = await getNumericColumnData(tableName, targetColumn);
  
  if (data.length < 3) {
    return { type: 'anomaly', tableName, success: false, error: '数据点不足，至少需要 3 个数据点进行异常检测' };
  }
  
  // 执行异常检测
  const anomalyOptions: AnomalyOptions = {
    methods: options.anomalyMethods || ['zscore', 'iqr', 'mad'],
    threshold: options.anomalyThreshold || 3
  };
  
  const result = detectAnomalies(data, anomalyOptions);
  const report = formatAnomalyReport(data, result);
  
  return {
    type: 'anomaly',
    tableName,
    success: true,
    data: result,
    report
  };
}

// ==================== 关联分析 ====================

async function runAssociation(
  tableName: string,
  options: AdvancedAnalysisOptions
): Promise<AdvancedAnalysisResult> {
  const meta = await getTableMeta(tableName);
  if (!meta) {
    return { type: 'association', tableName, success: false, error: `表 "${tableName}" 不存在` };
  }
  
  // 确定类别列（字符串列或低基数数值列）
  const categoryColumns = options.categoryColumns || 
    meta.columns
      .filter(c => c.type === 'string' || (c.type === 'number' && c.sampleValues.length <= 10))
      .map(c => c.name);
  
  if (categoryColumns.length < 2) {
    return { type: 'association', tableName, success: false, error: '需要至少 2 个类别列进行关联分析' };
  }
  
  // 获取事务数据
  const transactions = await getCategoryTransactions(tableName, categoryColumns);
  
  if (transactions.length === 0) {
    return { type: 'association', tableName, success: false, error: '无法生成事务数据' };
  }
  
  // 执行关联分析
  const associationOptions: AssociationOptions = {
    minSupport: options.minSupport || 0.1,
    minConfidence: options.minConfidence || 0.5,
    minLift: options.minLift || 1.0
  };
  
  const result = analyzeAssociation(transactions, associationOptions);
  const report = formatAssociationReport(result);
  
  return {
    type: 'association',
    tableName,
    success: true,
    data: result,
    report
  };
}

// ==================== 相关性分析 ====================

async function runCorrelation(
  tableName: string,
  options: AdvancedAnalysisOptions
): Promise<AdvancedAnalysisResult> {
  const meta = await getTableMeta(tableName);
  if (!meta) {
    return { type: 'correlation', tableName, success: false, error: `表 "${tableName}" 不存在` };
  }
  
  // 确定数值列
  const numericColumns = options.valueColumns || 
    meta.columns.filter(c => c.type === 'number').map(c => c.name);
  
  if (numericColumns.length < 2) {
    return { type: 'correlation', tableName, success: false, error: '需要至少 2 个数值列进行相关性分析' };
  }
  
  // 获取多列数据
  const data = await getMultiColumnData(tableName, numericColumns);
  
  if (data.length < 3) {
    return { type: 'correlation', tableName, success: false, error: '数据点不足，至少需要 3 个数据点进行相关性分析' };
  }
  
  // 执行相关性分析
  const result = analyzeCorrelation(
    data,
    numericColumns,
    options.correlationMethod || 'pearson'
  );
  const report = formatCorrelationReport(result);
  
  return {
    type: 'correlation',
    tableName,
    success: true,
    data: result,
    report
  };
}

// ==================== 主入口函数 ====================

export async function runAdvancedAnalysis(
  tableName: string,
  options: AdvancedAnalysisOptions
): Promise<AdvancedAnalysisResult> {
  switch (options.type) {
    case 'forecast':
      return runForecast(tableName, options);
    
    case 'anomaly':
      return runAnomaly(tableName, options);
    
    case 'association':
      return runAssociation(tableName, options);
    
    case 'correlation':
      return runCorrelation(tableName, options);
    
    case 'auto':
      return runAutoAnalysis(tableName, options);
    
    default:
      return {
        type: options.type,
        tableName,
        success: false,
        error: `未知的分析类型: ${options.type}`
      };
  }
}

/**
 * 自动分析：根据数据特征选择合适的分析方法
 */
async function runAutoAnalysis(
  tableName: string,
  options: AdvancedAnalysisOptions
): Promise<AdvancedAnalysisResult> {
  const meta = await getTableMeta(tableName);
  if (!meta) {
    return { type: 'auto', tableName, success: false, error: `表 "${tableName}" 不存在` };
  }
  
  const numericColumns = meta.columns.filter(c => c.type === 'number').map(c => c.name);
  const dateColumns = meta.columns.filter(c => c.type === 'date').map(c => c.name);
  const stringColumns = meta.columns.filter(c => c.type === 'string').map(c => c.name);
  
  // 根据数据特征选择分析类型
  const analyses: AdvancedAnalysisResult[] = [];
  
  // 如果有日期列和数值列，进行预测
  if (dateColumns.length > 0 && numericColumns.length > 0) {
    const forecastResult = await runForecast(tableName, {
      ...options,
      type: 'forecast',
      dateColumn: dateColumns[0],
      targetColumn: numericColumns[0]
    });
    if (forecastResult.success) {
      analyses.push(forecastResult);
    }
  }
  
  // 如果有多个数值列，进行相关性分析
  if (numericColumns.length >= 2) {
    const corrResult = await runCorrelation(tableName, {
      ...options,
      type: 'correlation',
      valueColumns: numericColumns.slice(0, 5) // 最多5列
    });
    if (corrResult.success) {
      analyses.push(corrResult);
    }
  }
  
  // 对第一个数值列进行异常检测
  if (numericColumns.length > 0) {
    const anomalyResult = await runAnomaly(tableName, {
      ...options,
      type: 'anomaly',
      targetColumn: numericColumns[0]
    });
    if (anomalyResult.success) {
      analyses.push(anomalyResult);
    }
  }
  
  // 如果有足够的类别列，进行关联分析
  if (stringColumns.length >= 2) {
    const assocResult = await runAssociation(tableName, {
      ...options,
      type: 'association',
      categoryColumns: stringColumns
    });
    if (assocResult.success) {
      analyses.push(assocResult);
    }
  }
  
  if (analyses.length === 0) {
    return {
      type: 'auto',
      tableName,
      success: false,
      error: '无法自动确定分析方法，请手动指定分析类型'
    };
  }
  
  // 返回综合结果
  return {
    type: 'auto',
    tableName,
    success: true,
    data: analyses.map(a => ({
      type: a.type,
      data: a.data
    })),
    report: analyses.map(a => ({
      type: a.type,
      report: a.report
    }))
  };
}

// ==================== 格式化输出 ====================

export function formatAdvancedAnalysisResult(result: AdvancedAnalysisResult): string {
  const lines: string[] = [];
  
  const typeNames: { [key: string]: string } = {
    forecast: '时间序列预测',
    anomaly: '异常检测',
    association: '关联分析',
    correlation: '相关性分析',
    auto: '综合分析'
  };
  
  const typeIcons: { [key: string]: string } = {
    forecast: '📈',
    anomaly: '⚠️',
    association: '🔗',
    correlation: '📊',
    auto: '🔍'
  };
  
  lines.push(`\n${typeIcons[result.type]} ${typeNames[result.type]} - ${result.tableName}`);
  lines.push('═'.repeat(50));
  
  if (!result.success) {
    lines.push(`❌ 分析失败: ${result.error}`);
    return lines.join('\n');
  }
  
  const report = result.report;
  
  // 根据类型格式化输出
  switch (result.type) {
    case 'forecast':
      lines.push(formatForecastOutput(report as ForecastReport));
      break;
    
    case 'anomaly':
      lines.push(formatAnomalyOutput(report as AnomalyReport));
      break;
    
    case 'association':
      lines.push(formatAssociationOutput(report as AssociationReport));
      break;
    
    case 'correlation':
      lines.push(formatCorrelationOutput(report as CorrelationReport));
      break;
    
    case 'auto':
      lines.push('\n📋 综合分析结果:');
      if (Array.isArray(report)) {
        for (const r of report) {
          lines.push(`\n--- ${typeNames[r.type]} ---`);
          switch (r.type) {
            case 'forecast':
              lines.push(formatForecastOutput(r.report as ForecastReport));
              break;
            case 'anomaly':
              lines.push(formatAnomalyOutput(r.report as AnomalyReport));
              break;
            case 'association':
              lines.push(formatAssociationOutput(r.report as AssociationReport));
              break;
            case 'correlation':
              lines.push(formatCorrelationOutput(r.report as CorrelationReport));
              break;
          }
        }
      }
      break;
  }
  
  return lines.join('\n');
}

function formatForecastOutput(report: ForecastReport): string {
  const lines: string[] = [];
  
  lines.push(`\n📌 方法: ${report.summary.method}`);
  lines.push(`📌 预测步数: ${report.summary.horizon}`);
  lines.push(`📌 趋势方向: ${report.summary.trendDirection}`);
  lines.push(`📌 季节性: ${report.summary.seasonality}`);
  
  lines.push('\n📊 预测结果:');
  for (const p of report.predictions) {
    lines.push(`  第 ${p.period} 期: ${p.value.toFixed(2)} [${p.lower.toFixed(2)}, ${p.upper.toFixed(2)}]`);
  }
  
  if (report.accuracy) {
    lines.push(`\n✅ 准确性: MAPE=${report.accuracy.mape}, MAE=${report.accuracy.mae}, RMSE=${report.accuracy.rmse}`);
  }
  
  lines.push('\n💡 洞察:');
  for (const insight of report.insights) {
    lines.push(`  • ${insight}`);
  }
  
  return lines.join('\n');
}

function formatAnomalyOutput(report: AnomalyReport): string {
  const lines: string[] = [];
  
  lines.push(`\n${report.summary}`);
  lines.push(`\n📊 统计: ${report.statistics.anomalyCount}/${report.statistics.totalPoints} 个异常点 (${report.statistics.anomalyRate})`);
  
  if (report.anomalies.length > 0) {
    lines.push('\n⚠️ 异常点列表:');
    for (const a of report.anomalies.slice(0, 10)) {
      lines.push(`  [${a.index}] 值=${a.value}, 异常分数=${a.score}`);
      lines.push(`      检测方法: ${a.detectedBy.join(', ')}`);
    }
    if (report.anomalies.length > 10) {
      lines.push(`  ... 还有 ${report.anomalies.length - 10} 个异常点`);
    }
  }
  
  lines.push('\n💡 洞察:');
  for (const insight of report.insights) {
    lines.push(`  • ${insight}`);
  }
  
  return lines.join('\n');
}

function formatAssociationOutput(report: AssociationReport): string {
  const lines: string[] = [];
  
  lines.push(`\n${report.summary}`);
  lines.push(`\n📊 统计: ${report.statistics.ruleCount} 条规则, 平均支持度=${report.statistics.avgSupport}, 平均置信度=${report.statistics.avgConfidence}`);
  
  if (report.topRules.length > 0) {
    lines.push('\n🔗 Top 关联规则:');
    for (const rule of report.topRules.slice(0, 5)) {
      lines.push(`  ${rule.rule}`);
      lines.push(`    支持度=${rule.support}, 置信度=${rule.confidence}, 提升度=${rule.lift}`);
      lines.push(`    解释: ${rule.interpretation}`);
    }
  }
  
  lines.push('\n💡 洞察:');
  for (const insight of report.insights) {
    lines.push(`  • ${insight}`);
  }
  
  return lines.join('\n');
}

function formatCorrelationOutput(report: CorrelationReport): string {
  const lines: string[] = [];
  
  lines.push(`\n${report.summary}`);
  
  if (report.topCorrelations.length > 0) {
    lines.push('\n📊 Top 相关性:');
    for (const corr of report.topCorrelations.slice(0, 5)) {
      lines.push(`  ${corr.pair}: r=${corr.coefficient.toFixed(3)}, p=${corr.pValue}`);
      lines.push(`    ${corr.interpretation}`);
    }
  }
  
  if (report.significantCorrelations.length > 0) {
    lines.push(`\n✅ 显著相关配对 (${report.significantCorrelations.length} 对):`);
    for (const sig of report.significantCorrelations.slice(0, 5)) {
      lines.push(`  ${sig.pair}: r=${sig.coefficient.toFixed(3)}`);
    }
  }
  
  lines.push('\n💡 洞察:');
  for (const insight of report.insights) {
    lines.push(`  • ${insight}`);
  }
  
  return lines.join('\n');
}