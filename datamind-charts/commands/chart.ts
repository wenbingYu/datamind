/**
 * DataMind CLI - Chart 命令
 * 支持生成和导出高级图表
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { ChartGenerator, ChartRecommender, ChartExporter, ChartType, ChartTheme } from '../charts';
import { executeSQL, getAllTablesMeta } from '../../core/engine/duckdb';

interface ChartCommandOptions {
  type?: ChartType;
  output?: string;
  format?: 'png' | 'svg' | 'pdf' | 'html' | 'json';
  theme?: ChartTheme;
  title?: string;
  xColumn?: string;
  yColumn?: string;
  width?: number;
  height?: number;
}

/**
 * 图表命令
 */
export async function chartCommand(
  table: string,
  options: ChartCommandOptions
): Promise<void> {
  const spinner = ora('正在生成图表...').start();

  try {
    // 1. 获取数据
    const tables = await getAllTablesMeta();
    const targetTable = tables.find(t => 
      t.name.toLowerCase() === table.toLowerCase()
    );

    if (!targetTable) {
      spinner.fail(`表 "${table}" 不存在`);
      console.log(chalk.dim('\n可用表:'));
      tables.forEach(t => console.log(chalk.dim(`  - ${t.name}`)));
      return;
    }

    // 获取表数据
    const data = await executeSQL(`SELECT * FROM "${targetTable.name}" LIMIT 1000`);
    
    if (!data || data.length === 0) {
      spinner.fail('表没有数据');
      return;
    }

    const queryResult = {
      columns: Object.keys(data[0]),
      rows: data.map(row => Object.values(row)),
      rowCount: data.length
    };

    // 2. 推荐或使用指定的图表类型
    let chartType: ChartType = options.type || 'bar';
    
    if (!options.type) {
      const recommender = new ChartRecommender();
      const recommendations = recommender.recommend(queryResult);
      
      if (recommendations.length > 0) {
        chartType = recommendations[0].type;
        spinner.info(`推荐图表类型: ${chalk.cyan(chartType)}`);
        console.log(chalk.dim(`  原因: ${recommendations[0].reason}`));
      }
    }

    // 3. 生成图表
    const generator = new ChartGenerator(options.theme || 'default');
    
    const chartOptions: any = {
      type: chartType,
      title: options.title || `${targetTable.name} - ${chartType}图`,
    };

    // 设置列映射
    if (options.xColumn) chartOptions.xColumn = options.xColumn;
    if (options.yColumn) chartOptions.yColumn = options.yColumn;

    // 高级图表特定配置
    if (chartType === 'heatmap') {
      chartOptions.xColumn = options.xColumn || queryResult.columns[0];
      chartOptions.yColumn = options.yColumn || queryResult.columns[1];
      chartOptions.valueColumn = queryResult.columns[2];
    } else if (chartType === 'funnel') {
      chartOptions.stageColumn = options.xColumn || queryResult.columns[0];
      chartOptions.valueColumn = options.yColumn || queryResult.columns[1];
    } else if (chartType === 'radar') {
      chartOptions.dimensions = queryResult.columns.slice(0, 6);
    }

    const chart = generator.generate(queryResult, chartOptions);

    // 4. 导出图表
    const exporter = new ChartExporter();
    const format = options.format || 'html';
    const outputPath = options.output || `./${table}_${chartType}.${format}`;

    const exportPath = await exporter.export(chart, {
      format,
      filename: path.basename(outputPath, `.${format}`),
      outputDir: path.dirname(outputPath) || '.',
      width: options.width || 800,
      height: options.height || 600
    });

    spinner.succeed('图表生成成功！');
    
    // 输出结果
    console.log();
    console.log(chalk.bold('📊 图表信息'));
    console.log(chalk.dim('─'.repeat(40)));
    console.log(`  类型: ${chalk.cyan(chartType)}`);
    console.log(`  主题: ${chart.theme}`);
    console.log(`  数据: ${queryResult.rowCount} 行`);
    console.log(`  导出: ${chalk.green(exportPath)}`);
    
    if (chart.insights && chart.insights.length > 0) {
      console.log();
      console.log(chalk.bold('💡 数据洞察'));
      console.log(chalk.dim('─'.repeat(40)));
      chart.insights.forEach(insight => {
        console.log(`  • ${insight}`);
      });
    }

    // 提示如何查看
    if (format === 'html') {
      console.log();
      console.log(chalk.dim(`在浏览器中打开查看: open ${exportPath}`));
    }

  } catch (error) {
    spinner.fail('图表生成失败');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

/**
 * 显示支持的图表类型
 */
export function listChartTypes(): void {
  const chartTypes: { type: ChartType; name: string; description: string; icon: string }[] = [
    { type: 'bar', name: '柱状图', description: '适合分类数据比较', icon: '📊' },
    { type: 'line', name: '折线图', description: '适合时间序列趋势', icon: '📈' },
    { type: 'pie', name: '饼图', description: '适合占比分布', icon: '🥧' },
    { type: 'scatter', name: '散点图', description: '适合变量关系分析', icon: '⚬' },
    { type: 'heatmap', name: '热力图', description: '适合二维密度分布', icon: '🌡️' },
    { type: 'radar', name: '雷达图', description: '适合多维度对比', icon: '🕸️' },
    { type: 'funnel', name: '漏斗图', description: '适合流程转化分析', icon: '🔺' },
    { type: 'treemap', name: '树图', description: '适合层级数据占比', icon: '🌳' },
    { type: 'sankey', name: '桑基图', description: '适合流向关系分析', icon: '🌊' },
    { type: 'gauge', name: '仪表盘', description: '适合单指标展示', icon: '⏱️' },
    { type: 'boxplot', name: '箱线图', description: '适合数据分布分析', icon: '📦' },
    { type: 'candlestick', name: 'K线图', description: '适合金融数据展示', icon: '📈' }
  ];

  console.log();
  console.log(chalk.bold('📊 支持的图表类型'));
  console.log(chalk.dim('─'.repeat(50)));
  
  chartTypes.forEach(({ type, name, description, icon }) => {
    console.log(`  ${icon}  ${chalk.cyan(type.padEnd(12))} ${name} - ${description}`);
  });

  console.log();
  console.log(chalk.dim('示例:'));
  console.log(chalk.dim('  datamind chart sales --type bar'));
  console.log(chalk.dim('  datamind chart users --type heatmap --format html'));
  console.log(chalk.dim('  datamind chart orders --type funnel --theme dark'));
}

/**
 * 显示支持的主题
 */
export function listThemes(): void {
  const themes: { name: ChartTheme; label: string; icon: string }[] = [
    { name: 'default', label: '默认蓝色', icon: '🔵' },
    { name: 'dark', label: '深色主题', icon: '🌙' },
    { name: 'vintage', label: '复古风格', icon: '📜' },
    { name: 'macarons', label: '马卡龙色', icon: '🍬' },
    { name: 'shine', label: '闪耀风格', icon: '✨' },
    { name: 'roma', label: '罗马风格', icon: '🏛️' },
    { name: 'tech', label: '科技风格', icon: '🚀' },
    { name: 'forest', label: '森林风格', icon: '🌲' }
  ];

  console.log();
  console.log(chalk.bold('🎨 支持的主题'));
  console.log(chalk.dim('─'.repeat(40)));
  
  themes.forEach(({ name, label, icon }) => {
    console.log(`  ${icon}  ${chalk.cyan(name.padEnd(10))} ${label}`);
  });

  console.log();
  console.log(chalk.dim('示例:'));
  console.log(chalk.dim('  datamind chart sales --theme dark'));
  console.log(chalk.dim('  datamind chart users --theme tech'));
}