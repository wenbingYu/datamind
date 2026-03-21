import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { importCSV } from '../../core/importer/csv';
import { getConfig, ensureDataDir } from '../../utils/config';
import { FileError, ImportError } from '../../utils/errors';

export async function importCommand(file: string): Promise<void> {
  // Check file exists
  if (!fs.existsSync(file)) {
    throw new FileError(`文件不存在: ${file}`);
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
      throw new FileError(`不支持的文件格式: ${ext}，目前支持: CSV`);
    }
  } catch (error) {
    spinner.fail(chalk.red('导入失败'));
    if (error instanceof FileError || error instanceof ImportError) {
      throw error;
    }
    throw new ImportError(error instanceof Error ? error.message : String(error));
  }
}