/**
 * DataMind 智能图表推荐器
 * 根据数据特征自动推荐最佳图表类型
 */

import { ChartType, CHART_DATA_REQUIREMENTS } from './types';

/** 查询结果结构 */
interface QueryResult {
  columns: string[];
  rows: any[][];
  rowCount: number;
}

/** 列数据类型 */
interface ColumnAnalysis {
  name: string;
  type: 'number' | 'string' | 'date' | 'boolean';
  uniqueCount: number;
  nullCount: number;
  min?: number;
  max?: number;
  mean?: number;
  sampleValues: any[];
  isTimeSeries: boolean;
}

/** 数据分析结果 */
interface DataAnalysis {
  columns: ColumnAnalysis[];
  rowCount: number;
  numericColumns: string[];
  categoricalColumns: string[];
  dateColumns: string[];
  hasMultipleSeries: boolean;
  isHierarchical: boolean;
}

/** 图表推荐结果 */
export interface ChartRecommendation {
  type: ChartType;
  confidence: number;  // 0-1
  reason: string;
  suggestedColumns: {
    [key: string]: string;  // role -> column name
  };
  alternativeTypes: ChartType[];
}

/**
 * 图表推荐器
 */
export class ChartRecommender {
  /**
   * 分析数据特征
   */
  analyzeData(data: QueryResult): DataAnalysis {
    const columns: ColumnAnalysis[] = data.columns.map((colName, idx) => {
      const values = data.rows.map(row => row[idx]);
      const nonNull = values.filter(v => v !== null && v !== undefined);
      
      // 检测类型
      const type = this.detectColumnType(nonNull);
      
      // 统计唯一值
      const uniqueValues = new Set(nonNull.map(v => String(v)));
      
      // 数值统计
      let min: number | undefined;
      let max: number | undefined;
      let mean: number | undefined;
      
      if (type === 'number') {
        const numValues = nonNull.filter(v => typeof v === 'number') as number[];
        if (numValues.length > 0) {
          min = Math.min(...numValues);
          max = Math.max(...numValues);
          mean = numValues.reduce((a, b) => a + b, 0) / numValues.length;
        }
      }
      
      // 检测是否为时间序列
      const isTimeSeries = type === 'date' || 
        (type === 'string' && this.looksLikeDate(nonNull.slice(0, 10)));
      
      return {
        name: colName,
        type,
        uniqueCount: uniqueValues.size,
        nullCount: values.length - nonNull.length,
        min,
        max,
        mean,
        sampleValues: nonNull.slice(0, 5),
        isTimeSeries
      };
    });
    
    const numericColumns = columns.filter(c => c.type === 'number').map(c => c.name);
    const categoricalColumns = columns.filter(c => c.type === 'string').map(c => c.name);
    const dateColumns = columns.filter(c => c.isTimeSeries).map(c => c.name);
    
    // 检测是否有多个系列
    const hasMultipleSeries = columns.some(c => 
      c.type === 'string' && c.uniqueCount > 1 && c.uniqueCount <= 10
    );
    
    // 检测是否是层级数据
    const isHierarchical = columns.some(c => 
      c.type === 'string' && c.name.toLowerCase().includes('parent')
    );
    
    return {
      columns,
      rowCount: data.rowCount,
      numericColumns,
      categoricalColumns,
      dateColumns,
      hasMultipleSeries,
      isHierarchical
    };
  }

  /**
   * 推荐图表类型
   */
  recommend(data: QueryResult): ChartRecommendation[] {
    const analysis = this.analyzeData(data);
    const recommendations: ChartRecommendation[] = [];
    
    // 规则 1: 时间序列数据 -> 折线图
    if (analysis.dateColumns.length > 0 && analysis.numericColumns.length > 0) {
      recommendations.push({
        type: 'line',
        confidence: 0.9,
        reason: '检测到时间维度和数值，适合展示趋势变化',
        suggestedColumns: {
          x: analysis.dateColumns[0],
          y: analysis.numericColumns[0]
        },
        alternativeTypes: ['bar', 'area']
      });
    }
    
    // 规则 2: 分类 + 数值 -> 柱状图
    if (analysis.categoricalColumns.length > 0 && analysis.numericColumns.length > 0) {
      const catCol = analysis.columns.find(c => 
        analysis.categoricalColumns.includes(c.name) && c.uniqueCount <= 20
      );
      
      if (catCol) {
        recommendations.push({
          type: 'bar',
          confidence: 0.85,
          reason: `分类数据 "${catCol.name}" 有 ${catCol.uniqueCount} 个唯一值，适合柱状图比较`,
          suggestedColumns: {
            x: catCol.name,
            y: analysis.numericColumns[0]
          },
          alternativeTypes: ['pie', 'treemap']
        });
      }
    }
    
    // 规则 3: 少量分类 + 数值 -> 饼图
    const suitableForPie = analysis.columns.filter(c => 
      c.type === 'string' && c.uniqueCount >= 2 && c.uniqueCount <= 8
    );
    
    if (suitableForPie.length > 0 && analysis.numericColumns.length > 0) {
      recommendations.push({
        type: 'pie',
        confidence: 0.75,
        reason: `分类数较少 (${suitableForPie[0].uniqueCount})，适合展示占比`,
        suggestedColumns: {
          name: suitableForPie[0].name,
          value: analysis.numericColumns[0]
        },
        alternativeTypes: ['bar', 'donut']
      });
    }
    
    // 规则 4: 两个数值列 -> 散点图
    if (analysis.numericColumns.length >= 2) {
      recommendations.push({
        type: 'scatter',
        confidence: 0.8,
        reason: '检测到两个数值维度，适合展示变量关系',
        suggestedColumns: {
          x: analysis.numericColumns[0],
          y: analysis.numericColumns[1]
        },
        alternativeTypes: ['bubble', 'heatmap']
      });
    }
    
    // 规则 5: 三个维度 (分类x分类x数值) -> 热力图
    if (analysis.categoricalColumns.length >= 2 && analysis.numericColumns.length > 0) {
      recommendations.push({
        type: 'heatmap',
        confidence: 0.7,
        reason: '检测到两个分类维度和数值，适合热力图展示密度',
        suggestedColumns: {
          x: analysis.categoricalColumns[0],
          y: analysis.categoricalColumns[1],
          value: analysis.numericColumns[0]
        },
        alternativeTypes: ['treemap', 'bar']
      });
    }
    
    // 规则 6: 多维度数值 -> 雷达图
    if (analysis.numericColumns.length >= 3) {
      recommendations.push({
        type: 'radar',
        confidence: 0.65,
        reason: `检测到 ${analysis.numericColumns.length} 个数值维度，适合雷达图对比`,
        suggestedColumns: {
          dimensions: analysis.numericColumns.slice(0, 6).join(',')
        },
        alternativeTypes: ['bar', 'parallel']
      });
    }
    
    // 规则 7: 转化/流程数据 -> 漏斗图
    const funnelKeywords = ['stage', 'step', 'phase', '阶段', '步骤', '环节', '转化'];
    const hasFunnelData = analysis.columns.some(c => 
      funnelKeywords.some(kw => c.name.toLowerCase().includes(kw))
    );
    
    if (hasFunnelData && analysis.numericColumns.length > 0) {
      const stageCol = analysis.columns.find(c => 
        funnelKeywords.some(kw => c.name.toLowerCase().includes(kw))
      );
      recommendations.push({
        type: 'funnel',
        confidence: 0.85,
        reason: '检测到转化/流程数据，适合漏斗图展示转化率',
        suggestedColumns: {
          stage: stageCol?.name || analysis.categoricalColumns[0],
          value: analysis.numericColumns[0]
        },
        alternativeTypes: ['bar', 'sankey']
      });
    }
    
    // 规则 8: 层级数据 -> 树图
    if (analysis.isHierarchical) {
      recommendations.push({
        type: 'treemap',
        confidence: 0.8,
        reason: '检测到层级结构数据，适合树图展示层级占比',
        suggestedColumns: {
          name: analysis.categoricalColumns[0],
          value: analysis.numericColumns[0]
        },
        alternativeTypes: ['sunburst', 'bar']
      });
    }
    
    // 规则 9: 流向数据 -> 桑基图
    const sourceTargetKeywords = ['source', 'target', 'from', 'to', '源', '目标', '来源', '去向'];
    const hasFlowData = analysis.columns.filter(c =>
      sourceTargetKeywords.some(kw => c.name.toLowerCase().includes(kw))
    ).length >= 2;
    
    if (hasFlowData && analysis.numericColumns.length > 0) {
      recommendations.push({
        type: 'sankey',
        confidence: 0.85,
        reason: '检测到流向数据，适合桑基图展示流动关系',
        suggestedColumns: {
          source: analysis.columns.find(c => 
            c.name.toLowerCase().includes('source') || c.name.toLowerCase().includes('from')
          )?.name || analysis.categoricalColumns[0],
          target: analysis.columns.find(c => 
            c.name.toLowerCase().includes('target') || c.name.toLowerCase().includes('to')
          )?.name || analysis.categoricalColumns[1],
          value: analysis.numericColumns[0]
        },
        alternativeTypes: ['chord', 'funnel']
      });
    }
    
    // 规则 10: 单数值 -> 仪表盘
    if (analysis.numericColumns.length === 1 && analysis.rowCount === 1) {
      recommendations.push({
        type: 'gauge',
        confidence: 0.9,
        reason: '单个数值指标，适合仪表盘展示',
        suggestedColumns: {
          value: analysis.numericColumns[0]
        },
        alternativeTypes: ['number', 'bar']
      });
    }
    
    // 规则 11: 开高低收 -> K线图
    const ohlcKeywords = ['open', 'high', 'low', 'close', '开', '高', '低', '收'];
    const hasOHLC = ohlcKeywords.every(kw =>
      analysis.columns.some(c => c.name.toLowerCase().includes(kw))
    );
    
    if (hasOHLC) {
      recommendations.push({
        type: 'candlestick',
        confidence: 0.95,
        reason: '检测到OHLC数据，适合K线图展示',
        suggestedColumns: {
          open: analysis.columns.find(c => c.name.toLowerCase().includes('open'))?.name || '',
          high: analysis.columns.find(c => c.name.toLowerCase().includes('high'))?.name || '',
          low: analysis.columns.find(c => c.name.toLowerCase().includes('low'))?.name || '',
          close: analysis.columns.find(c => c.name.toLowerCase().includes('close'))?.name || ''
        },
        alternativeTypes: ['line', 'bar']
      });
    }
    
    // 按置信度排序
    recommendations.sort((a, b) => b.confidence - a.confidence);
    
    // 如果没有推荐，返回默认
    if (recommendations.length === 0) {
      recommendations.push({
        type: 'bar',
        confidence: 0.5,
        reason: '默认推荐柱状图，适合大多数数据',
        suggestedColumns: {
          x: analysis.columns[0]?.name || '',
          y: analysis.numericColumns[0] || analysis.columns[1]?.name || ''
        },
        alternativeTypes: ['line', 'pie']
      });
    }
    
    return recommendations;
  }

  /**
   * 检测列类型
   */
  private detectColumnType(values: any[]): 'number' | 'string' | 'date' | 'boolean' {
    if (values.length === 0) return 'string';
    
    const sample = values.slice(0, 100);
    const types = sample.map(v => {
      if (typeof v === 'number') return 'number';
      if (typeof v === 'boolean') return 'boolean';
      if (v instanceof Date) return 'date';
      if (typeof v === 'string') {
        if (this.looksLikeDate([v])) return 'date';
        return 'string';
      }
      return 'string';
    });
    
    // 返回最常见的类型
    const typeCounts: Record<string, number> = {};
    types.forEach(t => typeCounts[t] = (typeCounts[t] || 0) + 1);
    
    const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
    return sorted[0][0] as any;
  }

  /**
   * 检测是否像日期
   */
  private looksLikeDate(values: any[]): boolean {
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}/,           // 2024-01-01
      /^\d{2}\/\d{2}\/\d{4}/,         // 01/01/2024
      /^\d{4}\/\d{2}\/\d{2}/,         // 2024/01/01
      /^\d{4}年\d{1,2}月\d{1,2}日/,   // 2024年1月1日
      /^\d{1,2}-\w{3}-\d{4}/,         // 01-Jan-2024
      /^\w{3}\s+\d{1,2},?\s+\d{4}/    // Jan 1, 2024
    ];
    
    return values.some(v => {
      if (typeof v !== 'string') return false;
      return datePatterns.some(p => p.test(v.trim()));
    });
  }

  /**
   * 获取图表类型说明
   */
  getChartDescription(type: ChartType): string {
    const requirements = CHART_DATA_REQUIREMENTS[type];
    return requirements?.description || '图表类型';
  }
}

// 导出便捷函数
export function recommendChart(data: QueryResult): ChartRecommendation[] {
  const recommender = new ChartRecommender();
  return recommender.recommend(data);
}

export function analyzeData(data: QueryResult): DataAnalysis {
  const recommender = new ChartRecommender();
  return recommender.analyzeData(data);
}