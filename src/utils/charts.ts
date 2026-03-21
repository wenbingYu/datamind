import * as fs from 'fs';
import * as path from 'path';
import { QueryResult } from '../types';

export type ChartType = 'bar' | 'line' | 'pie' | 'scatter';

export interface ChartConfig {
  title?: string;
  type: ChartType;
  data: QueryResult;
  xColumn?: string;
  yColumn?: string;
}

/**
 * 生成 ECharts 配置
 */
export function generateChartConfig(type: ChartType, data: QueryResult, options?: { title?: string; xColumn?: string; yColumn?: string }): any {
  const { title, xColumn, yColumn } = options || {};
  
  // 自动选择列
  const xCol = xColumn || data.columns[0];
  const yCol = yColumn || data.columns[1] || data.columns[0];
  
  // 提取数据
  const xData = data.rows.map(row => row[data.columns.indexOf(xCol)]);
  const yData = data.rows.map(row => row[data.columns.indexOf(yCol)]);
  
  const baseConfig: any = {
    title: {
      text: title || '数据分析图表',
      left: 'center',
      textStyle: {
        fontSize: 16
      }
    },
    tooltip: {
      trigger: type === 'pie' ? 'item' : 'axis'
    },
    toolbox: {
      feature: {
        saveAsImage: { title: '保存为图片' }
      }
    }
  };

  switch (type) {
    case 'bar':
      return {
        ...baseConfig,
        xAxis: {
          type: 'category',
          data: xData,
          axisLabel: {
            rotate: xData.length > 10 ? 45 : 0
          }
        },
        yAxis: {
          type: 'value'
        },
        series: [{
          name: yCol,
          type: 'bar',
          data: yData,
          itemStyle: {
            color: '#5470c6'
          }
        }]
      };

    case 'line':
      return {
        ...baseConfig,
        xAxis: {
          type: 'category',
          data: xData,
          axisLabel: {
            rotate: xData.length > 10 ? 45 : 0
          }
        },
        yAxis: {
          type: 'value'
        },
        series: [{
          name: yCol,
          type: 'line',
          data: yData,
          smooth: true,
          itemStyle: {
            color: '#5470c6'
          },
          areaStyle: {
            opacity: 0.3
          }
        }]
      };

    case 'pie':
      const pieData = data.rows.map(row => ({
        name: row[data.columns.indexOf(xCol)],
        value: row[data.columns.indexOf(yCol)]
      }));
      return {
        ...baseConfig,
        legend: {
          orient: 'vertical',
          left: 'left'
        },
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
          }
        }]
      };

    case 'scatter':
      return {
        ...baseConfig,
        xAxis: {
          type: 'value',
          name: xCol
        },
        yAxis: {
          type: 'value',
          name: yCol
        },
        series: [{
          name: '散点图',
          type: 'scatter',
          data: data.rows.map(row => [
            row[data.columns.indexOf(xCol)],
            row[data.columns.indexOf(yCol)]
          ]),
          symbolSize: 10
        }]
      };

    default:
      return baseConfig;
  }
}

/**
 * 渲染 ASCII 图表到终端
 */
export function renderASCIChart(config: any, type: ChartType, width: number = 60, height: number = 15): string {
  const lines: string[] = [];
  
  if (type === 'bar' || type === 'line') {
    const data = config.series?.[0]?.data || [];
    const xData = config.xAxis?.data || [];
    
    if (data.length === 0) {
      return '无数据';
    }
    
    // 计算最大最小值
    const values = data.map((v: any) => typeof v === 'number' ? v : 0);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    
    lines.push(`\n${config.title?.text || '图表'}\n`);
    lines.push('┌' + '─'.repeat(width - 2) + '┐');
    
    // 绘制条形图
    const barWidth = Math.floor((width - 2) / Math.max(data.length, 1));
    
    for (let row = height - 1; row >= 0; row--) {
      const threshold = min + (range * row) / (height - 1);
      let line = '│';
      
      for (let col = 0; col < data.length; col++) {
        const val = values[col] || 0;
        const barHeight = Math.floor(((val - min) / range) * (height - 1));
        
        if (type === 'bar') {
          line += barHeight >= row ? '█'.repeat(Math.max(1, barWidth - 1)) : ' '.repeat(Math.max(1, barWidth - 1));
        } else {
          // Line chart
          const lineRow = Math.floor(((val - min) / range) * (height - 1));
          if (lineRow === row) {
            line += '●'.padEnd(barWidth - 1);
          } else {
            line += ' '.repeat(barWidth - 1);
          }
        }
      }
      
      line += '│';
      lines.push(line);
    }
    
    lines.push('└' + '─'.repeat(width - 2) + '┘');
    
    // X 轴标签（简化）
    if (xData.length > 0 && xData.length <= 10) {
      const labels = xData.map((x: any) => String(x).substring(0, 6).padEnd(6));
      lines.push('  ' + labels.join('').substring(0, width - 2));
    }
    
    // 数值范围
    lines.push(`\n范围: ${formatValue(min)} - ${formatValue(max)}`);
  } else if (type === 'pie') {
    const data = config.series?.[0]?.data || [];
    
    lines.push(`\n${config.title?.text || '饼图'}\n`);
    
    const total = data.reduce((sum: number, item: any) => sum + (item.value || 0), 0);
    
    // 简单饼图（水平条形图）
    for (const item of data.slice(0, 10)) {
      const percent = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';
      const barLen = Math.floor((parseFloat(percent) / 100) * 20);
      const bar = '█'.repeat(barLen);
      lines.push(`${String(item.name).padEnd(15)} ${bar} ${percent}%`);
    }
    
    lines.push(`\n总计: ${formatValue(total)}`);
  }
  
  return lines.join('\n');
}

function formatValue(val: number): string {
  if (Math.abs(val) >= 1000000000) {
    return (val / 1000000000).toFixed(2) + 'B';
  } else if (Math.abs(val) >= 1000000) {
    return (val / 1000000).toFixed(2) + 'M';
  } else if (Math.abs(val) >= 1000) {
    return (val / 1000).toFixed(2) + 'K';
  }
  return val.toFixed(2);
}

/**
 * 保存图表配置为 JSON 文件
 */
export async function saveChartConfig(config: any, outputPath: string): Promise<void> {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));
}

/**
 * 保存图表为 HTML 文件（可在浏览器中查看）
 */
export async function saveChartHTML(config: any, outputPath: string): Promise<void> {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${config.title?.text || '图表'}</title>
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
  <style>
    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
    #chart { width: 800px; height: 600px; }
  </style>
</head>
<body>
  <div id="chart"></div>
  <script>
    const chart = echarts.init(document.getElementById('chart'));
    chart.setOption(${JSON.stringify(config, null, 2)});
    window.addEventListener('resize', () => chart.resize());
  </script>
</body>
</html>`;
  
  fs.writeFileSync(outputPath, html);
}

/**
 * 从 QueryResult 推断最佳图表类型
 */
export function inferChartType(data: QueryResult): ChartType {
  if (data.columns.length < 2) {
    return 'bar';
  }
  
  const firstCol = data.columns[0];
  const secondCol = data.columns[1];
  
  // 检查第一列是否是日期
  const firstRowVal = data.rows[0]?.[0];
  const isDate = typeof firstRowVal === 'string' && 
    (/^\d{4}-\d{2}-\d{2}/.test(firstRowVal) || 
     /^\d{2}\/\d{2}\/\d{4}/.test(firstRowVal));
  
  if (isDate) {
    return 'line';
  }
  
  // 检查第二列是否是数值
  const secondRowVal = data.rows[0]?.[1];
  if (typeof secondRowVal === 'number') {
    // 行数较少时用饼图
    if (data.rows.length <= 8) {
      return 'pie';
    }
    return 'bar';
  }
  
  return 'bar';
}