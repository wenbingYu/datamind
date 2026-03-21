import * as fs from 'fs';
import * as path from 'path';
import { ColumnMeta, TableMeta } from '../../types';
import { executeSQL, tableExists, getTableMeta, getDatabase } from '../engine/duckdb';
import { indexTableSchema } from '../engine/lancedb';

interface ParseResult {
  headers: string[];
  rows: string[][];
  columnTypes: Map<string, ColumnMeta['type']>;
}

export async function parseCSV(filePath: string): Promise<ParseResult> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    throw new Error('CSV 文件为空');
  }
  
  // Parse header
  const headers = parseCSVLine(lines[0]);
  
  // Parse rows
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length === headers.length) {
      rows.push(row);
    }
  }
  
  // Infer column types
  const columnTypes = inferColumnTypes(headers, rows);
  
  return { headers, rows, columnTypes };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function inferColumnTypes(headers: string[], rows: string[][]): Map<string, ColumnMeta['type']> {
  const types = new Map<string, ColumnMeta['type']>();
  
  for (let colIndex = 0; colIndex < headers.length; colIndex++) {
    const header = headers[colIndex];
    let isNumber = true;
    let isDate = true;
    let isBoolean = true;
    let hasValue = false;
    
    for (let rowIndex = 0; rowIndex < Math.min(rows.length, 100); rowIndex++) {
      const value = rows[rowIndex][colIndex];
      if (!value || value.trim() === '') continue;
      
      hasValue = true;
      
      // Check number
      if (isNaN(Number(value))) {
        isNumber = false;
      }
      
      // Check date
      if (isNaN(Date.parse(value))) {
        isDate = false;
      }
      
      // Check boolean
      const lower = value.toLowerCase();
      if (lower !== 'true' && lower !== 'false' && lower !== 'yes' && lower !== 'no' && lower !== '1' && lower !== '0') {
        isBoolean = false;
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

export async function importCSV(filePath: string, tableName?: string): Promise<TableMeta> {
  const name = tableName || path.basename(filePath, '.csv').toLowerCase().replace(/[^a-z0-9_]/g, '_');
  
  // Parse CSV
  const { headers, rows, columnTypes } = await parseCSV(filePath);
  
  // Check if table exists
  const exists = await tableExists(name);
  if (exists) {
    // Drop existing table
    await executeSQL(`DROP TABLE "${name}"`);
  }
  
  // Create table
  const columnDefs = headers.map(h => {
    const type = columnTypes.get(h) || 'string';
    return `"${h}" ${getDuckDBType(type)}`;
  }).join(', ');
  
  await executeSQL(`CREATE TABLE "${name}" (${columnDefs})`);
  
  // Insert data
  if (rows.length > 0) {
    // Batch insert using direct SQL for better compatibility
    for (const row of rows) {
      const values = row.map((v, i) => {
        const type = columnTypes.get(headers[i]);
        if (v === '' || v === null || v === undefined) return 'NULL';
        
        switch (type) {
          case 'number':
            return Number(v);
          case 'boolean':
            const lower = v.toLowerCase();
            return lower === 'true' || lower === 'yes' || lower === '1' ? 'TRUE' : 'FALSE';
          case 'date':
            return `'${v}'`;
          default:
            // Escape single quotes
            return `'${v.replace(/'/g, "''")}'`;
        }
      }).join(', ');
      
      await executeSQL(`INSERT INTO "${name}" VALUES (${values})`);
    }
  }
  
  // Get table metadata
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