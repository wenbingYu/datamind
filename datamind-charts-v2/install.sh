#!/bin/bash
# DataMind 高级图表模块安装脚本

set -e

TARGET_DIR="/Users/wenbing/.openclaw/workspace/projects/datamind/src/charts"
SOURCE_DIR="/Users/wenbing/.openclaw/workspace/datamind-charts-v2/src"

echo "🚀 DataMind 高级图表模块安装"
echo "=============================="

echo "📁 创建目录: $TARGET_DIR"
mkdir -p "$TARGET_DIR"

echo "📄 复制源文件..."
cp "$SOURCE_DIR/types.ts" "$TARGET_DIR/"
cp "$SOURCE_DIR/generator.ts" "$TARGET_DIR/"
cp "$SOURCE_DIR/exporter.ts" "$TARGET_DIR/"
cp "$SOURCE_DIR/recommender.ts" "$TARGET_DIR/"
cp "$SOURCE_DIR/index.ts" "$TARGET_DIR/"

echo "✅ 文件复制完成"

# 创建 CLI 命令
CLI_COMMAND="$TARGET_DIR/../cli/commands/chart.ts"
cat > "$CLI_COMMAND" << 'EOF'
import { Command } from 'commander';
import { ChartGenerator, ChartRecommender, ChartExporter } from '../../charts';
import { getEngine } from '../../core/engine/duckdb';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

const chartCommand = new Command('chart')
  .description('生成高级图表')
  .argument('<table>', '数据表名')
  .option('-t, --type <type>', '图表类型 (bar/line/pie/scatter/heatmap/radar/funnel/treemap/sankey/gauge/boxplot/candlestick)')
  .option('-x, --xColumn <column>', 'X轴列名')
  .option('-y, --yColumn <column>', 'Y轴列名')
  .option('-v, --valueColumn <column>', '值列名')
  .option('--theme <theme>', '主题 (default/dark/vintage/macarons/shine/roma/tech/forest)', 'default')
  .option('--title <title>', '图表标题')
  .option('-r, --recommend', '智能推荐图表类型')
  .option('-e, --export <format>', '导出格式 (html/json/svg)', 'html')
  .option('-o, --output <dir>', '输出目录', '.')
  .action(async (tableName, options) => {
    try {
      const db = await getEngine();
      const tableInfo = await db.all(`PRAGMA table_info(${tableName})`);
      if (tableInfo.length === 0) {
        console.log(chalk.red(`表 "${tableName}" 不存在`));
        return;
      }
      
      const data = await db.all(`SELECT * FROM ${tableName}`);
      const columns = Object.keys(data[0] || {});
      const rows = data.map(row => columns.map(c => row[c]));
      
      const queryResult = { columns, rows, rowCount: data.length };
      
      if (options.recommend) {
        const recommender = new ChartRecommender();
        const recommendations = recommender.recommend(queryResult);
        console.log(chalk.bold('\n📊 图表推荐:\n'));
        recommendations.forEach((rec, i) => {
          console.log(`${i + 1}. ${chalk.cyan(rec.type)} (${(rec.confidence * 100).toFixed(0)}%)`);
          console.log(`   ${chalk.gray(rec.reason)}`);
        });
        return;
      }
      
      if (!options.type) {
        console.log(chalk.yellow('请指定图表类型，或使用 --recommend 获取推荐'));
        return;
      }
      
      const generator = new ChartGenerator(options.theme as any);
      const chart = generator.generate(queryResult, {
        type: options.type as any,
        title: options.title,
        xColumn: options.xColumn,
        yColumn: options.yColumn,
        valueColumn: options.valueColumn
      });
      
      const exporter = new ChartExporter();
      const outputPath = await exporter.export(chart, {
        format: options.export as any,
        filename: `${tableName}-${options.type}`,
        outputDir: options.output
      });
      
      console.log(chalk.green(`\n✅ 图表已生成: ${outputPath}\n`));
    } catch (err) {
      console.log(chalk.red(`错误: ${(err as Error).message}`));
    }
  });

export default chartCommand;
EOF

echo "✅ CLI 命令已创建"

echo ""
echo "📊 使用方法："
echo "  datamind chart sales --recommend"
echo "  datamind chart sales --type heatmap --xColumn region --yColumn product --valueColumn amount"
echo "  datamind chart sales --type bar --export html --output ./charts"
echo ""
echo "🎉 安装完成！"