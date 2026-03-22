import * as path from 'path';
import * as fs from 'fs';
import * as lancedb from '@lancedb/lancedb';
import { TableMeta, ColumnMeta } from '../../types';
import { getConfig, ensureDataDir } from '../../utils/config';
import { getLLMClient } from '../llm/client';

interface TableSchema {
  tableName: string;
  schemaText: string;
  embedding?: number[];
  updatedAt: number;
  [key: string]: unknown;  // 添加索引签名
}

let db: lancedb.Connection | null = null;

/**
 * 获取 LanceDB 连接 (单例)
 */
async function getDB(): Promise<lancedb.Connection> {
  if (db) return db;
  
  const config = getConfig();
  ensureDataDir();
  
  db = await lancedb.connect(config.storage.lancedbPath);
  return db;
}

/**
 * 将 schema 转换为文本描述
 */
function schemaToText(tableName: string, columns: ColumnMeta[]): string {
  const colDescriptions = columns.map(col => {
    const samples = col.sampleValues.slice(0, 3).join(', ');
    return `${col.name} (${col.type})${samples ? ` 例如: ${samples}` : ''}`;
  });
  
  return `表 ${tableName} 包含以下列: ${colDescriptions.join('; ')}`;
}

/**
 * 计算两个向量的余弦相似度
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 使用 LLM 生成嵌入向量
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const config = getConfig();
  
  if (config.llm.apiKey) {
    try {
      const client = getLLMClient(config);
      // 使用 LLM 生成简化的语义向量
      // 实际应用中应该调用 embedding API
      const prompt = `将以下文本转换为 128 维向量表示。只返回 JSON 数组，不要解释。

文本: ${text}

返回格式: [0.1, 0.2, ...]`;

      const response = await client.chat(prompt);
      try {
        return JSON.parse(response);
      } catch {
        // 解析失败，使用简化方法
      }
    } catch {
      // LLM 调用失败，使用简化方法
    }
  }
  
  // 简化的 TF-IDF 风格向量
  const words = text.toLowerCase().split(/\s+/);
  const wordCount: Record<string, number> = {};
  
  for (const word of words) {
    wordCount[word] = (wordCount[word] || 0) + 1;
  }
  
  const allWords = Object.keys(wordCount).sort();
  const vector = allWords.map(w => wordCount[w] / words.length);
  
  // 填充到 128 维
  while (vector.length < 128) {
    vector.push(0);
  }
  
  return vector.slice(0, 128);
}

/**
 * 为表 schema 建立向量索引
 */
export async function indexTableSchema(tableName: string, schema: ColumnMeta[]): Promise<void> {
  const database = await getDB();
  
  const schemaText = schemaToText(tableName, schema);
  const embedding = await generateEmbedding(schemaText);
  
  const record: TableSchema = {
    tableName,
    schemaText,
    embedding,
    updatedAt: Date.now()
  };
  
  // 创建或更新表
  const tableName_safe = `schema_${tableName.replace(/[^a-zA-Z0-9_]/g, '_')}`;
  
  try {
    const table = await database.openTable(tableName_safe);
    // 删除旧记录
    await table.delete(`tableName = "${tableName}"`);
    // 添加新记录
    await table.add([record]);
  } catch {
    // 表不存在，创建新表
    await database.createTable(tableName_safe, [record]);
  }
}

/**
 * 根据问题推荐相关表
 */
export async function recommendTables(question: string, limit: number = 3): Promise<string[]> {
  const database = await getDB();
  
  // 获取所有 schema 表
  const tables = await database.tableNames();
  const schemaTables = tables.filter(t => t.startsWith('schema_'));
  
  if (schemaTables.length === 0) {
    return [];
  }
  
  // 为问题生成向量
  const questionEmbedding = await generateEmbedding(question);
  
  // 收集所有表的 schema
  const allSchemas: { tableName: string; similarity: number }[] = [];
  
  for (const tableName of schemaTables) {
    try {
      const table = await database.openTable(tableName);
      const records = await table.query().toArray() as TableSchema[];
      
      for (const record of records) {
        if (record.embedding) {
          const similarity = cosineSimilarity(questionEmbedding, record.embedding);
          allSchemas.push({
            tableName: record.tableName,
            similarity
          });
        }
      }
    } catch {
      // 跳过错误的表
    }
  }
  
  // 按相似度排序
  allSchemas.sort((a, b) => b.similarity - a.similarity);
  
  // 使用 LLM 进行更精确的匹配（如果有 API）
  const config = getConfig();
  if (config.llm.apiKey && allSchemas.length > 0) {
    try {
      const client = getLLMClient(config);
      
      const topCandidates = allSchemas.slice(0, 5);
      const schemaInfos = topCandidates.map(t => t.tableName).join(', ');
      
      const prompt = `用户问题: "${question}"

可用的数据表: ${schemaInfos}

请判断哪些表与问题最相关。返回最相关的表名，用逗号分隔。如果没有相关表，返回 "无"。
只返回表名，不要解释。`;

      const response = await client.chat(prompt);
      
      if (response && response !== '无') {
        const recommendedTables = response.split(/[,，]/).map(t => t.trim()).filter(t => t);
        // 验证表名存在
        return recommendedTables.filter(t => 
          allSchemas.some(s => s.tableName === t)
        ).slice(0, limit);
      }
    } catch {
      // LLM 调用失败，使用向量相似度结果
    }
  }
  
  // 返回相似度最高的表
  return allSchemas.slice(0, limit).map(t => t.tableName);
}

/**
 * 获取所有已索引的表
 */
export async function getIndexedTables(): Promise<string[]> {
  const database = await getDB();
  const tables = await database.tableNames();
  const schemaTables = tables.filter(t => t.startsWith('schema_'));
  
  const result: string[] = [];
  
  for (const tableName of schemaTables) {
    try {
      const table = await database.openTable(tableName);
      const records = await table.query().limit(1000).toArray() as TableSchema[];
      result.push(...records.map(r => r.tableName));
    } catch {
      // 跳过错误的表
    }
  }
  
  return result;
}

/**
 * 删除表的索引
 */
export async function deleteTableIndex(tableName: string): Promise<void> {
  const database = await getDB();
  const tableName_safe = `schema_${tableName.replace(/[^a-zA-Z0-9_]/g, '_')}`;
  
  try {
    await database.dropTable(tableName_safe);
  } catch {
    // 表不存在，忽略
  }
}

/**
 * 重建所有表的索引
 */
export async function rebuildAllIndexes(tables: TableMeta[]): Promise<void> {
  for (const table of tables) {
    await indexTableSchema(table.name, table.columns);
  }
}

/**
 * 获取表的 schema 文本
 */
export async function getTableSchemaText(tableName: string): Promise<string | null> {
  const database = await getDB();
  const tableName_safe = `schema_${tableName.replace(/[^a-zA-Z0-9_]/g, '_')}`;
  
  try {
    const table = await database.openTable(tableName_safe);
    const records = await table.query().toArray() as TableSchema[];
    const record = records.find(r => r.tableName === tableName);
    return record?.schemaText || null;
  } catch {
    return null;
  }
}

/**
 * 关闭数据库连接
 */
export async function closeDB(): Promise<void> {
  // LanceDB 自动管理连接，无需显式关闭
  db = null;
}