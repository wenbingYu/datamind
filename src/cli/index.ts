#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { importCommand } from './commands/import';
import { listCommand } from './commands/list';
import { askCommand } from './commands/ask';

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
  .action(async (question: string, options: { table?: string }) => {
    await askCommand(question, options.table);
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
  console.log();
  program.outputHelp();
}