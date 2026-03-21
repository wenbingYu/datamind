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

// 全局错误处理
process.on('uncaughtException', (error: Error) => {
  if (error instanceof DataMindError) {
    // 已知错误类型，已在具体位置输出信息
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
  .version('1.0.0');

// datamind import <file>
program
  .command('import <file>')
  .description('导入数据文件 (支持 CSV)')
  .action(async (file: string) => {
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
    await askCommand(question, options.table, options.chart, options.output);
  });

// datamind analyze [table]
program
  .command('analyze [table]')
  .description('分析数据表并生成洞察')
  .action(async (table?: string) => {
    await analyzeCommand(table);
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

// Parse arguments
program.parse();

// Show help if no command
if (!process.argv.slice(2).length) {
  console.log();
  console.log(chalk.cyan.bold('  DataMind - 智能数据分析助手'));
  console.log();
  console.log(chalk.white('  上传数据，用自然语言分析，无需 SQL/Python'));
  console.log();
  console.log(chalk.dim('  快速开始:'));
  console.log(chalk.dim('    datamind import sales.csv    导入数据'));
  console.log(chalk.dim('    datamind list                查看数据表'));
  console.log(chalk.dim('    datamind ask "销售额最高的产品"  查询数据'));
  console.log(chalk.dim('    datamind analyze sales       分析数据'));
  console.log(chalk.dim('    datamind export report.md    导出报告'));
  console.log(chalk.dim('    datamind ui                  启动 Web 界面'));
  console.log();
  program.outputHelp();
}