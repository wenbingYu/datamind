// Core types for DocAgent

export interface Config {
  // API 配置（阿里云百炼）
  apiKey: string;
  baseUrl: string;
  llmModel: string;
  embeddingModel: string;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  similarityThreshold: number;
  
  // 兼容旧字段名（已废弃）
  /** @deprecated Use apiKey instead */
  zhipuApiKey?: string;
  /** @deprecated Use baseUrl instead */
  zhipuBaseUrl?: string;
}

export interface Document {
  id: string;
  url: string;
  title: string;
  content: string;
  markdown: string;
  createdAt: number;
  updatedAt: number;
}

export interface Chunk {
  id: string;
  documentId: string;
  content: string;
  embedding?: number[];
  sourceUrl: string;
  title: string;
  chunkIndex: number;
  createdAt: number;
}

export interface SearchResult {
  chunk: Chunk;
  score: number;
}

export interface AskResponse {
  answer: string;
  sources: Array<{
    url: string;
    title: string;
    content: string;
    score: number;
  }>;
  confidence: 'high' | 'medium' | 'low';
}

export interface CrawlResult {
  url: string;
  title: string;
  content: string;
  markdown: string;
  links: string[];
}