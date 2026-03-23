import * as path from 'path';
import * as XLSX from 'xlsx';
import ora from 'ora';
import { ColumnMeta, TableMeta } from '../../types';
import { executeSQL, tableExists, getTableMeta } from '../engine/duckdb';
import { indexTableSchema } from '../engine/lancedb';

/**
 * 验证表名，允许中文、字母、数字、下划线
 */
function validateTableName(name: string): string {
  // 保留中文、字母、数字、下划线，其他字符替换为下划线
  const sanitized = name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9_]/g, '_');
  if (sanitized.length === 0) {
    throw new Error('无效的表名');
  }
  return sanitized;
}

/**
 * 验证列名，允许中文、字母、数字、下划线
 */
function validateColumnName(name: string): string {
  // 保留中文、字母、数字、下划线，其他字符替换为下划线
  const sanitized = name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9_]/g, '_');
  if (sanitized.length === 0) {
    throw new Error('无效的列名');
  }
  return sanitized;
}

/**
 * 生成唯一的列名（处理重复列名）
 */
function makeUniqueColumnNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map(name => {
    let uniqueName = name;
    let counter = 1;
    while (used.has(uniqueName)) {
      uniqueName = `${name}_${counter}`;
      counter++;
    }
    used.add(uniqueName);
    return uniqueName;
  });
}

interface SheetData {
  name: string;
  headers: string[];
  rows: (string | number | boolean | null)[][];
}

/**
 * 解析 Excel 文件
 */
export async function parseExcel(filePath: string, sheetName?: string): Promise<{ sheets: SheetData[] }> {
  const workbook = XLSX.readFile(filePath);
  const sheets: SheetData[] = [];

  for (const sheet of workbook.SheetNames) {
    if (sheetName && sheet !== sheetName) continue;

    const worksheet = workbook.Sheets[sheet];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (string | number | boolean | null)[][];

    if (data.length > 0) {
      sheets.push({
        name: sheet,
        headers: (data[0] || []).map(h => String(h || '')),
        rows: data.slice(1) as (string | number | boolean | null)[][]
      });
    }
  }

  return { sheets };
}

/**
 * 推断列类型
 */
function inferColumnTypes(headers: string[], rows: (string | number | boolean | null)[][]): Map<string, ColumnMeta['type']> {
  const types = new Map<string, ColumnMeta['type']>();

  for (let colIndex = 0; colIndex < headers.length; colIndex++) {
    const header = headers[colIndex];
    let isNumber = true;
    let isDate = true;
    let isBoolean = true;
    let hasValue = false;

    for (let rowIndex = 0; rowIndex < Math.min(rows.length, 100); rowIndex++) {
      const value = rows[rowIndex]?.[colIndex];
      if (value === null || value === undefined || value === '') continue;

      hasValue = true;

      // Check number
      if (typeof value !== 'number' && isNaN(Number(value))) {
        isNumber = false;
      }

      // Check date - Excel stores dates as numbers (serial dates)
      if (typeof value === 'number') {
        // Check if it might be an Excel date serial number
        if (value < 1 || value > 2958465.9999) { // Excel date range
          isDate = false;
        }
      } else if (typeof value === 'string' && isNaN(Date.parse(value))) {
        isDate = false;
      }

      // Check boolean
      if (typeof value !== 'boolean') {
        const lower = String(value).toLowerCase();
        if (lower !== 'true' && lower !== 'false' && lower !== 'yes' && lower !== 'no' && lower !== '1' && lower !== '0') {
          isBoolean = false;
        }
      }
    }

    if (!hasValue) {
      types.set(header, 'string');
    } else if (isBoolean) {
      types.set(header, 'boolean');
    } else if (isNumber) {
      types.set(header, 'number');
    } else if (isDate) {
      types.set(header, 'date');
    } else {
      types.set(header, 'string');
    }
  }

  return types;
}

function getDuckDBType(type: ColumnMeta['type']): string {
  switch (type) {
    case 'number': return 'DOUBLE';
    case 'date': return 'DATE';
    case 'boolean': return 'BOOLEAN';
    default: return 'VARCHAR';
  }
}

/**
 * 导入 Excel 文件
 * @param filePath Excel 文件路径
 * @param tableName 可选的表名（不指定则使用 sheet 名）
 * @param sheetName 可选的 sheet 名（不指定则导入所有 sheet）
 * @returns 导入的表元数据数组
 */
export async function importExcel(
  filePath: string,
  tableName?: string,
  sheetName?: string
): Promise<TableMeta[]> {
  const { sheets } = await parseExcel(filePath, sheetName);
  const metas: TableMeta[] = [];

  for (const sheet of sheets) {
    if (sheet.headers.length === 0) {
      console.log(`跳过空 sheet: ${sheet.name}`);
      continue;
    }

    // 验证并清理表名
    const name = validateTableName(tableName || sheet.name);
    // 验证并清理列名，确保唯一
    const validatedHeaders = makeUniqueColumnNames(sheet.headers.map(h => validateColumnName(h)));

    // 推断列类型
    const columnTypes = inferColumnTypes(sheet.headers, sheet.rows);

    // 检查表是否存在
    const exists = await tableExists(name);
    if (exists) {
      await executeSQL(`DROP TABLE "${name}"`);
    }

    // 创建表
    const columnDefs = validatedHeaders.map((h, i) => {
      const type = columnTypes.get(sheet.headers[i]) || 'string';
      return `"${h}" ${getDuckDBType(type)}`;
    }).join(', ');

    await executeSQL(`CREATE TABLE "${name}" (${columnDefs})`);

    // 批量插入数据
    if (sheet.rows.length > 0) {
      const BATCH_SIZE = 1000;
      const totalBatches = Math.ceil(sheet.rows.length / BATCH_SIZE);
      const spinner = ora(`导入 sheet "${sheet.name}"...`).start();

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, sheet.rows.length);
        const batch = sheet.rows.slice(start, end);

        const valueRows = batch.map(row => {
          const values = row.map((v, i) => {
            const type = columnTypes.get(sheet.headers[i]);
            if (v === null || v === undefined || v === '') return 'NULL';

            switch (type) {
              case 'number':
                return Number(v);
              case 'boolean':
                if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
                const lower = String(v).toLowerCase();
                return lower === 'true' || lower === 'yes' || lower === '1' ? 'TRUE' : 'FALSE';
              case 'date':
                // Handle Excel date serial number
                if (typeof v === 'number') {
                  return `DATE '1899-12-30' + INTERVAL '${v} days'`;
                }
                return `'${String(v).replace(/'/g, "''")}'`;
              default:
                return `'${String(v).replace(/'/g, "''")}'`;
            }
          });
          return `(${values.join(', ')})`;
        });

        const valuesClause = valueRows.join(', ');
        await executeSQL(`INSERT INTO "${name}" VALUES ${valuesClause}`);

        const progress = Math.round(((batchIndex + 1) / totalBatches) * 100);
        spinner.text = `导入 sheet "${sheet.name}"... ${progress}% (${end}/${sheet.rows.length})`;
      }

      spinner.succeed(`Sheet "${sheet.name}" 导入完成，共 ${sheet.rows.length} 行`);
    }

    // 获取表元数据
    const meta = await getTableMeta(name);
    if (meta) {
      // 为表 schema 建立向量索引
      try {
        await indexTableSchema(meta.name, meta.columns);
      } catch {
        // 忽略索引错误
      }
      metas.push(meta);
    }
  }

  return metas;
}