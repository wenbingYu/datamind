import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { Document, Chunk, SearchResult } from '../types';
import { getDbPath, ensureDirectories } from '../utils/config';
import { EmbeddingService } from '../embedding/service';
import { LocalEmbeddingService } from '../embedding/local';

export class Storage {
  private db: Database | null = null;
  private embeddingService: EmbeddingService | LocalEmbeddingService;
  private useLocalEmbedding: boolean = false;
  private dbPath: string;

  constructor(embeddingService: EmbeddingService | LocalEmbeddingService, useLocal: boolean = false) {
    ensureDirectories();
    this.dbPath = getDbPath();
    this.embeddingService = embeddingService;
    this.useLocalEmbedding = useLocal;
  }

  async init(): Promise<void> {
    this.db = await this.initDatabase();
    this.initTables();
  }

  private getDb(): Database {
    if (!this.db) {
      throw new Error('Storage not initialized. Call init() first.');
    }
    return this.db;
  }

  private async initDatabase(): Promise<Database> {
    const SQL = await initSqlJs();

    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      return new SQL.Database(buffer);
    }

    return new SQL.Database();
  }

  private initTables(): void {
    this.getDb().run(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        url TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        markdown TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    this.getDb().run(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding BLOB,
        source_url TEXT NOT NULL,
        title TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      )
    `);

    this.getDb().run(`CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id)`);
    this.getDb().run(`CREATE INDEX IF NOT EXISTS idx_documents_url ON documents(url)`);
    
    this.save();
  }

  private save(): void {
    const data = this.getDb().export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  // Document operations
  addDocument(document: Document): void {
    this.getDb().run(
      `INSERT INTO documents (id, url, title, content, markdown, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(url) DO UPDATE SET
         title = excluded.title,
         content = excluded.content,
         markdown = excluded.markdown,
         updated_at = excluded.updated_at`,
      [document.id, document.url, document.title, document.content, document.markdown, 
       document.createdAt, document.updatedAt]
    );
    this.save();
  }

  getDocumentByUrl(url: string): Document | null {
    const result = this.getDb().exec('SELECT * FROM documents WHERE url = ?', [url]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    return this.rowToDocument(result[0].values[0], result[0].columns);
  }

  getDocumentById(id: string): Document | null {
    const result = this.getDb().exec('SELECT * FROM documents WHERE id = ?', [id]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    return this.rowToDocument(result[0].values[0], result[0].columns);
  }

  listDocuments(): Document[] {
    const result = this.getDb().exec('SELECT * FROM documents ORDER BY created_at DESC');
    if (result.length === 0) return [];
    return result[0].values.map(row => this.rowToDocument(row, result[0].columns));
  }

  deleteDocument(id: string): void {
    // First delete chunks
    this.getDb().run('DELETE FROM chunks WHERE document_id = ?', [id]);
    // Then delete document
    this.getDb().run('DELETE FROM documents WHERE id = ?', [id]);
    this.save();
  }

  // Chunk operations
  async addChunks(chunks: Chunk[]): Promise<void> {
    // Generate embeddings in batches
    const batchSize = 10;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const embeddings = await this.embeddingService.embedBatch(
        batch.map(c => c.content)
      );

      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        const embedding = embeddings[j];
        const embeddingBuffer = this.embeddingToBuffer(embedding);
        
        this.getDb().run(
          `INSERT INTO chunks (id, document_id, content, embedding, source_url, title, chunk_index, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [chunk.id, chunk.documentId, chunk.content, embeddingBuffer,
           chunk.sourceUrl, chunk.title, chunk.chunkIndex, chunk.createdAt]
        );
      }
    }
    this.save();
  }

  getChunksByDocumentId(documentId: string): Chunk[] {
    const result = this.getDb().exec('SELECT * FROM chunks WHERE document_id = ? ORDER BY chunk_index', [documentId]);
    if (result.length === 0) return [];
    return result[0].values.map(row => this.rowToChunk(row, result[0].columns));
  }

  // Search operations
  async searchSimilar(query: string, topK: number = 5): Promise<SearchResult[]> {
    const queryEmbedding = await this.embeddingService.embed(query);
    const result = this.getDb().exec('SELECT * FROM chunks');
    
    if (result.length === 0) return [];
    
    const results: SearchResult[] = result[0].values.map(row => {
      const chunk = this.rowToChunk(row, result[0].columns);
      const embeddingBuffer = row[result[0].columns.indexOf('embedding')] as Uint8Array;
      const embedding = this.bufferToEmbedding(embeddingBuffer);
      const score = this.embeddingService.cosineSimilarity(queryEmbedding, embedding);
      return { chunk, score };
    });

    // Sort by score descending and take top K
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  // Hybrid search: vector + keyword
  async hybridSearch(query: string, topK: number = 5): Promise<SearchResult[]> {
    const queryEmbedding = await this.embeddingService.embed(query);
    const queryKeywords = this.extractKeywords(query);
    
    const result = this.getDb().exec('SELECT * FROM chunks');
    
    if (result.length === 0) return [];
    
    const results: SearchResult[] = result[0].values.map(row => {
      const chunk = this.rowToChunk(row, result[0].columns);
      const embeddingBuffer = row[result[0].columns.indexOf('embedding')] as Uint8Array;
      const embedding = this.bufferToEmbedding(embeddingBuffer);
      const vectorScore = this.embeddingService.cosineSimilarity(queryEmbedding, embedding);
      const keywordScore = this.keywordMatchScore(chunk.content, queryKeywords);
      
      // Combine scores (0.7 vector, 0.3 keyword)
      const combinedScore = 0.7 * vectorScore + 0.3 * keywordScore;
      
      return { chunk, score: combinedScore };
    });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  // Helper methods
  private rowToDocument(row: any[], columns: string[]): Document {
    const getIndex = (col: string) => columns.indexOf(col);
    return {
      id: row[getIndex('id')] as string,
      url: row[getIndex('url')] as string,
      title: row[getIndex('title')] as string,
      content: row[getIndex('content')] as string,
      markdown: row[getIndex('markdown')] as string,
      createdAt: row[getIndex('created_at')] as number,
      updatedAt: row[getIndex('updated_at')] as number,
    };
  }

  private rowToChunk(row: any[], columns: string[]): Chunk {
    const getIndex = (col: string) => columns.indexOf(col);
    return {
      id: row[getIndex('id')] as string,
      documentId: row[getIndex('document_id')] as string,
      content: row[getIndex('content')] as string,
      sourceUrl: row[getIndex('source_url')] as string,
      title: row[getIndex('title')] as string,
      chunkIndex: row[getIndex('chunk_index')] as number,
      createdAt: row[getIndex('created_at')] as number,
    };
  }

  private embeddingToBuffer(embedding: number[]): Uint8Array {
    const buffer = new Uint8Array(embedding.length * 4);
    const view = new DataView(buffer.buffer);
    for (let i = 0; i < embedding.length; i++) {
      view.setFloat32(i * 4, embedding[i], true);
    }
    return buffer;
  }

  private bufferToEmbedding(buffer: Uint8Array): number[] {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const count = buffer.length / 4;
    const embedding: number[] = [];
    for (let i = 0; i < count; i++) {
      embedding.push(view.getFloat32(i * 4, true));
    }
    return embedding;
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction
    return text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1);
  }

  private keywordMatchScore(content: string, keywords: string[]): number {
    if (keywords.length === 0) return 0;
    const contentLower = content.toLowerCase();
    let matches = 0;
    for (const keyword of keywords) {
      if (contentLower.includes(keyword)) matches++;
    }
    return matches / keywords.length;
  }

  close(): void {
    this.save();
    this.getDb().close();
  }
}