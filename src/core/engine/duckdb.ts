import { Database } from 'duckdb-async';
import * as path from 'path';
import * as fs from 'fs';
import { TableMeta, ColumnMeta } from '../../types';
import { getConfig, ensureDataDir } from '../../utils/config';

let db: Database | null = null;

export async function getDatabase(): Promise<Database> {
  if (db) return db;
  
  ensureDataDir();
  const config = getConfig();
  const dbPath = config.storage.duckdbPath;
  
  // Ensure directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  db = await Database.create(dbPath);
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}

export async function executeSQL(sql: string): Promise<any[]> {
  const database = await getDatabase();
  return await database.all(sql);
}

export async function executeSQLWithTime(sql: string): Promise<{ rows: any[]; time: number }> {
  const database = await getDatabase();
  const start = Date.now();
  const rows = await database.all(sql);
  const time = Date.now() - start;
  return { rows, time };
}

export async function tableExists(tableName: string): Promise<boolean> {
  const database = await getDatabase();
  const result = await database.all(
    `SELECT table_name FROM information_schema.tables WHERE table_name = ?`,
    [tableName.toLowerCase()]
  );
  return result.length > 0;
}

export async function getTableNames(): Promise<string[]> {
  const database = await getDatabase();
  const result = await database.all(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'`
  );
  return result.map(r => r.table_name);
}

export async function getTableMeta(tableName: string): Promise<TableMeta | null> {
  const database = await getDatabase();
  
  // Check if table exists
  const exists = await tableExists(tableName);
  if (!exists) return null;
  
  // Get row count
  const countResult = await database.all(`SELECT COUNT(*) as count FROM "${tableName}"`);
  const rowCount = typeof countResult[0]?.count === 'bigint' 
    ? Number(countResult[0].count) 
    : (countResult[0]?.count || 0);
  
  // Get column info
  const columnsResult = await database.all(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ?`,
    [tableName.toLowerCase()]
  );
  
  // Get sample values for each column
  const columns: ColumnMeta[] = [];
  for (const col of columnsResult) {
    const sampleResult = await database.all(
      `SELECT "${col.column_name}" FROM "${tableName}" WHERE "${col.column_name}" IS NOT NULL LIMIT 5`
    );
    const sampleValues = sampleResult.map(r => r[col.column_name]);
    
    // Infer type
    let type: ColumnMeta['type'] = 'string';
    const duckType = col.data_type.toLowerCase();
    if (duckType.includes('int') || duckType.includes('double') || duckType.includes('float') || duckType.includes('decimal') || duckType.includes('numeric')) {
      type = 'number';
    } else if (duckType.includes('date') || duckType.includes('time')) {
      type = 'date';
    } else if (duckType.includes('boolean')) {
      type = 'boolean';
    }
    
    columns.push({
      name: col.column_name,
      type,
      nullable: true,
      sampleValues
    });
  }
  
  return {
    name: tableName,
    rowCount,
    columns,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

export async function getAllTablesMeta(): Promise<TableMeta[]> {
  const tableNames = await getTableNames();
  const metas: TableMeta[] = [];
  
  for (const name of tableNames) {
    const meta = await getTableMeta(name);
    if (meta) metas.push(meta);
  }
  
  return metas;
}