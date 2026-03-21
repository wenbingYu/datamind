import chalk from 'chalk';
import { getAllTablesMeta } from '../../core/engine/duckdb';
import { formatTablesList } from '../../utils/output';

export async function listCommand(): Promise<void> {
  try {
    const tables = await getAllTablesMeta();
    
    console.log();
    console.log(formatTablesList(tables.map(t => ({
      name: t.name,
      rowCount: t.rowCount,
      columns: t.columns.map(c => c.name)
    }))));
    console.log();
    
    if (tables.length > 0) {
      console.log(chalk.dim(`共 ${tables.length} 个表`));
    }
  } catch (error) {
    console.error(chalk.red('获取表列表失败'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}