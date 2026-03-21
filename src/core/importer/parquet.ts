import * as path from 'path';
import { TableMeta } from '../../types';
import { executeSQL, tableExists, getTableMeta } from '../engine/duckdb';
import { indexTableSchema } from '../engine/lancedb';

/**
 * 验证表名，只允许字母、数字、下划线
 */
function validateTableName(name: string): string {
  const sanitized = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (sanitized.length === 0) {
    throw new Error('无效的表名');
  }
  return sanitized;
}

/**
 * 导入 Parquet 文件
 * DuckDB 原生支持 Parquet，可以直接读取
 * @param filePath Parquet 文件路径
 * @param tableName 可选的表名（不指定则使用文件名）
 * @returns 导入的表元数据
 */
export async function importParquet(filePath: string, tableName?: string): Promise<TableMeta> {
  // 验证并清理表名
  const name = validateTableName(tableName || path.basename(filePath, '.parquet'));
  const absolutePath = path.resolve(filePath);

  // 检查表是否存在
  const exists = await tableExists(name);
  if (exists) {
    await executeSQL(`DROP TABLE "${name}"`);
  }

  // DuckDB 直接读取 Parquet 并创建表
  await executeSQL(`CREATE TABLE "${name}" AS SELECT * FROM read_parquet('${absolutePath}')`);

  // 获取表元数据
  const meta = await getTableMeta(name);
  if (!meta) {
    throw new Error('导入失败：无法获取表元数据');
  }

  // 为表 schema 建立向量索引
  try {
    await indexTableSchema(meta.name, meta.columns);
  } catch {
    // 忽略索引错误
  }

  return meta;
}