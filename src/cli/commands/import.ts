import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { importCSV } from '../../core/importer/csv';
import { getConfig, ensureDataDir } from '../../utils/config';

export async function importCommand(file: string): Promise<void> {
  // Check file exists
  if (!fs.existsSync(file)) {
    console.error(chalk.red(`错误: 文件不存在: ${file}`));
    process.exit(1);
  }

  // Ensure data directory exists
  ensureDataDir();

  const spinner = ora('正在导入数据...').start();

  try {
    // Determine file type
    const ext = path.extname(file).toLowerCase();
    let tableName: string;

    if (ext === '.csv') {
      const meta = await importCSV(file);
      tableName = meta.name;
      spinner.succeed(chalk.green(`导入成功!`));
      console.log();
      console.log(chalk.white(`  表名: `) + chalk.cyan(tableName));
      console.log(chalk.white(`  行数: `) + chalk.green(meta.rowCount.toLocaleString()));
      console.log(chalk.white(`  列数: `) + chalk.green(meta.columns.length.toString()));
      console.log();
      console.log(chalk.dim(`使用 'datamind ask "问题"' 查询数据`));
    } else {
      spinner.fail(chalk.red(`不支持的文件格式: ${ext}`));
      console.log(chalk.dim('目前支持: CSV'));
      process.exit(1);
    }
  } catch (error) {
    spinner.fail(chalk.red('导入失败'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}