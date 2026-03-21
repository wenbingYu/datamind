import { Command } from 'commander';
import { ChartGenerator, ChartRecommender, ChartExporter } from '../../charts';
import { getDatabase } from '../../core/engine/duckdb';
import chalk from 'chalk';

const chartCommand = new Command('chart')
  .description('生成高级图表 (热力图、雷达图、漏斗图、树图、桑基图等)')
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
      const db = await getDatabase();
      
      // 检查表是否存在
      const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [tableName]);
      if (tables.length === 0) {
        console.log(chalk.red(`❌ 表 "${tableName}" 不存在`));
        console.log(chalk.gray('   使用 datamind list 查看所有表'));
        return;
      }
      
      // 获取数据
      const data = await db.all(`SELECT * FROM "${tableName}"`);
      if (data.length === 0) {
        console.log(chalk.yellow(`⚠️  表 "${tableName}" 没有数据`));
        return;
      }
      
      const columns = Object.keys(data[0]);
      const rows = data.map((row: any) => columns.map(c => row[c]));
      const queryResult = { columns, rows, rowCount: data.length };
      
      // 智能推荐模式
      if (options.recommend) {
        const recommender = new ChartRecommender();
        const recommendations = recommender.recommend(queryResult);
        
        console.log(chalk.bold.cyan('\n📊 图表推荐:\n'));
        recommendations.forEach((rec, i) => {
          const confidence = (rec.confidence * 100).toFixed(0);
          const confColor = rec.confidence >= 0.8 ? chalk.green : rec.confidence >= 0.6 ? chalk.yellow : chalk.gray;
          console.log(`  ${i + 1}. ${chalk.cyan(rec.type.padEnd(12))} ${confColor(confidence + '%')}`);
          console.log(`     ${chalk.gray(rec.reason)}`);
          if (rec.suggestedColumns) {
            const cols = Object.entries(rec.suggestedColumns).map(([k, v]) => `${k}=${v}`).join(', ');
            console.log(`     ${chalk.dim('建议列: ' + cols)}`);
          }
          console.log();
        });
        
        console.log(chalk.gray('使用 datamind chart <table> --type <type> 生成图表\n'));
        return;
      }
      
      // 检查图表类型
      if (!options.type) {
        console.log(chalk.yellow('❌ 请指定图表类型'));
        console.log(chalk.gray('   使用 --recommend 获取推荐'));
        console.log(chalk.gray('   或使用 --type <type> 指定类型'));
        return;
      }
      
      // 生成图表
      const generator = new ChartGenerator(options.theme as any);
      const chart = generator.generate(queryResult, {
        type: options.type as any,
        title: options.title || `${tableName} - ${options.type}`,
        xColumn: options.xColumn,
        yColumn: options.yColumn,
        valueColumn: options.valueColumn
      });
      
      // 导出
      const exporter = new ChartExporter();
      const filename = `${tableName}-${options.type}-${Date.now()}`;
      const outputPath = await exporter.export(chart, {
        format: options.export as any,
        filename,
        outputDir: options.output
      });
      
      console.log(chalk.green.bold('\n✅ 图表已生成!\n'));
      console.log(`  📊 类型: ${chalk.cyan(options.type)}`);
      console.log(`  🎨 主题: ${options.theme}`);
      console.log(`  📁 文件: ${chalk.yellow(outputPath)}`);
      console.log();
      
    } catch (err) {
      console.log(chalk.red(`\n❌ 错误: ${(err as Error).message}\n`));
    }
  });

export default chartCommand;