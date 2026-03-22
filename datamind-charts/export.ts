/**
 * DataMind 图表导出功能
 * 支持 PNG、SVG、PDF、HTML、JSON 格式导出
 */

import * as fs from 'fs';
import * as path from 'path';
import { ChartResult, ExportFormat, ExportOptions, ChartType } from './types';

/**
 * 图表导出器
 */
export class ChartExporter {
  private defaultWidth = 800;
  private defaultHeight = 600;

  /**
   * 导出图表
   */
  async export(chart: ChartResult, options: ExportOptions): Promise<string> {
    const {
      format,
      filename = `chart_${Date.now()}`,
      outputDir = '.',
      width = this.defaultWidth,
      height = this.defaultHeight,
      backgroundColor = '#ffffff',
      includeTitle = true,
      watermark
    } = options;

    // 确保输出目录存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, `${filename}.${format}`);

    switch (format) {
      case 'json':
        return this.exportJSON(chart, outputPath);
      case 'html':
        return this.exportHTML(chart, outputPath, { width, height, backgroundColor, watermark });
      case 'svg':
        return this.exportSVG(chart, outputPath, { width, height, backgroundColor });
      case 'png':
        return this.exportPNG(chart, outputPath, { width, height, backgroundColor, watermark });
      case 'pdf':
        return this.exportPDF(chart, outputPath, { width, height, backgroundColor });
      default:
        throw new Error(`不支持的导出格式: ${format}`);
    }
  }

  /**
   * 导出为 JSON (ECharts 配置)
   */
  private exportJSON(chart: ChartResult, outputPath: string): string {
    const jsonContent = JSON.stringify(chart.config, null, 2);
    fs.writeFileSync(outputPath, jsonContent, 'utf-8');
    return outputPath;
  }

  /**
   * 导出为 HTML (交互式图表)
   */
  private exportHTML(
    chart: ChartResult, 
    outputPath: string, 
    options: { width: number; height: number; backgroundColor: string; watermark?: string }
  ): string {
    const { width, height, backgroundColor, watermark } = options;
    
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${chart.config.title?.text || 'DataMind 图表'}</title>
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${backgroundColor};
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }
    .chart-container {
      width: ${width}px;
      height: ${height}px;
      background: ${chart.config.backgroundColor || '#ffffff'};
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      position: relative;
    }
    #chart { width: 100%; height: 100%; }
    .watermark {
      position: absolute;
      bottom: 10px;
      right: 10px;
      font-size: 12px;
      color: #999;
      opacity: 0.7;
    }
    .info {
      position: absolute;
      top: -40px;
      left: 0;
      display: flex;
      gap: 16px;
      font-size: 14px;
      color: #666;
    }
    .info span {
      background: #f5f5f5;
      padding: 4px 12px;
      border-radius: 4px;
    }
    .download-btn {
      position: absolute;
      top: 10px;
      right: 10px;
      padding: 8px 16px;
      background: #6366f1;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      opacity: 0;
      transition: opacity 0.3s;
    }
    .chart-container:hover .download-btn { opacity: 1; }
    .download-btn:hover { background: #5558e3; }
  </style>
</head>
<body>
  <div class="chart-container">
    <div id="chart"></div>
    <button class="download-btn" onclick="downloadChart()">📥 下载图片</button>
    ${watermark ? `<div class="watermark">${watermark}</div>` : ''}
  </div>
  
  <script>
    const chartInstance = echarts.init(document.getElementById('chart'));
    chartInstance.setOption(${JSON.stringify(chart.config, null, 2)});
    
    window.addEventListener('resize', () => chartInstance.resize());
    
    function downloadChart() {
      const url = chartInstance.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: '${chart.config.backgroundColor || '#ffffff'}'
      });
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chart_${Date.now()}.png';
      a.click();
    }
  </script>
</body>
</html>`;

    fs.writeFileSync(outputPath, html, 'utf-8');
    return outputPath;
  }

  /**
   * 导出为 SVG
   */
  private exportSVG(
    chart: ChartResult,
    outputPath: string,
    options: { width: number; height: number; backgroundColor: string }
  ): string {
    const { width, height, backgroundColor } = options;
    
    // 生成简化的 SVG (静态版本)
    // 注意：完整的 SVG 需要通过 ECharts 服务端渲染
    const svg = this.generateStaticSVG(chart, width, height, backgroundColor);
    fs.writeFileSync(outputPath, svg, 'utf-8');
    return outputPath;
  }

  /**
   * 生成静态 SVG (简化版本)
   */
  private generateStaticSVG(chart: ChartResult, width: number, height: number, bgColor: string): string {
    const config = chart.config;
    const title = config.title?.text || '';
    
    // SVG 头部
    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="${bgColor}"/>
  <style>
    .title { font: bold 16px sans-serif; fill: #333; }
    .axis-label { font: 12px sans-serif; fill: #666; }
    .grid { stroke: #e0e0e0; stroke-width: 1; }
    .data-bar { fill: #5470c6; }
    .data-line { stroke: #5470c6; stroke-width: 2; fill: none; }
    .data-point { fill: #5470c6; }
  </style>
  
  <!-- Title -->
  ${title ? `<text x="${width/2}" y="30" text-anchor="middle" class="title">${this.escapeXML(title)}</text>` : ''}
  
  <!-- Chart Area -->
  <g transform="translate(60, 50)">
    <!-- Chart content would be rendered here based on chart type -->
    <!-- This is a simplified static representation -->
    <text x="${(width-120)/2}" y="${(height-100)/2}" text-anchor="middle" class="axis-label">
      ${this.getChartTypeLabel(chart.type)}
    </text>
    <text x="${(width-120)/2}" y="${(height-100)/2 + 20}" text-anchor="middle" class="axis-label" style="fill: #999; font-size: 10px;">
      使用 ECharts 渲染完整图表
    </text>
  </g>
</svg>`;

    return svg;
  }

  /**
   * 导出为 PNG (需要 puppeteer 或服务端渲染)
   */
  private async exportPNG(
    chart: ChartResult,
    outputPath: string,
    options: { width: number; height: number; backgroundColor: string; watermark?: string }
  ): Promise<string> {
    const { width, height, backgroundColor, watermark } = options;
    
    // 首先导出 HTML
    const tempHtml = outputPath.replace('.png', '.html');
    await this.exportHTML(chart, tempHtml, { width, height, backgroundColor, watermark });
    
    // 生成说明文件
    const infoPath = outputPath.replace('.png', '_info.txt');
    const info = `图表导出说明
================

图表类型: ${chart.type}
主题: ${chart.theme}
尺寸: ${width}x${height}

要生成 PNG 图片，请使用以下方式之一：

1. 使用 Puppeteer (推荐):
   npm install puppeteer
   
   const puppeteer = require('puppeteer');
   const browser = await puppeteer.launch();
   const page = await browser.newPage();
   await page.setViewport({ width: ${width}, height: ${height} });
   await page.goto('file://${tempHtml}');
   await page.screenshot({ path: '${outputPath}' });
   await browser.close();

2. 使用 ECharts 服务端渲染:
   npm install echarts node-canvas
   
3. 手动截图:
   在浏览器中打开 ${tempHtml}，然后截图保存

图表配置已保存为 JSON 格式，可使用 ECharts 直接渲染。
`;

    fs.writeFileSync(infoPath, info, 'utf-8');
    
    // 返回提示信息
    return `PNG 导出需要 Puppeteer。已生成 HTML 文件: ${tempHtml}`;
  }

  /**
   * 导出为 PDF (需要 puppeteer)
   */
  private async exportPDF(
    chart: ChartResult,
    outputPath: string,
    options: { width: number; height: number; backgroundColor: string }
  ): Promise<string> {
    const { width, height, backgroundColor } = options;
    
    // 首先导出 HTML
    const tempHtml = outputPath.replace('.pdf', '.html');
    await this.exportHTML(chart, tempHtml, { width, height, backgroundColor });
    
    // 生成说明文件
    const infoPath = outputPath.replace('.pdf', '_info.txt');
    const info = `PDF 导出说明
================

图表类型: ${chart.type}
尺寸: ${width}x${height}

要生成 PDF 文件，请使用以下方式：

使用 Puppeteer:
   npm install puppeteer
   
   const puppeteer = require('puppeteer');
   const browser = await puppeteer.launch();
   const page = await browser.newPage();
   await page.goto('file://${tempHtml}');
   await page.pdf({ path: '${outputPath}', format: 'A4' });
   await browser.close();

HTML 文件已生成: ${tempHtml}
`;

    fs.writeFileSync(infoPath, info, 'utf-8');
    
    return `PDF 导出需要 Puppeteer。已生成 HTML 文件: ${tempHtml}`;
  }

  /**
   * 批量导出多种格式
   */
  async exportMultiple(
    chart: ChartResult,
    formats: ExportFormat[],
    baseOptions: Omit<ExportOptions, 'format'>
  ): Promise<Record<ExportFormat, string>> {
    const results: Record<ExportFormat, string> = {} as any;
    
    for (const format of formats) {
      results[format] = await this.export(chart, { ...baseOptions, format });
    }
    
    return results;
  }

  /**
   * 生成图表预览链接
   */
  generatePreviewURL(chart: ChartResult): string {
    // 使用 Data URL 编码
    const config = encodeURIComponent(JSON.stringify(chart.config));
    return `data:text/html;charset=utf-8,${encodeURIComponent(this.getPreviewHTML(chart))}`;
  }

  /**
   * 获取预览 HTML
   */
  private getPreviewHTML(chart: ChartResult): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
</head>
<body style="margin:0;padding:20px;background:#f5f5f5;">
  <div id="chart" style="width:800px;height:600px;background:#fff;border-radius:8px;"></div>
  <script>
    echarts.init(document.getElementById('chart')).setOption(${JSON.stringify(chart.config)});
  </script>
</body>
</html>`;
  }

  /**
   * 获取图表类型标签
   */
  private getChartTypeLabel(type: ChartType): string {
    const labels: Record<ChartType, string> = {
      bar: '📊 柱状图',
      line: '📈 折线图',
      pie: '🥧 饼图',
      scatter: '⚬ 散点图',
      heatmap: '🌡️ 热力图',
      radar: '🕸️ 雷达图',
      funnel: '🔺 漏斗图',
      treemap: '🌳 树图',
      sankey: '🌊 桑基图',
      gauge: '⏱️ 仪表盘',
      boxplot: '📦 箱线图',
      candlestick: '📈 K线图'
    };
    return labels[type] || type;
  }

  /**
   * XML 转义
   */
  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

// 导出便捷函数
export async function exportChart(
  chart: ChartResult, 
  options: ExportOptions
): Promise<string> {
  const exporter = new ChartExporter();
  return exporter.export(chart, options);
}

/**
 * 推断最佳导出格式
 */
export function inferExportFormat(chartType: ChartType): ExportFormat[] {
  const recommendations: Record<ChartType, ExportFormat[]> = {
    bar: ['png', 'svg', 'html'],
    line: ['png', 'svg', 'html'],
    pie: ['png', 'svg', 'html'],
    scatter: ['png', 'svg', 'html'],
    heatmap: ['png', 'svg'],
    radar: ['png', 'svg', 'html'],
    funnel: ['png', 'svg', 'html'],
    treemap: ['png', 'html'],
    sankey: ['png', 'html'],
    gauge: ['png', 'svg'],
    boxplot: ['png', 'svg'],
    candlestick: ['png', 'svg', 'html']
  };
  return recommendations[chartType] || ['png', 'html'];
}