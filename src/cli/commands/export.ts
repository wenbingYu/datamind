import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { analyzeTable, AnalysisResult } from '../../core/analyzer/insights';
import { getAllTablesMeta, getTableMeta, executeSQL } from '../../core/engine/duckdb';
import { generateChartConfig, inferChartType, ChartType } from '../../utils/charts';
import { FileError, QueryError } from '../../utils/errors';

interface ExportOptions {
  title?: string;
  template?: string;
  table?: string;
}

export async function exportCommand(outputFile: string, options: ExportOptions = {}): Promise<void> {
  const ext = path.extname(outputFile).toLowerCase();
  const spinner = ora('正在生成报告...').start();
  
  try {
    // 获取要导出的表
    let tables = await getAllTablesMeta();
    
    if (options.table) {
      tables = tables.filter(t => t.name.toLowerCase() === options.table!.toLowerCase());
      if (tables.length === 0) {
        throw new FileError(`表 "${options.table}" 不存在`);
      }
    }
    
    if (tables.length === 0) {
      spinner.fail(chalk.yellow('暂无数据表，请先使用 datamind import <file> 导入数据'));
      return;
    }
    
    // 分析数据
    spinner.text = '正在分析数据...';
    const analyses: AnalysisResult[] = [];
    for (const table of tables) {
      analyses.push(await analyzeTable(table.name));
    }
    
    // 生成报告
    spinner.text = '正在生成报告...';
    
    if (ext === '.md' || ext === '.markdown') {
      await exportMarkdown(outputFile, analyses, options);
    } else if (ext === '.html' || ext === '.htm') {
      await exportHTML(outputFile, analyses, options);
    } else if (ext === '.json') {
      await exportJSON(outputFile, analyses, options);
    } else {
      throw new FileError(`不支持的文件格式: ${ext}，支持的格式: .md, .html, .json`);
    }
    
    spinner.succeed(chalk.green(`报告已导出到: ${outputFile}`));
    console.log(chalk.dim(`  表数量: ${tables.length}`));
    console.log(chalk.dim(`  洞察数量: ${analyses.reduce((sum, a) => sum + a.insights.length, 0)}`));
    
  } catch (error) {
    spinner.fail(chalk.red('导出失败'));
    if (error instanceof FileError || error instanceof QueryError) {
      throw error;
    }
    throw new QueryError(error instanceof Error ? error.message : String(error));
  }
}

async function exportMarkdown(outputFile: string, analyses: AnalysisResult[], options: ExportOptions): Promise<void> {
  const lines: string[] = [];
  
  // 标题
  lines.push(`# ${options.title || 'DataMind 数据分析报告'}`);
  lines.push(``);
  lines.push(`> 生成时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push(``);
  
  // 目录
  lines.push(`## 📑 目录`);
  lines.push(``);
  for (const analysis of analyses) {
    lines.push(`- [${analysis.tableName}](#${analysis.tableName.toLowerCase()})`);
  }
  lines.push(``);
  
  // 各表分析
  for (const analysis of analyses) {
    lines.push(`---`);
    lines.push(``);
    lines.push(`## ${analysis.tableName}`);
    lines.push(``);
    
    // 概览
    lines.push(`### 📋 数据概览`);
    lines.push(``);
    lines.push(`| 指标 | 值 |`);
    lines.push(`| --- | --- |`);
    lines.push(`| 行数 | ${analysis.overview.rowCount.toLocaleString()} |`);
    lines.push(`| 列数 | ${analysis.overview.columnCount} |`);
    
    if (analysis.overview.dateRange) {
      lines.push(`| 时间范围 | ${analysis.overview.dateRange.start} ~ ${analysis.overview.dateRange.end} |`);
    }
    
    lines.push(`| 数值列 | ${analysis.overview.numericColumns.join(', ') || '无'} |`);
    lines.push(`| 文本列 | ${analysis.overview.textColumns.slice(0, 5).join(', ')}${analysis.overview.textColumns.length > 5 ? ' ...' : ''} |`);
    lines.push(``);
    
    // 统计信息
    lines.push(`### 📈 统计信息`);
    lines.push(``);
    lines.push(`| 列名 | 类型 | 最小值 | 最大值 | 均值 | 中位数 | 唯一值 | 缺失值 |`);
    lines.push(`| --- | --- | --- | --- | --- | --- | --- | --- |`);
    
    for (const stat of analysis.statistics.slice(0, 10)) {
      if (stat.type === 'number' && stat.mean !== undefined) {
        lines.push(`| ${stat.column} | ${stat.type} | ${stat.min?.toFixed(2) || '-'} | ${stat.max?.toFixed(2) || '-'} | ${stat.mean?.toFixed(2) || '-'} | ${stat.median?.toFixed(2) || '-'} | ${stat.distinctCount} | ${stat.nullCount} |`);
      } else {
        lines.push(`| ${stat.column} | ${stat.type} | - | - | - | - | ${stat.distinctCount} | ${stat.nullCount} |`);
      }
    }
    lines.push(``);
    
    // 洞察
    if (analysis.insights.length > 0) {
      lines.push(`### 洞察发现`);
      lines.push(``);
      
      const typeIcons: Record<string, string> = {
        trend: '📈',
        anomaly: '⚠️',
        correlation: '🔗',
        distribution: '[图表]'
      };
      
      const significanceLabels: Record<string, string> = {
        high: '🔴 高',
        medium: '🟡 中',
        low: '⚪ 低'
      };
      
      for (const insight of analysis.insights) {
        const icon = typeIcons[insight.type] || '📌';
        const label = significanceLabels[insight.significance] || insight.significance;
        
        lines.push(`#### ${icon} ${insight.title}`);
        lines.push(``);
        lines.push(`**重要性**: ${label}`);
        lines.push(``);
        lines.push(`${insight.description}`);
        lines.push(``);
      }
    }
  }
  
  // 页脚
  lines.push(`---`);
  lines.push(``);
  lines.push(`*报告由 DataMind 自动生成*`);
  
  const dir = path.dirname(outputFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(outputFile, lines.join('\n'));
}

async function exportHTML(outputFile: string, analyses: AnalysisResult[], options: ExportOptions): Promise<void> {
  const template = options.template || 'default';
  
  // 生成表格统计数据的 JavaScript
  const analysisData = analyses.map(analysis => ({
    tableName: analysis.tableName,
    overview: analysis.overview,
    statistics: analysis.statistics,
    insights: analysis.insights
  }));
  
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title || 'DataMind 数据分析报告'}</title>
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f5f7fa;
      color: #333;
      line-height: 1.6;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 20px;
      text-align: center;
      margin-bottom: 30px;
    }
    header h1 {
      font-size: 2em;
      margin-bottom: 10px;
    }
    header p {
      opacity: 0.9;
    }
    .card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
      margin-bottom: 20px;
      overflow: hidden;
    }
    .card-header {
      background: #f8f9fa;
      padding: 15px 20px;
      border-bottom: 1px solid #eee;
      font-weight: 600;
      font-size: 1.1em;
    }
    .card-body {
      padding: 20px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
    }
    .stat-item {
      text-align: center;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 8px;
    }
    .stat-value {
      font-size: 1.8em;
      font-weight: 700;
      color: #667eea;
    }
    .stat-label {
      font-size: 0.85em;
      color: #666;
      margin-top: 5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }
    th {
      background: #f8f9fa;
      font-weight: 600;
    }
    tr:hover {
      background: #f5f7fa;
    }
    .insight {
      padding: 15px;
      margin-bottom: 15px;
      border-radius: 8px;
      border-left: 4px solid;
    }
    .insight.high {
      background: #fff5f5;
      border-color: #f56565;
    }
    .insight.medium {
      background: #fffaf0;
      border-color: #ed8936;
    }
    .insight.low {
      background: #f7fafc;
      border-color: #a0aec0;
    }
    .insight-title {
      font-weight: 600;
      margin-bottom: 5px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .insight-desc {
      color: #666;
      font-size: 0.95em;
    }
    .tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75em;
      font-weight: 500;
    }
    .tag.trend { background: #e6fffa; color: #319795; }
    .tag.anomaly { background: #fed7d7; color: #c53030; }
    .tag.correlation { background: #e9d8fd; color: #6b46c1; }
    .tag.distribution { background: #bee3f8; color: #2b6cb0; }
    .chart-container {
      height: 300px;
      margin: 20px 0;
    }
    footer {
      text-align: center;
      padding: 30px;
      color: #666;
      font-size: 0.9em;
    }
    @media (max-width: 768px) {
      .container { padding: 10px; }
      header { padding: 20px 10px; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <header>
    <h1>${options.title || 'DataMind 数据分析报告'}</h1>
    <p>生成时间: ${new Date().toLocaleString('zh-CN')}</p>
  </header>
  
  <div class="container">
    ${analyses.map(analysis => `
    <div class="card">
      <div class="card-header">${analysis.tableName}</div>
      <div class="card-body">
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value">${analysis.overview.rowCount.toLocaleString()}</div>
            <div class="stat-label">行数</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${analysis.overview.columnCount}</div>
            <div class="stat-label">列数</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${analysis.overview.numericColumns.length}</div>
            <div class="stat-label">数值列</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${analysis.insights.length}</div>
            <div class="stat-label">洞察</div>
          </div>
        </div>
        
        ${analysis.overview.dateRange ? `
        <p style="margin-top: 15px; color: #666;">
          📅 时间范围: ${analysis.overview.dateRange.start} ~ ${analysis.overview.dateRange.end}
        </p>
        ` : ''}
        
        <h3 style="margin: 25px 0 15px; font-size: 1em; color: #333;">📈 统计信息</h3>
        <table>
          <thead>
            <tr>
              <th>列名</th>
              <th>类型</th>
              <th>最小值</th>
              <th>最大值</th>
              <th>均值</th>
              <th>唯一值</th>
              <th>缺失值</th>
            </tr>
          </thead>
          <tbody>
            ${analysis.statistics.slice(0, 10).map(stat => `
            <tr>
              <td><strong>${stat.column}</strong></td>
              <td><span class="tag ${stat.type}">${stat.type}</span></td>
              <td>${stat.type === 'number' && stat.min !== undefined ? stat.min.toFixed(2) : '-'}</td>
              <td>${stat.type === 'number' && stat.max !== undefined ? stat.max.toFixed(2) : '-'}</td>
              <td>${stat.type === 'number' && stat.mean !== undefined ? stat.mean.toFixed(2) : '-'}</td>
              <td>${stat.distinctCount.toLocaleString()}</td>
              <td>${stat.nullCount.toLocaleString()}</td>
            </tr>
            `).join('')}
          </tbody>
        </table>
        
        ${analysis.insights.length > 0 ? `
        <h3 style="margin: 25px 0 15px; font-size: 1em; color: #333;">洞察发现</h3>
        ${analysis.insights.map(insight => `
        <div class="insight ${insight.significance}">
          <div class="insight-title">
            <span class="tag ${insight.type}">${insight.type}</span>
            ${insight.title}
            <span style="margin-left: auto; font-size: 0.8em; opacity: 0.7;">${insight.significance === 'high' ? '🔴 高' : insight.significance === 'medium' ? '🟡 中' : '⚪ 低'}</span>
          </div>
          <div class="insight-desc">${insight.description}</div>
        </div>
        `).join('')}
        ` : '<p style="color: #999; margin-top: 20px;">暂无明显洞察发现</p>'}
      </div>
    </div>
    `).join('\n')}
    
    <footer>
      <p>报告由 DataMind 自动生成</p>
    </footer>
  </div>
</body>
</html>`;
  
  const dir = path.dirname(outputFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(outputFile, html);
}

async function exportJSON(outputFile: string, analyses: AnalysisResult[], options: ExportOptions): Promise<void> {
  const result = {
    title: options.title || 'DataMind 数据分析报告',
    generatedAt: new Date().toISOString(),
    tables: analyses
  };
  
  const dir = path.dirname(outputFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
}