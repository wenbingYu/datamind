/**
 * DataMind 高级图表生成器
 * 支持热力图、雷达图、漏斗图、树图、桑基图等高级图表
 */

import {
  ChartType,
  ChartOptions,
  ChartResult,
  ChartTheme,
  CHART_THEMES,
  HeatmapOptions,
  RadarOptions,
  FunnelOptions,
  TreemapOptions,
  SankeyOptions,
  GaugeOptions,
  BoxplotOptions,
  CandlestickOptions
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
    
    // 根据图表类型调用对应的生成方法
    switch (type) {
      case 'bar':
      case 'line':
      case 'pie':
      case 'scatter':
        return this.generateBasicChart(data, options);
      case 'heatmap':
        return this.generateHeatmap(data, options as HeatmapOptions);
      case 'radar':
        return this.generateRadar(data, options as RadarOptions);
      case 'funnel':
        return this.generateFunnel(data, options as FunnelOptions);
      case 'treemap':
        return this.generateTreemap(data, options as TreemapOptions);
      case 'sankey':
        return this.generateSankey(data, options as SankeyOptions);
      case 'gauge':
        return this.generateGauge(data, options as GaugeOptions);
      case 'boxplot':
        return this.generateBoxplot(data, options as BoxplotOptions);
      case 'candlestick':
        return this.generateCandlestick(data, options as CandlestickOptions);
      default:
        throw new Error(`不支持的图表类型: ${type}`);
    }
  }

  /**
   * 生成基础图表 (柱状图、折线图、饼图、散点图)
   */
  private generateBasicChart(data: QueryResult, options: ChartOptions): ChartResult {
    const { type, title, xColumn, yColumn, showLegend = true, showToolbox = true } = options;
    
    const xCol = xColumn || data.columns[0];
    const yCol = yColumn || data.columns[1] || data.columns[0];
    
    const xIdx = data.columns.indexOf(xCol);
    const yIdx = data.columns.indexOf(yCol);
    
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

    if (showToolbox) {
      baseConfig.toolbox = {
        feature: {
          saveAsImage: { title: '保存图片' },
          dataView: { title: '数据视图', readOnly: true },
          restore: { title: '还原' }
        }
      };
    }

    let config: any;
    
    switch (type) {
      case 'bar':
        config = {
          ...baseConfig,
          xAxis: {
            type: 'category',
            data: xData,
            axisLabel: { 
              color: this.colors.text,
              rotate: xData.length > 10 ? 45 : 0
            },
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
  private generateHeatmap(data: QueryResult, options: HeatmapOptions): ChartResult {
    const { title, xColumn, yColumn, valueColumn, showLabels = true, colorRange } = options;
    
    const xIdx = data.columns.indexOf(xColumn || data.columns[0]);
    const yIdx = data.columns.indexOf(yColumn || data.columns[1]);
    const vIdx = data.columns.indexOf(valueColumn || data.columns[2]);
    
    // 提取唯一的 X 和 Y 值
    const xCategories = [...new Set(data.rows.map(row => row[xIdx]))];
    const yCategories = [...new Set(data.rows.map(row => row[yIdx]))];
    
    // 转换为热力图数据格式 [x_index, y_index, value]
    const heatmapData = data.rows.map(row => {
      const xVal = row[xIdx];
      const yVal = row[yIdx];
      const vVal = row[vIdx];
      return [
        xCategories.indexOf(xVal),
        yCategories.indexOf(yVal),
        vVal
      ];
    });
    
    // 计算数值范围
    const values = data.rows.map(row => row[vIdx]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    const config = {
      title: {
        text: title || '热力图',
        left: 'center',
        textStyle: { color: this.colors.text }
      },
      tooltip: {
        position: 'top',
        formatter: (params: any) => {
          const [x, y, v] = params.data;
          return `${xCategories[x]} - ${yCategories[y]}: ${v}`;
        }
      },
      backgroundColor: this.colors.background,
      grid: {
        top: 60,
        bottom: 60,
        left: 100,
        right: 50
      },
      xAxis: {
        type: 'category',
        data: xCategories,
        splitArea: { show: true },
        axisLabel: { color: this.colors.text, rotate: 45 }
      },
      yAxis: {
        type: 'category',
        data: yCategories,
        splitArea: { show: true },
        axisLabel: { color: this.colors.text }
      },
      visualMap: {
        min,
        max,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 10,
        inRange: {
          color: colorRange || ['#f7fbff', '#08306b']
        },
        textStyle: { color: this.colors.text }
      },
      series: [{
        name: '热力图',
        type: 'heatmap',
        data: heatmapData,
        label: {
          show: showLabels,
          color: this.colors.text,
          fontSize: 10
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }]
    };

    return {
      config,
      type: 'heatmap',
      theme: this.theme,
      recommendedExport: ['png', 'svg'],
      description: '热力图展示了二维数据的密度分布，颜色深浅代表数值大小',
      insights: this.generateHeatmapInsights(heatmapData, xCategories, yCategories)
    };
  }

  /**
   * 生成雷达图
   */
  private generateRadar(data: QueryResult, options: RadarOptions): ChartResult {
    const { title, shape = 'polygon', filled = true } = options;
    
    // 使用第一行作为维度名称，其余行作为数据
    const dimensions = options.dimensions || data.columns;
    const metrics = data.rows.map((row, idx) => ({
      name: `系列${idx + 1}`,
      value: row.slice(0, dimensions.length)
    }));
    
    // 计算每个维度的最大值
    const indicatorMax = dimensions.map((_, colIdx) => {
      const colValues = data.rows.map(row => {
        const val = row[colIdx];
        return typeof val === 'number' ? val : 0;
      });
      return Math.max(...colValues) * 1.2;
    });
    
    const config = {
      title: {
        text: title || '雷达图',
        left: 'center',
        textStyle: { color: this.colors.text }
      },
      tooltip: {
        trigger: 'item'
      },
      legend: {
        data: metrics.map(m => m.name),
        bottom: 10,
        textStyle: { color: this.colors.text }
      },
      backgroundColor: this.colors.background,
      radar: {
        indicator: dimensions.map((name, idx) => ({
          name,
          max: indicatorMax[idx]
        })),
        shape,
        splitNumber: 5,
        axisName: {
          color: this.colors.text
        },
        splitLine: {
          lineStyle: { color: this.colors.grid }
        },
        splitArea: {
          areaStyle: { color: ['rgba(114, 172, 209, 0.2)', 'rgba(114, 172, 209, 0.1)'] }
        },
        axisLine: {
          lineStyle: { color: this.colors.grid }
        }
      },
      series: [{
        name: '雷达图',
        type: 'radar',
        data: metrics.map((m, idx) => ({
          name: m.name,
          value: m.value,
          areaStyle: filled ? { opacity: 0.3 } : undefined,
          itemStyle: { color: this.colors.accent[idx % this.colors.accent.length] }
        }))
      }]
    };

    return {
      config,
      type: 'radar',
      theme: this.theme,
      recommendedExport: ['png', 'svg'],
      description: '雷达图用于多维度数据对比，每个轴代表一个维度',
      insights: this.generateRadarInsights(metrics, dimensions)
    };
  }

  /**
   * 生成漏斗图
   */
  private generateFunnel(data: QueryResult, options: FunnelOptions): ChartResult {
    const { title, stageColumn, valueColumn, sort = 'descending', align = 'center', showConversionRate = true } = options;
    
    const stageIdx = data.columns.indexOf(stageColumn || data.columns[0]);
    const valueIdx = data.columns.indexOf(valueColumn || data.columns[1]);
    
    // 准备漏斗数据
    let funnelData = data.rows.map(row => ({
      name: String(row[stageIdx]),
      value: row[valueIdx]
    }));
    
    // 排序
    if (sort === 'descending') {
      funnelData.sort((a, b) => b.value - a.value);
    } else if (sort === 'ascending') {
      funnelData.sort((a, b) => a.value - b.value);
    }
    
    // 计算转换率
    const maxValue = funnelData[0]?.value || 1;
    const insights: string[] = [];
    if (showConversionRate && funnelData.length > 1) {
      for (let i = 1; i < funnelData.length; i++) {
        const rate = ((funnelData[i].value / funnelData[i-1].value) * 100).toFixed(1);
        insights.push(`${funnelData[i-1].name} → ${funnelData[i].name}: ${rate}%`);
      }
    }
    
    const config = {
      title: {
        text: title || '漏斗图',
        left: 'center',
        textStyle: { color: this.colors.text }
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const percent = ((params.value / maxValue) * 100).toFixed(1);
          return `${params.name}: ${params.value} (${percent}%)`;
        }
      },
      legend: {
        data: funnelData.map(d => d.name),
        bottom: 10,
        textStyle: { color: this.colors.text }
      },
      backgroundColor: this.colors.background,
      series: [{
        name: '漏斗图',
        type: 'funnel',
        left: align,
        width: '80%',
        min: 0,
        max: maxValue,
        minSize: '0%',
        maxSize: '100%',
        sort,
        gap: 2,
        label: {
          show: true,
          position: 'inside',
          color: '#fff'
        },
        labelLine: {
          length: 10,
          lineStyle: { width: 1, type: 'solid' }
        },
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 1
        },
        emphasis: {
          label: { fontSize: 14 }
        },
        data: funnelData.map((d, idx) => ({
          ...d,
          itemStyle: { color: this.colors.accent[idx % this.colors.accent.length] }
        }))
      }]
    };

    return {
      config,
      type: 'funnel',
      theme: this.theme,
      recommendedExport: ['png', 'svg'],
      description: '漏斗图展示流程各阶段的转化情况',
      insights
    };
  }

  /**
   * 生成树图
   */
  private generateTreemap(data: QueryResult, options: TreemapOptions): ChartResult {
    const { title, nameColumn, valueColumn, showLabels = true, leafDepth } = options;
    
    const nameIdx = data.columns.indexOf(nameColumn || data.columns[0]);
    const valueIdx = data.columns.indexOf(valueColumn || data.columns[1]);
    
    // 准备树图数据
    const treeData = data.rows.map(row => ({
      name: String(row[nameIdx]),
      value: row[valueIdx]
    }));
    
    // 计算总值用于洞察
    const total = treeData.reduce((sum, d) => sum + (d.value || 0), 0);
    const topItems = [...treeData].sort((a, b) => b.value - a.value).slice(0, 3);
    
    const config = {
      title: {
        text: title || '树图',
        left: 'center',
        textStyle: { color: this.colors.text }
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const percent = ((params.value / total) * 100).toFixed(1);
          return `${params.name}: ${params.value} (${percent}%)`;
        }
      },
      backgroundColor: this.colors.background,
      series: [{
        name: '树图',
        type: 'treemap',
        width: '90%',
        height: '80%',
        roam: false,
        nodeClick: 'link',
        breadcrumb: {
          show: true,
          itemStyle: {
            textStyle: { color: this.colors.text }
          }
        },
        label: {
          show: showLabels,
          formatter: (params: any) => {
            const percent = ((params.value / total) * 100).toFixed(1);
            return `${params.name}\n${params.value}\n(${percent}%)`;
          },
          color: '#fff'
        },
        upperLabel: {
          show: true,
          height: 30,
          color: '#fff'
        },
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 2,
          gapWidth: 2
        },
        levels: [
          {
            itemStyle: {
              borderColor: '#555',
              borderWidth: 4,
              gapWidth: 4
            }
          },
          {
            colorSaturation: [0.35, 0.5],
            itemStyle: {
              borderColorSaturation: 0.6,
              gapWidth: 2
            }
          }
        ],
        data: treeData
      }]
    };

    // 添加 leafDepth 配置
    if (leafDepth) {
      config.series[0].leafDepth = leafDepth;
    }

    return {
      config,
      type: 'treemap',
      theme: this.theme,
      recommendedExport: ['png', 'html'],
      description: '树图通过矩形面积展示层级数据的占比分布',
      insights: [
        `总计: ${total.toLocaleString()}`,
        `最大项: ${topItems[0]?.name} (${topItems[0]?.value})`,
        `Top 3 占比: ${((topItems.reduce((s, i) => s + i.value, 0) / total) * 100).toFixed(1)}%`
      ]
    };
  }

  /**
   * 生成桑基图
   */
  private generateSankey(data: QueryResult, options: SankeyOptions): ChartResult {
    const { 
      title, 
      sourceColumn, 
      targetColumn, 
      valueColumn,
      nodeWidth = 20,
      nodeGap = 8,
      layoutIterations = 32
    } = options;
    
    const sourceIdx = data.columns.indexOf(sourceColumn || data.columns[0]);
    const targetIdx = data.columns.indexOf(targetColumn || data.columns[1]);
    const valueIdx = data.columns.indexOf(valueColumn || data.columns[2]);
    
    // 提取所有节点
    const nodesSet = new Set<string>();
    data.rows.forEach(row => {
      nodesSet.add(String(row[sourceIdx]));
      nodesSet.add(String(row[targetIdx]));
    });
    
    const nodes = Array.from(nodesSet).map(name => ({ name }));
    
    // 准备链接数据
    const links = data.rows.map(row => ({
      source: String(row[sourceIdx]),
      target: String(row[targetIdx]),
      value: row[valueIdx]
    }));
    
    const config = {
      title: {
        text: title || '桑基图',
        left: 'center',
        textStyle: { color: this.colors.text }
      },
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove'
      },
      backgroundColor: this.colors.background,
      series: [{
        name: '桑基图',
        type: 'sankey',
        layoutIterations,
        nodeWidth,
        nodeGap,
        layout: 'none',
        emphasis: {
          focus: 'adjacency'
        },
        label: {
          position: 'right',
          color: this.colors.text,
          fontSize: 12
        },
        lineStyle: {
          color: 'gradient',
          curveness: 0.5,
          opacity: 0.5
        },
        data: nodes,
        links,
        itemStyle: {
          borderWidth: 0
        }
      }]
    };

    return {
      config,
      type: 'sankey',
      theme: this.theme,
      recommendedExport: ['png', 'html'],
      description: '桑基图展示数据在不同节点之间的流动关系'
    };
  }

  /**
   * 生成仪表盘
   */
  private generateGauge(data: QueryResult, options: GaugeOptions): ChartResult {
    const { title, valueColumn, min = 0, max = 100, splits, unit = '' } = options;
    
    const valueIdx = data.columns.indexOf(valueColumn || data.columns[0]);
    const value = data.rows[0]?.[valueIdx] || 0;
    
    // 默认分段
    const defaultSplits = [
      { value: max * 0.3, color: '#91cc75', label: '低' },
      { value: max * 0.7, color: '#fac858', label: '中' },
      { value: max, color: '#ee6666', label: '高' }
    ];
    const splitConfig = splits || defaultSplits;
    
    const config = {
      title: {
        text: title || '仪表盘',
        left: 'center',
        textStyle: { color: this.colors.text }
      },
      backgroundColor: this.colors.background,
      series: [{
        name: '仪表盘',
        type: 'gauge',
        min,
        max,
        splitNumber: splitConfig.length,
        axisLine: {
          lineStyle: {
            width: 30,
            color: splitConfig.map(s => [s.value / max, s.color])
          }
        },
        pointer: {
          itemStyle: {
            color: 'auto'
          }
        },
        axisTick: {
          distance: -30,
          length: 8,
          lineStyle: {
            color: '#fff',
            width: 2
          }
        },
        splitLine: {
          distance: -30,
          length: 30,
          lineStyle: {
            color: '#fff',
            width: 4
          }
        },
        axisLabel: {
          color: 'inherit',
          distance: 40,
          fontSize: 12
        },
        detail: {
          valueAnimation: true,
          formatter: `{value}${unit}`,
          color: 'inherit',
          fontSize: 24
        },
        data: [{ value, name: valueColumn }]
      }]
    };

    return {
      config,
      type: 'gauge',
      theme: this.theme,
      recommendedExport: ['png', 'svg'],
      description: `当前值: ${value}${unit}`,
      insights: [
        `当前: ${value}${unit}`,
        `范围: ${min} - ${max}${unit}`
      ]
    };
  }

  /**
   * 生成箱线图
   */
  private generateBoxplot(data: QueryResult, options: BoxplotOptions): ChartResult {
    const { title, groupColumn, valueColumn, showOutliers = true } = options;
    
    const groupIdx = groupColumn ? data.columns.indexOf(groupColumn) : -1;
    const valueIdx = data.columns.indexOf(valueColumn || data.columns[0]);
    
    // 分组统计
    const groups: Record<string, number[]> = {};
    
    if (groupIdx >= 0) {
      data.rows.forEach(row => {
        const key = String(row[groupIdx]);
        const val = row[valueIdx];
        if (typeof val === 'number') {
          if (!groups[key]) groups[key] = [];
          groups[key].push(val);
        }
      });
    } else {
      groups['all'] = data.rows.map(row => row[valueIdx]).filter(v => typeof v === 'number');
    }
    
    // 计算箱线图数据 [min, Q1, median, Q3, max]
    const boxplotData: number[][] = [];
    const outliers: [string, number][] = [];
    const categories: string[] = [];
    
    Object.entries(groups).forEach(([name, values]) => {
      categories.push(name);
      values.sort((a, b) => a - b);
      
      const n = values.length;
      const q1 = values[Math.floor(n * 0.25)];
      const median = values[Math.floor(n * 0.5)];
      const q3 = values[Math.floor(n * 0.75)];
      const iqr = q3 - q1;
      const min = Math.max(values[0], q1 - 1.5 * iqr);
      const max = Math.min(values[n - 1], q3 + 1.5 * iqr);
      
      boxplotData.push([min, q1, median, q3, max]);
      
      // 异常值
      if (showOutliers) {
        values.forEach(v => {
          if (v < min || v > max) {
            outliers.push([name, v]);
          }
        });
      }
    });
    
    const config = {
      title: {
        text: title || '箱线图',
        left: 'center',
        textStyle: { color: this.colors.text }
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          if (params.seriesType === 'boxplot') {
            const [min, q1, median, q3, max] = params.data;
            return `${params.name}<br/>最小: ${min}<br/>Q1: ${q1}<br/>中位数: ${median}<br/>Q3: ${q3}<br/>最大: ${max}`;
          }
          return `${params.data[0]}: ${params.data[1]}`;
        }
      },
      backgroundColor: this.colors.background,
      grid: {
        left: 60,
        right: 30,
        top: 60,
        bottom: 30
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: { color: this.colors.text },
        axisLine: { lineStyle: { color: this.colors.grid } }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: this.colors.text },
        splitLine: { lineStyle: { color: this.colors.grid } }
      },
      series: [
        {
          name: '箱线图',
          type: 'boxplot',
          data: boxplotData,
          itemStyle: {
            color: this.colors.primary,
            borderColor: this.colors.secondary
          }
        },
        ...(showOutliers && outliers.length > 0 ? [{
          name: '异常值',
          type: 'scatter',
          data: outliers.map(o => [categories.indexOf(o[0]), o[1]]),
          itemStyle: { color: '#ee6666' }
        }] : [])
      ]
    };

    return {
      config,
      type: 'boxplot',
      theme: this.theme,
      recommendedExport: ['png', 'svg'],
      description: '箱线图展示数据分布的中位数、四分位数和异常值',
      insights: this.generateBoxplotInsights(groups)
    };
  }

  /**
   * 生成K线图
   */
  private generateCandlestick(data: QueryResult, options: CandlestickOptions): ChartResult {
    const { 
      title, 
      openColumn, 
      closeColumn, 
      lowColumn, 
      highColumn,
      dateColumn,
      volumeColumn
    } = options;
    
    const openIdx = data.columns.indexOf(openColumn || data.columns[0]);
    const closeIdx = data.columns.indexOf(closeColumn || data.columns[1]);
    const lowIdx = data.columns.indexOf(lowColumn || data.columns[2]);
    const highIdx = data.columns.indexOf(highColumn || data.columns[3]);
    const dateIdx = dateColumn ? data.columns.indexOf(dateColumn) : -1;
    const volumeIdx = volumeColumn ? data.columns.indexOf(volumeColumn) : -1;
    
    // 准备K线数据 [open, close, low, high]
    const candleData = data.rows.map(row => [
      row[openIdx],
      row[closeIdx],
      row[lowIdx],
      row[highIdx]
    ]);
    
    const dates = dateIdx >= 0 
      ? data.rows.map(row => String(row[dateIdx]))
      : data.rows.map((_, i) => `Day ${i + 1}`);
    
    const config: any = {
      title: {
        text: title || 'K线图',
        left: 'center',
        textStyle: { color: this.colors.text }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' }
      },
      backgroundColor: this.colors.background,
      legend: {
        data: ['K线'],
        textStyle: { color: this.colors.text }
      },
      grid: {
        left: 60,
        right: 60,
        top: volumeIdx >= 0 ? 60 : 80,
        bottom: volumeIdx >= 0 ? 80 : 40
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { color: this.colors.text },
        axisLine: { lineStyle: { color: this.colors.grid } }
      },
      yAxis: [
        {
          scale: true,
          axisLabel: { color: this.colors.text },
          splitLine: { lineStyle: { color: this.colors.grid } }
        }
      ],
      series: [{
        name: 'K线',
        type: 'candlestick',
        data: candleData,
        itemStyle: {
          color: '#ef5350',      // 阳线填充
          color0: '#26a69a',     // 阴线填充
          borderColor: '#ef5350', // 阳线边框
          borderColor0: '#26a69a' // 阴线边框
        }
      }]
    };
    
    // 添加成交量
    if (volumeIdx >= 0) {
      const volumeData = data.rows.map(row => row[volumeIdx]);
      config.yAxis.push({
        scale: true,
        gridIndex: 1,
        splitNumber: 2,
        axisLabel: { color: this.colors.text },
        splitLine: { show: false }
      });
      config.xAxis = [{ ...config.xAxis }, { ...config.xAxis, gridIndex: 1 }];
      config.grid = [
        { left: 60, right: 60, top: 60, height: '50%' },
        { left: 60, right: 60, top: '70%', height: '20%' }
      ];
      config.series.push({
        name: '成交量',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumeData,
        itemStyle: { color: this.colors.primary }
      });
    }

    return {
      config,
      type: 'candlestick',
      theme: this.theme,
      recommendedExport: ['png', 'svg'],
      description: 'K线图展示开盘、收盘、最高、最低价格走势'
    };
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

  /**
   * 生成热力图洞察
   */
  private generateHeatmapInsights(data: number[][], xCats: any[], yCats: any[]): string[] {
    const insights: string[] = [];
    
    // 找最大值和最小值
    let maxVal = -Infinity, minVal = Infinity;
    let maxPos = [0, 0], minPos = [0, 0];
    
    data.forEach(([x, y, v]) => {
      if (v > maxVal) { maxVal = v; maxPos = [x, y]; }
      if (v < minVal) { minVal = v; minPos = [x, y]; }
    });
    
    insights.push(`最高值: ${xCats[maxPos[0]]} - ${yCats[maxPos[1]]} = ${maxVal}`);
    insights.push(`最低值: ${xCats[minPos[0]]} - ${yCats[minPos[1]]} = ${minVal}`);
    
    return insights;
  }

  /**
   * 生成雷达图洞察
   */
  private generateRadarInsights(metrics: { name: string; value: any[] }[], dimensions: string[]): string[] {
    const insights: string[] = [];
    
    if (metrics.length > 0) {
      const values = metrics[0].value;
      const maxIdx = values.indexOf(Math.max(...values));
      const minIdx = values.indexOf(Math.min(...values));
      
      insights.push(`最强维度: ${dimensions[maxIdx]} (${values[maxIdx]})`);
      insights.push(`最弱维度: ${dimensions[minIdx]} (${values[minIdx]})`);
    }
    
    return insights;
  }

  /**
   * 生成箱线图洞察
   */
  private generateBoxplotInsights(groups: Record<string, number[]>): string[] {
    const insights: string[] = [];
    
    Object.entries(groups).forEach(([name, values]) => {
      const n = values.length;
      const mean = values.reduce((a, b) => a + b, 0) / n;
      const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
      const std = Math.sqrt(variance);
      
      insights.push(`${name}: 均值=${mean.toFixed(2)}, 标准差=${std.toFixed(2)}, 样本数=${n}`);
    });
    
    return insights.slice(0, 5);
  }
}

// 导出便捷函数
export function generateChart(data: QueryResult, options: ChartOptions): ChartResult {
  const generator = new ChartGenerator(options.theme);
  return generator.generate(data, options);
}

export { CHART_THEMES } from './types';