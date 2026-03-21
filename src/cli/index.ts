#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { DataMindError, ConfigError } from '../utils/errors';
import { importCommand } from './commands/import';
import { listCommand } from './commands/list';
import { askCommand } from './commands/ask';
import { analyzeCommand } from './commands/analyze';
import { exportCommand } from './commands/export';
import { uiCommand } from './commands/ui';
import chartCommand from './commands/chart';
import keyCommand from './commands/key';
import { serveCommand } from './commands/serve';
import { setupCommand, reconfigureCommand, showConfig, needSetup } from './commands/setup';

// 全局错误处理
process.on('uncaughtException', (error: Error) => {
  if (error instanceof DataMindError) {
    process.exit(error.exitCode);
  } else {
    console.error(chalk.red('未预期的错误:'), error.message);
    console.error(chalk.dim(error.stack || ''));
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason: unknown) => {
  if (reason instanceof DataMindError) {
    process.exit(reason.exitCode);
  } else if (reason instanceof Error) {
    console.error(chalk.red('未预期的错误:'), reason.message);
    console.error(chalk.dim(reason.stack || ''));
  } else {
    console.error(chalk.red('未预期的错误:'), String(reason));
  }
  process.exit(1);
});

const program = new Command();

program
  .name('datamind')
  .description('智能数据分析助手 — 上传数据，用自然语言分析')
  .version('2.1.0');

// datamind setup
program
  .command('setup')
  .description('配置 AI 服务（首次运行自动启动）')
  .action(async () => {
    await reconfigureCommand();
  });

// datamind config
program
  .command('config')
  .description('查看当前配置')
  .action(() => {
    showConfig();
  });

// datamind import <file>
program
  .command('import <file>')
  .description('导入数据文件 (支持 CSV)')
  .action(async (file: string) => {
    if (needSetup()) {
      console.log();
      console.log(chalk.yellow('  ⚠️  检测到未配置 AI 服务'));
      console.log();
      console.log('  运行以下命令进行配置：');
      console.log(chalk.cyan('    datamind setup'));
      console.log();
      process.exit(1);
    }
    await importCommand(file);
  });

// datamind list
program
  .command('list')
  .description('列出已导入的数据表')
  .action(async () => {
    await listCommand();
  });

// datamind ask "<question>"
program
  .command('ask <question>')
  .description('用自然语言查询数据')
  .option('-t, --table <name>', '指定查询的表名')
  .option('-c, --chart <type>', '生成图表 (bar, line, pie, scatter)')
  .option('-o, --output <file>', '输出文件路径 (保存图表)')
  .action(async (question: string, options: { table?: string; chart?: string; output?: string }) => {
    if (needSetup()) {
      console.log();
      console.log(chalk.yellow('  ⚠️  检测到未配置 AI 服务'));
      console.log();
      console.log('  运行以下命令进行配置：');
      console.log(chalk.cyan('    datamind setup'));
      console.log();
      process.exit(1);
    }
    await askCommand(question, options.table, options.chart, options.output);
  });

// datamind analyze [table]
program
  .command('analyze [table]')
  .description('分析数据表并生成洞察')
  .option('-f, --forecast', '执行时间序列预测')
  .option('-a, --anomaly', '执行异常检测')
  .option('--association', '执行关联分析')
  .option('-c, --correlation', '执行相关性分析')
  .option('--horizon <number>', '预测步数 (默认 5)', parseInt)
  .option('--column <name>', '目标分析列')
  .option('--threshold <number>', '异常检测阈值 (默认 3)', parseFloat)
  .option('--min-support <number>', '关联分析最小支持度 (默认 0.1)', parseFloat)
  .option('--min-confidence <number>', '关联分析最小置信度 (默认 0.5)', parseFloat)
  .option('--method <method>', '相关性分析方法 (pearson/spearman)')
  .action(async (table: string | undefined, options: {
    forecast?: boolean;
    anomaly?: boolean;
    association?: boolean;
    correlation?: boolean;
    horizon?: number;
    column?: string;
    threshold?: number;
    minSupport?: number;
    minConfidence?: number;
    method?: 'pearson' | 'spearman';
  }) => {
    await analyzeCommand(table, options);
  });

// datamind export <file>
program
  .command('export <file>')
  .description('导出分析报告 (支持 .md, .html, .json)')
  .option('-t, --title <title>', '报告标题')
  .option('--table <name>', '指定导出的表')
  .option('--template <name>', '报告模板')
  .action(async (file: string, options: { title?: string; table?: string; template?: string }) => {
    await exportCommand(file, options);
  });

// datamind ui
program
  .command('ui')
  .description('启动 Web UI 界面')
  .option('-p, --port <port>', '端口号', '3000')
  .action(async (options: { port: string }) => {
    await uiCommand(parseInt(options.port));
  });

// datamind serve
program
  .command('serve')
  .description('启动 API 服务器')
  .option('-p, --port <port>', '端口号', '3000')
  .option('-h, --host <host>', '主机地址', '0.0.0.0')
  .option('--auth', '启用 API Key 认证', false)
  .action(async (options: { port: string; host: string; auth: boolean }) => {
    await serveCommand(options);
  });

// datamind chart <table>
program.addCommand(chartCommand);

// datamind key <action>
program.addCommand(keyCommand);

// Parse arguments
program.parse();

// Show help if no command
if (!process.argv.slice(2).length) {
  console.log();
  console.log(chalk.cyan.bold('  DataMind - 智能数据分析助手'));
  console.log();
  console.log(chalk.white('  上传数据，用自然语言分析，无需 SQL/Python'));
  console.log();
  
  // 检查是否需要配置
  if (needSetup()) {
    console.log(chalk.yellow('  ⚠️  检测到未配置 AI 服务'));
    console.log();
    console.log(chalk.bold('  首次使用请运行：'));
    console.log(chalk.cyan.bold('    datamind setup'));
    console.log();
  }
  
  console.log(chalk.dim('  快速开始:'));
  console.log(chalk.dim('    datamind setup              配置 AI 服务'));
  console.log(chalk.dim('    datamind import sales.csv   导入数据'));
  console.log(chalk.dim('    datamind list               查看数据表'));
  console.log(chalk.dim('    datamind ask "问题"         查询数据'));
  console.log(chalk.dim('    datamind analyze sales      分析数据'));
  console.log(chalk.dim('    datamind chart sales --recommend  智能图表推荐'));
  console.log(chalk.dim('    datamind ui                 启动 Web 界面'));
  console.log();
  console.log(chalk.dim('  高级功能:'));
  console.log(chalk.dim('    datamind analyze <table> --forecast    时间序列预测'));
  console.log(chalk.dim('    datamind analyze <table> --anomaly     异常检测'));
  console.log(chalk.dim('    datamind analyze <table> --correlation 相关性分析'));
  console.log();
  console.log(chalk.dim('  API Key 管理:'));
  console.log(chalk.dim('    datamind key generate --plan pro  创建 API Key'));
  console.log(chalk.dim('    datamind key list                 列出 API Keys'));
  console.log();
  program.outputHelp();
}