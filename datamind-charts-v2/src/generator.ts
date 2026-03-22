/**
 * DataMind 高级图表生成器
 */

import {
  ChartType,
  ChartOptions,
  ChartResult,
  ChartTheme,
  CHART_THEMES,
} from './types';

/** 查询结果结构 */
interface QueryResult {
  columns: string[];
  rows: any[][];
  rowCount: number;
}

/**
 * 图表生成器主类
 */
export class ChartGenerator {
  private theme: ChartTheme;
  private colors: typeof CHART_THEMES[ChartTheme];

  constructor(theme: ChartTheme = 'default') {
    this.theme = theme;
    this.colors = CHART_THEMES[theme];
  }

  /**
   * 生成图表配置
   */
  generate(data: QueryResult, options: ChartOptions): ChartResult {
    const { type } = options;
    
    switch (type) {
      case 'bar':
      case 'line':
      case 'pie':
      case 'scatter':
        return this.generateBasicChart(data, options);
      case 'heatmap':
        return this.generateHeatmap(data, options);
      case 'radar':
        return this.generateRadar(data, options);
      case 'funnel':
        return this.generateFunnel(data, options);
      case 'treemap':
        return this.generateTreemap(data, options);
      case 'sankey':
        return this.generateSankey(data, options);
      case 'gauge':
        return this.generateGauge(data, options);
      case 'boxplot':
        return this.generateBoxplot(data, options);
      case 'candlestick':
        return this.generateCandlestick(data, options);
      default:
        throw new Error(`不支持的图表类型: ${type}`);
    }
  }

  /**
   * 生成基础图表 (柱状图、折线图、饼图、散点图)
   */
  private generateBasicChart(data: QueryResult, options: ChartOptions): ChartResult {
    const { type, title, xColumn, yColumn, showLegend = true } = options;
    
    const xCol = xColumn || data.columns[0];
    const yCol = yColumn || data.columns[1] || data.columns[0];
    
    const xIdx = data.columns.indexOf(xCol);
    const yIdx = data.columns.indexOf(yCol as string);
    
    const xData = data.rows.map(row => row[xIdx]);
    const yData = data.rows.map(row => row[yIdx]);
    
    const baseConfig: any = {
      title: {
        text: title || '',
        left: 'center',
        textStyle: { color: this.colors.text }
      },
      tooltip: { trigger: type === 'pie' ? 'item' : 'axis' },
      backgroundColor: this.colors.background,
      color: this.colors.accent,
      animation: options.animation !== false
    };

    let config: any;
    
    switch (type) {
      case 'bar':
        config = {
          ...baseConfig,
          xAxis: {
            type: 'category',
            data: xData,
            axisLabel: { color: this.colors.text, rotate: xData.length > 10 ? 45 : 0 },
            axisLine: { lineStyle: { color: this.colors.grid } }
          },
          yAxis: {
            type: 'value',
            axisLabel: { color: this.colors.text },
            splitLine: { lineStyle: { color: this.colors.grid } }
          },
          series: [{
            name: yCol,
            type: 'bar',
            data: yData,
            itemStyle: { color: this.colors.primary }
          }]
        };
        break;
        
      case 'line':
        config = {
          ...baseConfig,
          xAxis: {
            type: 'category',
            data: xData,
            axisLabel: { color: this.colors.text },
            axisLine: { lineStyle: { color: this.colors.grid } }
          },
          yAxis: {
            type: 'value',
            axisLabel: { color: this.colors.text },
            splitLine: { lineStyle: { color: this.colors.grid } }
          },
          series: [{
            name: yCol,
            type: 'line',
            data: yData,
            smooth: true,
            itemStyle: { color: this.colors.primary },
            areaStyle: { opacity: 0.3 }
          }]
        };
        break;
        
      case 'pie':
        const pieData = data.rows.map(row => ({
          name: String(row[xIdx]),
          value: row[yIdx]
        }));
        config = {
          ...baseConfig,
          legend: showLegend ? {
            orient: 'vertical',
            left: 'left',
            textStyle: { color: this.colors.text }
          } : undefined,
          series: [{
            name: yCol,
            type: 'pie',
            radius: ['40%', '70%'],
            data: pieData,
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.5)'
              }
            },
            label: { color: this.colors.text }
          }]
        };
        break;
        
      case 'scatter':
        config = {
          ...baseConfig,
          xAxis: {
            type: 'value',
            name: xCol,
            axisLabel: { color: this.colors.text },
            splitLine: { lineStyle: { color: this.colors.grid } }
          },
          yAxis: {
            type: 'value',
            name: yCol,
            axisLabel: { color: this.colors.text },
            splitLine: { lineStyle: { color: this.colors.grid } }
          },
          series: [{
            name: '散点',
            type: 'scatter',
            data: data.rows.map(row => [row[xIdx], row[yIdx]]),
            symbolSize: 10,
            itemStyle: { color: this.colors.primary }
          }]
        };
        break;
        
      default:
        config = baseConfig;
    }

    return {
      config,
      type,
      theme: this.theme,
      recommendedExport: ['png', 'svg', 'html'],
      description: this.getChartDescription(type)
    };
  }

  /**
   * 生成热力图
   */
  private generateHeatmap(data: QueryResult, options: ChartOptions): ChartResult {
    const { title, xColumn, yColumn, valueColumn } = options;
    
    const xIdx = data.columns.indexOf(xColumn || data.columns[0]);
    const yIdx = data.columns.indexOf(yColumn || data.columns[1]);
    const vIdx = data.columns.indexOf(valueColumn || data.columns[2]);
    
    const xCategories = [...new Set(data.rows.map(row => row[xIdx]))];
    const yCategories = [...new Set(data.rows.map(row => row[yIdx]))];
    
    const heatmapData = data.rows.map(row => [
      xCategories.indexOf(row[xIdx]),
      yCategories.indexOf(row[yIdx]),
      row[vIdx]
    ]);
    
    const values = data.rows.map(row => row[vIdx]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    const config = {
      title: { text: title || '热力图', left: 'center', textStyle: { color: this.colors.text } },
      tooltip: { position: 'top' },
      backgroundColor: this.colors.background,
      grid: { top: 60, bottom: 60, left: 100, right: 50 },
      xAxis: { type: 'category', data: xCategories, splitArea: { show: true }, axisLabel: { color: this.colors.text, rotate: 45 } },
      yAxis: { type: 'category', data: yCategories, splitArea: { show: true }, axisLabel: { color: this.colors.text } },
      visualMap: { min, max, calculable: true, orient: 'horizontal', left: 'center', bottom: 10, inRange: { color: ['#f7fbff', '#08306b'] }, textStyle: { color: this.colors.text } },
      series: [{ name: '热力图', type: 'heatmap', data: heatmapData, label: { show: true, color: this.colors.text, fontSize: 10 } }]
    };

    return { config, type: 'heatmap', theme: this.theme, recommendedExport: ['png', 'svg'], description: '热力图展示二维数据的密度分布' };
  }

  /**
   * 生成雷达图
   */
  private generateRadar(data: QueryResult, options: ChartOptions): ChartResult {
    const { title } = options;
    const dimensions = data.columns;
    const metrics = data.rows.map((row, idx) => ({ name: `系列${idx + 1}`, value: row }));
    
    const indicatorMax = dimensions.map((_, colIdx) => {
      const colValues = data.rows.map(row => typeof row[colIdx] === 'number' ? row[colIdx] : 0);
      return Math.max(...colValues) * 1.2;
    });
    
    const config = {
      title: { text: title || '雷达图', left: 'center', textStyle: { color: this.colors.text } },
      tooltip: { trigger: 'item' },
      legend: { data: metrics.map(m => m.name), bottom: 10, textStyle: { color: this.colors.text } },
      backgroundColor: this.colors.background,
      radar: {
        indicator: dimensions.map((name, idx) => ({ name, max: indicatorMax[idx] })),
        shape: 'polygon',
        axisName: { color: this.colors.text },
        splitLine: { lineStyle: { color: this.colors.grid } }
      },
      series: [{ name: '雷达图', type: 'radar', data: metrics.map((m, idx) => ({ ...m, areaStyle: { opacity: 0.3 }, itemStyle: { color: this.colors.accent[idx % this.colors.accent.length] } })) }]
    };

    return { config, type: 'radar', theme: this.theme, recommendedExport: ['png', 'svg'], description: '雷达图用于多维度数据对比' };
  }

  /**
   * 生成漏斗图
   */
  private generateFunnel(data: QueryResult, options: ChartOptions): ChartResult {
    const { title, xColumn, valueColumn } = options;
    
    const stageIdx = data.columns.indexOf(xColumn || data.columns[0]);
    const valueIdx = data.columns.indexOf(valueColumn || data.columns[1]);
    
    const funnelData = data.rows.map(row => ({ name: String(row[stageIdx]), value: row[valueIdx] })).sort((a, b) => b.value - a.value);
    
    const config = {
      title: { text: title || '漏斗图', left: 'center', textStyle: { color: this.colors.text } },
      tooltip: { trigger: 'item' },
      legend: { data: funnelData.map(d => d.name), bottom: 10, textStyle: { color: this.colors.text } },
      backgroundColor: this.colors.background,
      series: [{
        name: '漏斗图',
        type: 'funnel',
        left: 'center',
        width: '80%',
        sort: 'descending',
        gap: 2,
        label: { show: true, position: 'inside', color: '#fff' },
        data: funnelData.map((d, idx) => ({ ...d, itemStyle: { color: this.colors.accent[idx % this.colors.accent.length] } }))
      }]
    };

    return { config, type: 'funnel', theme: this.theme, recommendedExport: ['png', 'svg'], description: '漏斗图展示流程各阶段的转化情况' };
  }

  /**
   * 生成树图
   */
  private generateTreemap(data: QueryResult, options: ChartOptions): ChartResult {
    const { title, xColumn, valueColumn } = options;
    
    const nameIdx = data.columns.indexOf(xColumn || data.columns[0]);
    const valueIdx = data.columns.indexOf(valueColumn || data.columns[1]);
    
    const treeData = data.rows.map(row => ({ name: String(row[nameIdx]), value: row[valueIdx] }));
    
    const config = {
      title: { text: title || '树图', left: 'center', textStyle: { color: this.colors.text } },
      tooltip: { trigger: 'item' },
      backgroundColor: this.colors.background,
      series: [{
        name: '树图',
        type: 'treemap',
        width: '90%',
        height: '80%',
        label: { show: true, color: '#fff' },
        data: treeData
      }]
    };

    return { config, type: 'treemap', theme: this.theme, recommendedExport: ['png', 'html'], description: '树图通过矩形面积展示层级数据的占比分布' };
  }

  /**
   * 生成桑基图
   */
  private generateSankey(data: QueryResult, options: ChartOptions): ChartResult {
    const { title, xColumn, yColumn, valueColumn } = options;
    
    const sourceIdx = data.columns.indexOf(xColumn || data.columns[0]);
    const targetIdx = data.columns.indexOf(yColumn || data.columns[1]);
    const valueIdx = data.columns.indexOf(valueColumn || data.columns[2]);
    
    const nodesSet = new Set<string>();
    data.rows.forEach(row => {
      nodesSet.add(String(row[sourceIdx]));
      nodesSet.add(String(row[targetIdx]));
    });
    
    const nodes = Array.from(nodesSet).map(name => ({ name }));
    const links = data.rows.map(row => ({
      source: String(row[sourceIdx]),
      target: String(row[targetIdx]),
      value: row[valueIdx]
    }));
    
    const config = {
      title: { text: title || '桑基图', left: 'center', textStyle: { color: this.colors.text } },
      tooltip: { trigger: 'item', triggerOn: 'mousemove' },
      backgroundColor: this.colors.background,
      series: [{
        name: '桑基图',
        type: 'sankey',
        layoutIterations: 32,
        nodeWidth: 20,
        nodeGap: 8,
        emphasis: { focus: 'adjacency' },
        label: { position: 'right', color: this.colors.text },
        lineStyle: { color: 'gradient', curveness: 0.5, opacity: 0.5 },
        data: nodes,
        links
      }]
    };

    return { config, type: 'sankey', theme: this.theme, recommendedExport: ['png', 'html'], description: '桑基图展示数据在不同节点之间的流动关系' };
  }

  /**
   * 生成仪表盘
   */
  private generateGauge(data: QueryResult, options: ChartOptions): ChartResult {
    const { title, valueColumn } = options;
    
    const valueIdx = data.columns.indexOf(valueColumn || data.columns[0]);
    const value = data.rows[0]?.[valueIdx] || 0;
    
    const config = {
      title: { text: title || '仪表盘', left: 'center', textStyle: { color: this.colors.text } },
      backgroundColor: this.colors.background,
      series: [{
        name: '仪表盘',
        type: 'gauge',
        min: 0,
        max: 100,
        splitNumber: 3,
        axisLine: { lineStyle: { width: 30, color: [[0.3, '#91cc75'], [0.7, '#fac858'], [1, '#ee6666']] } },
        pointer: { itemStyle: { color: 'auto' } },
        detail: { valueAnimation: true, formatter: '{value}', color: 'inherit', fontSize: 24 },
        data: [{ value, name: valueColumn || '值' }]
      }]
    };

    return { config, type: 'gauge', theme: this.theme, recommendedExport: ['png', 'svg'], description: `当前值: ${value}` };
  }

  /**
   * 生成箱线图
   */
  private generateBoxplot(data: QueryResult, options: ChartOptions): ChartResult {
    const { title, valueColumn } = options;
    
    const valueIdx = data.columns.indexOf(valueColumn || data.columns[0]);
    const values = data.rows.map(row => row[valueIdx]).filter(v => typeof v === 'number');
    values.sort((a, b) => a - b);
    
    const n = values.length;
    const q1 = values[Math.floor(n * 0.25)];
    const median = values[Math.floor(n * 0.5)];
    const q3 = values[Math.floor(n * 0.75)];
    const iqr = q3 - q1;
    const min = Math.max(values[0], q1 - 1.5 * iqr);
    const max = Math.min(values[n - 1], q3 + 1.5 * iqr);
    
    const config = {
      title: { text: title || '箱线图', left: 'center', textStyle: { color: this.colors.text } },
      tooltip: { trigger: 'item' },
      backgroundColor: this.colors.background,
      grid: { left: 60, right: 30, top: 60, bottom: 30 },
      xAxis: { type: 'category', data: ['数据'], axisLabel: { color: this.colors.text } },
      yAxis: { type: 'value', axisLabel: { color: this.colors.text }, splitLine: { lineStyle: { color: this.colors.grid } } },
      series: [{ name: '箱线图', type: 'boxplot', data: [[min, q1, median, q3, max]], itemStyle: { color: this.colors.primary, borderColor: this.colors.secondary } }]
    };

    return { config, type: 'boxplot', theme: this.theme, recommendedExport: ['png', 'svg'], description: '箱线图展示数据分布的中位数、四分位数' };
  }

  /**
   * 生成K线图
   */
  private generateCandlestick(data: QueryResult, options: ChartOptions): ChartResult {
    const { title, xColumn, yColumn, valueColumn } = options;
    
    // 假设数据格式: [open, close, low, high]
    const candleData = data.rows.map(row => [row[0], row[1], row[2], row[3]]);
    const dates = data.rows.map((_, i) => `Day ${i + 1}`);
    
    const config = {
      title: { text: title || 'K线图', left: 'center', textStyle: { color: this.colors.text } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      backgroundColor: this.colors.background,
      grid: { left: 60, right: 60, top: 60, bottom: 40 },
      xAxis: { type: 'category', data: dates, axisLabel: { color: this.colors.text } },
      yAxis: { scale: true, axisLabel: { color: this.colors.text }, splitLine: { lineStyle: { color: this.colors.grid } } },
      series: [{
        name: 'K线',
        type: 'candlestick',
        data: candleData,
        itemStyle: { color: '#ef5350', color0: '#26a69a', borderColor: '#ef5350', borderColor0: '#26a69a' }
      }]
    };

    return { config, type: 'candlestick', theme: this.theme, recommendedExport: ['png', 'svg'], description: 'K线图展示开盘、收盘、最高、最低价格走势' };
  }

  /**
   * 获取图表描述
   */
  private getChartDescription(type: ChartType): string {
    const descriptions: Record<ChartType, string> = {
      bar: '柱状图，适合展示分类数据的比较',
      line: '折线图，适合展示时间序列或连续数据趋势',
      pie: '饼图，适合展示占比分布',
      scatter: '散点图，适合展示两个变量的关系',
      heatmap: '热力图，适合展示二维数据的密度分布',
      radar: '雷达图，适合多维度数据对比',
      funnel: '漏斗图，适合展示流程转化',
      treemap: '树图，适合展示层级数据的占比',
      sankey: '桑基图，适合展示流向关系',
      gauge: '仪表盘，适合展示单个指标值',
      boxplot: '箱线图，适合展示数据分布和异常值',
      candlestick: 'K线图，适合展示股票等金融数据'
    };
    return descriptions[type];
  }
}

// 导出便捷函数
export function generateChart(data: QueryResult, options: ChartOptions): ChartResult {
  const generator = new ChartGenerator(options.theme);
  return generator.generate(data, options);
}

export { CHART_THEMES } from './types';