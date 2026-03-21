/**
 * DataMind 图表导出器
 */

import * as fs from 'fs';
import * as path from 'path';
import { ChartResult, ExportFormat, ExportOptions } from './types';

export class ChartExporter {
  private defaultWidth = 800;
  private defaultHeight = 600;

  async export(chart: ChartResult, options: ExportOptions): Promise<string> {
    const {
      format,
      filename = `chart_${Date.now()}`,
      outputDir = '.',
      width = this.defaultWidth,
      height = this.defaultHeight,
      backgroundColor = '#ffffff',
      watermark
    } = options;

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
      case 'pdf':
        return this.exportWithPuppeteer(chart, outputPath, { width, height, backgroundColor, format });
      default:
        throw new Error(`不支持的导出格式: ${format}`);
    }
  }

  private exportJSON(chart: ChartResult, outputPath: string): string {
    fs.writeFileSync(outputPath, JSON.stringify(chart.config, null, 2), 'utf-8');
    return outputPath;
  }

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
  <script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: ${backgroundColor}; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
    .chart-container { width: ${width}px; height: ${height}px; background: ${chart.config.backgroundColor || '#ffffff'}; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); position: relative; }
    #chart { width: 100%; height: 100%; }
    .watermark { position: absolute; bottom: 10px; right: 10px; font-size: 12px; color: #999; opacity: 0.7; }
    .download-btn { position: absolute; top: 10px; right: 10px; padding: 8px 16px; background: #6366f1; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; opacity: 0; transition: opacity 0.3s; }
    .chart-container:hover .download-btn { opacity: 1; }
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
      const url = chartInstance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '${chart.config.backgroundColor || '#ffffff'}' });
      const a = document.createElement('a'); a.href = url; a.download = 'chart.png'; a.click();
    }
  </script>
</body>
</html>`;

    fs.writeFileSync(outputPath, html, 'utf-8');
    return outputPath;
  }

  private exportSVG(chart: ChartResult, outputPath: string, options: { width: number; height: number; backgroundColor: string }): string {
    const { width, height, backgroundColor } = options;
    const title = chart.config.title?.text || '';
    
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="${backgroundColor}"/>
  <style>.title { font: bold 16px sans-serif; fill: #333; }</style>
  ${title ? `<text x="${width/2}" y="30" text-anchor="middle" class="title">${this.escapeXML(title)}</text>` : ''}
  <g transform="translate(60, 50)">
    <text x="${(width-120)/2}" y="${(height-100)/2}" text-anchor="middle" font-size="14" fill="#666">${chart.type} 图表</text>
    <text x="${(width-120)/2}" y="${(height-100)/2 + 20}" text-anchor="middle" font-size="10" fill="#999">使用 ECharts 渲染完整图表</text>
  </g>
</svg>`;

    fs.writeFileSync(outputPath, svg, 'utf-8');
    return outputPath;
  }

  private async exportWithPuppeteer(
    chart: ChartResult,
    outputPath: string,
    options: { width: number; height: number; backgroundColor: string; format: string }
  ): Promise<string> {
    const { width, height, backgroundColor, format } = options;
    
    // 先导出 HTML
    const tempHtml = outputPath.replace(/\.(png|pdf)$/, '.html');
    await this.exportHTML(chart, tempHtml, { width, height, backgroundColor });
    
    // 返回提示
    return `PNG/PDF 导出需要 Puppeteer。已生成 HTML: ${tempHtml}\n可使用: npx puppeteer screenshot ${tempHtml} ${outputPath}`;
  }

  private escapeXML(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

export async function exportChart(chart: ChartResult, options: ExportOptions): Promise<string> {
  const exporter = new ChartExporter();
  return exporter.export(chart, options);
}

export function inferExportFormat(chartType: string): ExportFormat[] {
  const recommendations: Record<string, ExportFormat[]> = {
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