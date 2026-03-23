import chalk from 'chalk';
import { TableMeta, Insight } from '../../types';
import { executeSQL, getTableMeta } from '../engine/duckdb';

// Helper function to convert BigInt to Number
function toNumber(val: any): number | undefined {
  if (val === null || val === undefined) return undefined;
  if (typeof val === 'bigint') return Number(val);
  if (typeof val === 'number') return val;
  return Number(val);
}

export interface AnalysisResult {
  tableName: string;
  overview: {
    rowCount: number;
    columnCount: number;
    dateRange?: { start: string; end: string };
    numericColumns: string[];
    textColumns: string[];
    dateColumns: string[];
  };
  statistics: {
    column: string;
    type: string;
    min?: number;
    max?: number;
    mean?: number;
    median?: number;
    stdDev?: number;
    nullCount: number;
    distinctCount: number;
  }[];
  insights: Insight[];
}

/**
 * 分析表并生成洞察
 */
export async function analyzeTable(tableName: string): Promise<AnalysisResult> {
  const meta = await getTableMeta(tableName);
  if (!meta) {
    throw new Error(`表 "${tableName}" 不存在`);
  }

  // 1. 数据概览
  const overview = await generateOverview(meta);
  
  // 2. 统计信息
  const statistics = await generateStatistics(meta);
  
  // 3. 生成洞察
  const insights = await generateInsights(meta, statistics);
  
  return {
    tableName: meta.name,
    overview,
    statistics,
    insights
  };
}

/**
 * 生成数据概览
 */
async function generateOverview(meta: TableMeta): Promise<AnalysisResult['overview']> {
  const numericColumns = meta.columns.filter(c => c.type === 'number').map(c => c.name);
  const textColumns = meta.columns.filter(c => c.type === 'string').map(c => c.name);
  const dateColumns = meta.columns.filter(c => c.type === 'date').map(c => c.name);
  
  let dateRange: { start: string; end: string } | undefined;
  
  // 检测日期范围
  if (dateColumns.length > 0) {
    const dateCol = dateColumns[0];
    try {
      const result = await executeSQL(
        `SELECT MIN("${dateCol}") as min_date, MAX("${dateCol}") as max_date FROM "${meta.name}"`
      );
      if (result.length > 0 && result[0].min_date && result[0].max_date) {
        dateRange = {
          start: String(result[0].min_date),
          end: String(result[0].max_date)
        };
      }
    } catch {
      // 忽略错误
    }
  }
  
  return {
    rowCount: meta.rowCount,
    columnCount: meta.columns.length,
    dateRange,
    numericColumns,
    textColumns,
    dateColumns
  };
}

/**
 * 生成统计信息
 */
async function generateStatistics(meta: TableMeta): Promise<AnalysisResult['statistics']> {
  const stats: AnalysisResult['statistics'] = [];
  
  for (const col of meta.columns) {
    const baseStat: any = {
      column: col.name,
      type: col.type,
      nullCount: 0,
      distinctCount: 0
    };
    
    try {
      // 获取 NULL 数量
      const nullResult = await executeSQL(
        `SELECT COUNT(*) as null_count FROM "${meta.name}" WHERE "${col.name}" IS NULL`
      );
      baseStat.nullCount = toNumber(nullResult[0]?.null_count) || 0;
      
      // 获取不同值数量
      const distinctResult = await executeSQL(
        `SELECT COUNT(DISTINCT "${col.name}") as distinct_count FROM "${meta.name}"`
      );
      baseStat.distinctCount = toNumber(distinctResult[0]?.distinct_count) || 0;
      
      // 数值列统计
      if (col.type === 'number') {
        const numResult = await executeSQL(
          `SELECT 
            MIN("${col.name}") as min,
            MAX("${col.name}") as max,
            AVG("${col.name}") as mean,
            STDDEV("${col.name}") as stddev,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "${col.name}") as median
          FROM "${meta.name}" WHERE "${col.name}" IS NOT NULL`
        );
        
        if (numResult.length > 0) {
          baseStat.min = toNumber(numResult[0].min);
          baseStat.max = toNumber(numResult[0].max);
          baseStat.mean = toNumber(numResult[0].mean);
          baseStat.median = toNumber(numResult[0].median);
          baseStat.stdDev = toNumber(numResult[0].stddev);
        }
      }
    } catch {
      // 忽略错误，返回基本统计
    }
    
    stats.push(baseStat);
  }
  
  return stats;
}

/**
 * 生成洞察
 */
async function generateInsights(meta: TableMeta, statistics: AnalysisResult['statistics']): Promise<Insight[]> {
  const insights: Insight[] = [];
  
  // 1. 数据量级洞察
  if (meta.rowCount > 1000000) {
    insights.push({
      type: 'distribution',
      title: '大数据量',
      description: `该表包含 ${meta.rowCount.toLocaleString()} 行数据，属于大规模数据集。建议在分析时使用采样或聚合来提高性能。`,
      significance: 'medium'
    });
  } else if (meta.rowCount < 100) {
    insights.push({
      type: 'distribution',
      title: '小数据量',
      description: `该表仅有 ${meta.rowCount} 行数据，可能需要更多数据来获得可靠的统计结论。`,
      significance: 'low'
    });
  }
  
  // 2. 缺失值分析
  const highNullColumns = statistics.filter(s => {
    const nullRate = s.nullCount / meta.rowCount;
    return nullRate > 0.3;
  });
  
  if (highNullColumns.length > 0) {
    insights.push({
      type: 'anomaly',
      title: '高缺失率列',
      description: `以下列有超过 30% 的缺失值: ${highNullColumns.map(c => c.column).join(', ')}。建议检查数据质量问题。`,
      significance: 'high'
    });
  }
  
  // 3. 数值分布洞察
  for (const stat of statistics.filter(s => s.type === 'number')) {
    if (stat.mean !== undefined && stat.stdDev !== undefined) {
      // 变异系数
      const cv = stat.mean !== 0 ? (stat.stdDev / Math.abs(stat.mean)) : 0;
      
      if (cv > 1) {
        insights.push({
          type: 'distribution',
          title: `${stat.column} 高离散度`,
          description: `列 "${stat.column}" 的变异系数为 ${cv.toFixed(2)}，数据分布非常分散。均值为 ${stat.mean?.toFixed(2)}，标准差为 ${stat.stdDev?.toFixed(2)}。`,
          significance: 'medium'
        });
      }
      
      // 异常值检测（简单方法）
      if (stat.min !== undefined && stat.max !== undefined && stat.mean !== undefined) {
        const range = stat.max - stat.min;
        const lowerBound = stat.mean - 3 * (stat.stdDev || 0);
        const upperBound = stat.mean + 3 * (stat.stdDev || 0);
        
        if (stat.min < lowerBound || stat.max > upperBound) {
          insights.push({
            type: 'anomaly',
            title: `${stat.column} 可能存在异常值`,
            description: `列 "${stat.column}" 的范围 [${stat.min.toFixed(2)}, ${stat.max.toFixed(2)}] 超出 3σ 范围 [${lowerBound.toFixed(2)}, ${upperBound.toFixed(2)}]，可能存在异常值。`,
            significance: 'medium',
            data: { min: stat.min, max: stat.max, lowerBound, upperBound }
          });
        }
      }
    }
  }
  
  // 4. 基数分析（唯一值比例）
  for (const stat of statistics) {
    const cardinalityRatio = stat.distinctCount / meta.rowCount;
    
    if (cardinalityRatio === 1 && meta.rowCount > 10) {
      insights.push({
        type: 'distribution',
        title: `${stat.column} 可能是主键`,
        description: `列 "${stat.column}" 的所有值都是唯一的，可能是一个主键或 ID 列。`,
        significance: 'low'
      });
    } else if (cardinalityRatio < 0.05 && stat.type === 'string' && stat.distinctCount <= 10) {
      insights.push({
        type: 'distribution',
        title: `${stat.column} 低基数字符串`,
        description: `列 "${stat.column}" 仅有 ${stat.distinctCount} 个不同值，适合用于分组分析或作为类别变量。`,
        significance: 'low'
      });
    }
  }
  
  // 5. 趋势分析（如果有日期列和数值列）
  const dateColumns = meta.columns.filter(c => c.type === 'date');
  const numericColumns = meta.columns.filter(c => c.type === 'number');
  
  if (dateColumns.length > 0 && numericColumns.length > 0) {
    const dateCol = dateColumns[0].name;
    const numCol = numericColumns[0].name;
    
    try {
      // 简单趋势检测：比较前半段和后半段的平均值
      const trendResult = await executeSQL(`
        WITH ordered AS (
          SELECT "${numCol}", 
                 ROW_NUMBER() OVER (ORDER BY "${dateCol}") as rn,
                 COUNT(*) OVER () as total
          FROM "${meta.name}"
          WHERE "${dateCol}" IS NOT NULL AND "${numCol}" IS NOT NULL
        )
        SELECT 
          AVG(CASE WHEN rn <= total/2 THEN "${numCol}" END) as first_half_avg,
          AVG(CASE WHEN rn > total/2 THEN "${numCol}" END) as second_half_avg
        FROM ordered
      `);
      
      if (trendResult.length > 0 && trendResult[0].first_half_avg && trendResult[0].second_half_avg) {
        const first = trendResult[0].first_half_avg;
        const second = trendResult[0].second_half_avg;
        const change = ((second - first) / first) * 100;
        
        if (Math.abs(change) > 10) {
          const direction = change > 0 ? '上升' : '下降';
          insights.push({
            type: 'trend',
            title: `${numCol} ${direction}趋势`,
            description: `列 "${numCol}" 显示出明显的${direction}趋势，后半段数据比前半段 ${change > 0 ? '高' : '低'} ${Math.abs(change).toFixed(1)}%。`,
            significance: change > 20 || change < -20 ? 'high' : 'medium',
            data: { firstHalfAvg: first, secondHalfAvg: second, changePercent: change }
          });
        }
      }
    } catch {
      // 忽略错误
    }
  }
  
  // 6. 相关性分析（仅对前两个数值列）
  if (numericColumns.length >= 2) {
    const col1 = numericColumns[0].name;
    const col2 = numericColumns[1].name;
    
    try {
      const corrResult = await executeSQL(`
        SELECT CORR("${col1}", "${col2}") as correlation
        FROM "${meta.name}"
        WHERE "${col1}" IS NOT NULL AND "${col2}" IS NOT NULL
      `);
      
      if (corrResult.length > 0 && corrResult[0].correlation !== null) {
        const corr = Math.abs(corrResult[0].correlation);
        
        if (corr > 0.7) {
          insights.push({
            type: 'correlation',
            title: `${col1} 与 ${col2} 强相关`,
            description: `列 "${col1}" 和 "${col2}" 存在强相关性 (r = ${corrResult[0].correlation.toFixed(3)})，它们可能具有因果或依赖关系。`,
            significance: 'high',
            data: { correlation: corrResult[0].correlation }
          });
        } else if (corr > 0.5) {
          insights.push({
            type: 'correlation',
            title: `${col1} 与 ${col2} 中等相关`,
            description: `列 "${col1}" 和 "${col2}" 存在中等相关性 (r = ${corrResult[0].correlation.toFixed(3)})。`,
            significance: 'medium',
            data: { correlation: corrResult[0].correlation }
          });
        }
      }
    } catch {
      // 忽略错误
    }
  }
  
  // 按重要性排序
  const significanceOrder = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => significanceOrder[a.significance] - significanceOrder[b.significance]);
  
  return insights;
}

/**
 * 格式化分析结果为字符串
 */
export function formatAnalysisResult(result: AnalysisResult): string {
  const lines: string[] = [];
  
  // 标题
  lines.push(chalk.bold.cyan(`\n${result.tableName} 数据分析报告`));
  lines.push(chalk.grey('═'.repeat(50)));
  
  // 概览
  lines.push(chalk.bold.white('\n📋 数据概览'));
  lines.push(chalk.grey('─'.repeat(30)));
  lines.push(`  行数: ${chalk.green(result.overview.rowCount.toLocaleString())}`);
  lines.push(`  列数: ${chalk.green(result.overview.columnCount.toString())}`);
  
  if (result.overview.dateRange) {
    lines.push(`  时间范围: ${chalk.blue(result.overview.dateRange.start)} ~ ${chalk.blue(result.overview.dateRange.end)}`);
  }
  
  if (result.overview.numericColumns.length > 0) {
    lines.push(`  数值列: ${chalk.yellow(result.overview.numericColumns.join(', '))}`);
  }
  
  if (result.overview.textColumns.length > 0) {
    lines.push(`  文本列: ${chalk.magenta(result.overview.textColumns.slice(0, 5).join(', '))}${result.overview.textColumns.length > 5 ? ' ...' : ''}`);
  }
  
  // 统计信息
  lines.push(chalk.bold.white('\n📈 统计信息'));
  lines.push(chalk.grey('─'.repeat(30)));
  
  for (const stat of result.statistics.slice(0, 10)) {
    if (stat.type === 'number' && stat.mean !== undefined) {
      lines.push(`  ${chalk.cyan(stat.column)}:`);
      lines.push(`    范围: [${stat.min?.toFixed(2)}, ${stat.max?.toFixed(2)}]`);
      lines.push(`    均值: ${stat.mean?.toFixed(2)} | 中位数: ${stat.median?.toFixed(2)}`);
      lines.push(`    唯一值: ${stat.distinctCount.toLocaleString()} | 缺失: ${stat.nullCount.toLocaleString()}`);
    } else {
      lines.push(`  ${chalk.cyan(stat.column)} (${stat.type}):`);
      lines.push(`    唯一值: ${stat.distinctCount.toLocaleString()} | 缺失: ${stat.nullCount.toLocaleString()}`);
    }
  }
  
  // 洞察
  if (result.insights.length > 0) {
    lines.push(chalk.bold.white('\n洞察发现'));
    lines.push(chalk.grey('─'.repeat(30)));
    
    const significanceColors = {
      high: chalk.red,
      medium: chalk.yellow,
      low: chalk.grey
    };
    
    const typeIcons = {
      trend: '📈',
      anomaly: '⚠️',
      correlation: '🔗',
      distribution: '[图表]'
    };
    
    for (const insight of result.insights) {
      const icon = typeIcons[insight.type] || '📌';
      const color = significanceColors[insight.significance];
      
      lines.push(`\n  ${icon} ${color(insight.title)} ${chalk.dim(`[${insight.significance}]`)}`);
      lines.push(`     ${chalk.white(insight.description)}`);
    }
  } else {
    lines.push(chalk.bold.white('\n洞察发现'));
    lines.push(chalk.grey('─'.repeat(30)));
    lines.push(chalk.dim('  暂无明显洞察，尝试导入更多数据进行分析。'));
  }
  
  lines.push('');
  lines.push(chalk.grey('═'.repeat(50)));
  
  return lines.join('\n');
}