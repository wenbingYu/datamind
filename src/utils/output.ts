import Table from 'cli-table3';
import chalk from 'chalk';

export function formatTable(columns: string[], rows: any[][]): string {
  if (rows.length === 0) {
    return chalk.yellow('无数据');
  }

  const table = new Table({
    head: columns.map(c => chalk.cyan.bold(c)),
    style: {
      head: [],
      border: ['grey']
    }
  });

  for (const row of rows) {
    table.push(row.map(cell => formatCell(cell)));
  }

  return table.toString();
}

function formatCell(cell: any): string {
  if (cell === null || cell === undefined) {
    return chalk.grey('NULL');
  }
  
  if (typeof cell === 'number') {
    // Format large numbers
    if (cell >= 1000000) {
      return chalk.green((cell / 1000000).toFixed(2) + 'M');
    } else if (cell >= 1000) {
      return chalk.green(cell.toLocaleString());
    }
    return chalk.green(cell.toString());
  }
  
  if (cell instanceof Date) {
    return chalk.blue(cell.toLocaleDateString('zh-CN'));
  }
  
  if (typeof cell === 'boolean') {
    return cell ? chalk.green('✓') : chalk.red('✗');
  }
  
  // Truncate long strings
  const str = String(cell);
  if (str.length > 50) {
    return str.substring(0, 47) + '...';
  }
  
  return str;
}

export function formatTablesList(tables: { name: string; rowCount: number; columns: string[] }[]): string {
  if (tables.length === 0) {
    return chalk.yellow('暂无数据表，使用 datamind import <file> 导入数据');
  }

  const table = new Table({
    head: [chalk.cyan.bold('表名'), chalk.cyan.bold('行数'), chalk.cyan.bold('列')],
    style: {
      head: [],
      border: ['grey']
    },
    colWidths: [20, 12, 60]
  });

  for (const t of tables) {
    table.push([
      chalk.white(t.name),
      chalk.green(t.rowCount.toLocaleString()),
      chalk.grey(t.columns.slice(0, 5).join(', ') + (t.columns.length > 5 ? ' ...' : ''))
    ]);
  }

  return table.toString();
}

export function formatQueryResult(result: { sql: string; columns: string[]; rows: any[][]; rowCount: number; executionTime: number }): string {
  const lines: string[] = [];
  
  // SQL
  lines.push(chalk.grey('─'.repeat(60)));
  lines.push(chalk.dim('SQL: ') + chalk.white(result.sql));
  lines.push(chalk.grey('─'.repeat(60)));
  
  // Results
  if (result.rows.length === 0) {
    lines.push(chalk.yellow('查询无结果'));
  } else {
    lines.push(formatTable(result.columns, result.rows));
  }
  
  // Stats
  lines.push('');
  lines.push(chalk.dim(`返回 ${result.rowCount} 行 · 耗时 ${result.executionTime}ms`));
  
  return lines.join('\n');
}

export function formatNumber(num: number): string {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(2) + 'B';
  } else if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(2) + 'K';
  }
  return num.toLocaleString('zh-CN');
}