import * as path from 'path';
import * as fs from 'fs';
import { TableMeta, ColumnMeta } from '../../types';
import { getConfig, ensureDataDir } from '../../utils/config';
import { getLLMClient } from '../llm/client';

// 简化的向量存储实现（不依赖 LanceDB 原生库）
// 使用 JSON 文件存储表 schema 的向量表示

interface TableVector {
  tableName: string;
  schemaText: string;
  embedding?: number[];
  updatedAt: number;
}

interface VectorStore {
  tables: Record<string, TableVector>;
}

let store: VectorStore | null = null;

function getStorePath(): string {
  const config = getConfig();
  return path.join(config.storage.lancedbPath, 'vectors.json');
}

function loadStore(): VectorStore {
  if (store) return store;
  
  const storePath = getStorePath();
  if (fs.existsSync(storePath)) {
    try {
      store = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
    } catch {
      store = { tables: {} };
    }
  } else {
    store = { tables: {} };
  }
  
  return store!;
}

function saveStore(): void {
  ensureDataDir();
  const storePath = getStorePath();
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

/**
 * 将 schema 文本转换为向量（使用 LLM 生成嵌入）
 * 由于大多数 API 不直接支持嵌入，我们使用简化的相似度计算
 */
async function generateEmbedding(text: string): Promise<number[]> {
  // 使用简单的 TF-IDF 风格的向量
  // 这是一个简化的实现，实际应用中应使用真正的嵌入模型
  const words = text.toLowerCase().split(/\s+/);
  const wordCount: Record<string, number> = {};
  
  for (const word of words) {
    wordCount[word] = (wordCount[word] || 0) + 1;
  }
  
  // 返回词频向量（简化版）
  const allWords = Object.keys(wordCount).sort();
  return allWords.map(w => wordCount[w] / words.length);
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
 * 为表 schema 建立向量索引
 */
export async function indexTableSchema(tableName: string, schema: ColumnMeta[]): Promise<void> {
  const vectorStore = loadStore();
  
  const schemaText = schemaToText(tableName, schema);
  const embedding = await generateEmbedding(schemaText);
  
  vectorStore.tables[tableName] = {
    tableName,
    schemaText,
    embedding,
    updatedAt: Date.now()
  };
  
  saveStore();
}

/**
 * 根据问题推荐相关表
 */
export async function recommendTables(question: string, limit: number = 3): Promise<string[]> {
  const vectorStore = loadStore();
  const tables = Object.values(vectorStore.tables);
  
  if (tables.length === 0) {
    return [];
  }
  
  // 为问题生成向量
  const questionEmbedding = await generateEmbedding(question);
  
  // 计算相似度
  const similarities = tables.map(table => ({
    tableName: table.tableName,
    similarity: table.embedding 
      ? cosineSimilarity(questionEmbedding, table.embedding)
      : 0,
    schemaText: table.schemaText
  }));
  
  // 按相似度排序
  similarities.sort((a, b) => b.similarity - a.similarity);
  
  // 使用 LLM 进行更精确的匹配（如果有 API）
  const config = getConfig();
  if (config.llm.apiKey) {
    try {
      const client = getLLMClient(config);
      
      const topCandidates = similarities.slice(0, 5);
      const schemaInfos = topCandidates.map(t => t.schemaText).join('\n');
      
      const prompt = `用户问题: "${question}"

可用的数据表:
${schemaInfos}

请判断哪些表与问题最相关。返回最相关的表名，用逗号分隔。如果没有相关表，返回 "无"。
只返回表名，不要解释。`;

      const response = await client.chat(prompt);
      
      if (response && response !== '无') {
        const recommendedTables = response.split(/[,，]/).map(t => t.trim()).filter(t => t);
        // 验证表名存在
        return recommendedTables.filter(t => vectorStore.tables[t]);
      }
    } catch {
      // LLM 调用失败，使用向量相似度结果
    }
  }
  
  // 返回相似度最高的表
  return similarities.slice(0, limit).map(t => t.tableName);
}

/**
 * 获取所有已索引的表
 */
export function getIndexedTables(): string[] {
  const vectorStore = loadStore();
  return Object.keys(vectorStore.tables);
}

/**
 * 删除表的索引
 */
export function deleteTableIndex(tableName: string): void {
  const vectorStore = loadStore();
  delete vectorStore.tables[tableName];
  saveStore();
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
export function getTableSchemaText(tableName: string): string | null {
  const vectorStore = loadStore();
  return vectorStore.tables[tableName]?.schemaText || null;
}