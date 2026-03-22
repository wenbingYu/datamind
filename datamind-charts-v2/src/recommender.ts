/**
 * DataMind 智能图表推荐器
 */

import { ChartType, CHART_DATA_REQUIREMENTS } from './types';

interface QueryResult {
  columns: string[];
  rows: any[][];
  rowCount: number;
}

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

interface DataAnalysis {
  columns: ColumnAnalysis[];
  rowCount: number;
  numericColumns: string[];
  categoricalColumns: string[];
  dateColumns: string[];
  hasMultipleSeries: boolean;
  isHierarchical: boolean;
}

export interface ChartRecommendation {
  type: ChartType;
  confidence: number;
  reason: string;
  suggestedColumns: Record<string, string>;
  alternativeTypes: ChartType[];
}

export class ChartRecommender {
  analyzeData(data: QueryResult): DataAnalysis {
    const columns: ColumnAnalysis[] = data.columns.map((colName, idx) => {
      const values = data.rows.map(row => row[idx]);
      const nonNull = values.filter(v => v !== null && v !== undefined);
      const type = this.detectColumnType(nonNull);
      const uniqueValues = new Set(nonNull.map(v => String(v)));
      
      let min: number | undefined, max: number | undefined, mean: number | undefined;
      if (type === 'number') {
        const nums = nonNull.filter(v => typeof v === 'number') as number[];
        if (nums.length > 0) {
          min = Math.min(...nums);
          max = Math.max(...nums);
          mean = nums.reduce((a, b) => a + b, 0) / nums.length;
        }
      }
      
      return {
        name: colName,
        type,
        uniqueCount: uniqueValues.size,
        nullCount: values.length - nonNull.length,
        min, max, mean,
        sampleValues: nonNull.slice(0, 5),
        isTimeSeries: type === 'date' || (type === 'string' && this.looksLikeDate(nonNull.slice(0, 10)))
      };
    });
    
    return {
      columns,
      rowCount: data.rowCount,
      numericColumns: columns.filter(c => c.type === 'number').map(c => c.name),
      categoricalColumns: columns.filter(c => c.type === 'string').map(c => c.name),
      dateColumns: columns.filter(c => c.isTimeSeries).map(c => c.name),
      hasMultipleSeries: columns.some(c => c.type === 'string' && c.uniqueCount > 1 && c.uniqueCount <= 10),
      isHierarchical: columns.some(c => c.type === 'string' && c.name.toLowerCase().includes('parent'))
    };
  }

  recommend(data: QueryResult): ChartRecommendation[] {
    const analysis = this.analyzeData(data);
    const recommendations: ChartRecommendation[] = [];
    
    // 时间序列 -> 折线图
    if (analysis.dateColumns.length > 0 && analysis.numericColumns.length > 0) {
      recommendations.push({
        type: 'line',
        confidence: 0.9,
        reason: '检测到时间维度和数值，适合展示趋势变化',
        suggestedColumns: { x: analysis.dateColumns[0], y: analysis.numericColumns[0] },
        alternativeTypes: ['bar']
      });
    }
    
    // 分类 + 数值 -> 柱状图
    if (analysis.categoricalColumns.length > 0 && analysis.numericColumns.length > 0) {
      const catCol = analysis.columns.find(c => analysis.categoricalColumns.includes(c.name) && c.uniqueCount <= 20);
      if (catCol) {
        recommendations.push({
          type: 'bar',
          confidence: 0.85,
          reason: `分类数据 "${catCol.name}" 有 ${catCol.uniqueCount} 个唯一值，适合柱状图比较`,
          suggestedColumns: { x: catCol.name, y: analysis.numericColumns[0] },
          alternativeTypes: ['pie', 'treemap']
        });
      }
    }
    
    // 少量分类 + 数值 -> 饼图
    const suitableForPie = analysis.columns.filter(c => c.type === 'string' && c.uniqueCount >= 2 && c.uniqueCount <= 8);
    if (suitableForPie.length > 0 && analysis.numericColumns.length > 0) {
      recommendations.push({
        type: 'pie',
        confidence: 0.75,
        reason: `分类数较少 (${suitableForPie[0].uniqueCount})，适合展示占比`,
        suggestedColumns: { name: suitableForPie[0].name, value: analysis.numericColumns[0] },
        alternativeTypes: ['bar']
      });
    }
    
    // 两个数值列 -> 散点图
    if (analysis.numericColumns.length >= 2) {
      recommendations.push({
        type: 'scatter',
        confidence: 0.8,
        reason: '检测到两个数值维度，适合展示变量关系',
        suggestedColumns: { x: analysis.numericColumns[0], y: analysis.numericColumns[1] },
        alternativeTypes: ['heatmap']
      });
    }
    
    // 多维度数值 -> 雷达图
    if (analysis.numericColumns.length >= 3) {
      recommendations.push({
        type: 'radar',
        confidence: 0.65,
        reason: `检测到 ${analysis.numericColumns.length} 个数值维度，适合雷达图对比`,
        suggestedColumns: { dimensions: analysis.numericColumns.slice(0, 6).join(',') },
        alternativeTypes: ['bar']
      });
    }
    
    // 转化数据 -> 漏斗图
    const funnelKeywords = ['stage', 'step', 'phase', '阶段', '步骤', '环节'];
    const hasFunnelData = analysis.columns.some(c => funnelKeywords.some(kw => c.name.toLowerCase().includes(kw)));
    if (hasFunnelData && analysis.numericColumns.length > 0) {
      const stageCol = analysis.columns.find(c => funnelKeywords.some(kw => c.name.toLowerCase().includes(kw)));
      recommendations.push({
        type: 'funnel',
        confidence: 0.85,
        reason: '检测到转化/流程数据，适合漏斗图展示转化率',
        suggestedColumns: { stage: stageCol?.name || analysis.categoricalColumns[0], value: analysis.numericColumns[0] },
        alternativeTypes: ['bar', 'sankey']
      });
    }
    
    // 单数值 -> 仪表盘
    if (analysis.numericColumns.length === 1 && analysis.rowCount === 1) {
      recommendations.push({
        type: 'gauge',
        confidence: 0.9,
        reason: '单个数值指标，适合仪表盘展示',
        suggestedColumns: { value: analysis.numericColumns[0] },
        alternativeTypes: ['bar']
      });
    }
    
    return recommendations.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
  }

  private detectColumnType(values: any[]): 'number' | 'string' | 'date' | 'boolean' {
    if (values.length === 0) return 'string';
    const types = values.slice(0, 100).map(v => {
      if (typeof v === 'number') return 'number';
      if (typeof v === 'boolean') return 'boolean';
      if (v instanceof Date) return 'date';
      if (typeof v === 'string' && this.looksLikeDate([v])) return 'date';
      return 'string';
    });
    const counts: Record<string, number> = {};
    types.forEach(t => counts[t] = (counts[t] || 0) + 1);
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as any;
  }

  private looksLikeDate(values: any[]): boolean {
    const patterns = [/^\d{4}-\d{2}-\d{2}/, /^\d{2}\/\d{2}\/\d{4}/, /^\d{4}\/\d{2}\/\d{2}/, /^\d{4}年\d{1,2}月\d{1,2}日/];
    return values.some(v => typeof v === 'string' && patterns.some(p => p.test(v.trim())));
  }
}

export function recommendChart(data: QueryResult): ChartRecommendation[] {
  return new ChartRecommender().recommend(data);
}

export function analyzeData(data: QueryResult): DataAnalysis {
  return new ChartRecommender().analyzeData(data);
}