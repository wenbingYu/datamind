import { Config } from '../types';
import fs from 'fs';
import path from 'path';
import os from 'os';

const VOCABULARY_PATH = path.join(os.homedir(), '.docagent', 'vocabulary.json');

interface VocabularyData {
  vocabulary: Record<string, number>;
  documentFrequency: Record<string, number>;
  documentCount: number;
  embeddingDim: number;
}

/**
 * Local embedding service using simple TF-IDF based approach
 * No external API required, works offline
 */
export class LocalEmbeddingService {
  private vocabulary: Map<string, number> = new Map();
  private documentFrequency: Map<string, number> = new Map();
  private documentCount: number = 0;
  private embeddingDim: number = 1024; // 增加维度以容纳更多词汇
  private vocabularyLoaded: boolean = false;

  constructor(config: Config) {
    // Configuration not needed for local embeddings
    // Try to load existing vocabulary on construction
    this.loadVocabulary();
  }

  /**
   * Load vocabulary from disk
   */
  loadVocabulary(): boolean {
    try {
      if (fs.existsSync(VOCABULARY_PATH)) {
        const data: VocabularyData = JSON.parse(fs.readFileSync(VOCABULARY_PATH, 'utf-8'));
        this.vocabulary = new Map(Object.entries(data.vocabulary));
        this.documentFrequency = new Map(Object.entries(data.documentFrequency));
        this.documentCount = data.documentCount;
        this.embeddingDim = data.embeddingDim;
        this.vocabularyLoaded = true;
        return true;
      }
    } catch (error) {
      // Ignore errors, will build fresh vocabulary
    }
    return false;
  }

  /**
   * Save vocabulary to disk
   */
  saveVocabulary(): void {
    const data: VocabularyData = {
      vocabulary: Object.fromEntries(this.vocabulary),
      documentFrequency: Object.fromEntries(this.documentFrequency),
      documentCount: this.documentCount,
      embeddingDim: this.embeddingDim,
    };
    
    const dir = path.dirname(VOCABULARY_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(VOCABULARY_PATH, JSON.stringify(data, null, 2));
  }

  /**
   * Check if vocabulary is loaded
   */
  isVocabularyLoaded(): boolean {
    return this.vocabularyLoaded && this.vocabulary.size > 0;
  }

  /**
   * Build vocabulary from texts (for initial indexing)
   */
  buildVocabulary(texts: string[]): void {
    this.vocabulary.clear();
    this.documentFrequency.clear();
    this.documentCount = texts.length;

    let vocabIndex = 0;

    for (const text of texts) {
      const tokens = this.tokenize(text);
      const uniqueTokens = new Set(tokens);

      for (const token of uniqueTokens) {
        if (!this.vocabulary.has(token)) {
          this.vocabulary.set(token, vocabIndex++);
        }
        this.documentFrequency.set(token, (this.documentFrequency.get(token) || 0) + 1);
      }
    }
    
    // Save vocabulary after building
    this.saveVocabulary();
    this.vocabularyLoaded = true;
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1);
  }

  /**
   * Generate embedding for a single text
   * Uses existing vocabulary (loaded or built from previous batch)
   */
  async embed(text: string): Promise<number[]> {
    // For search queries, we should use existing vocabulary
    // If no vocabulary is loaded, this will produce meaningless embeddings
    if (!this.vocabularyLoaded && this.vocabulary.size === 0) {
      // No vocabulary available - return zero vector
      // This shouldn't happen in normal usage
      return new Array(this.embeddingDim).fill(0);
    }

    const tokens = this.tokenize(text);
    
    if (tokens.length === 0) {
      return new Array(this.embeddingDim).fill(0);
    }

    const tokenFreq = new Map<string, number>();

    // Count term frequency
    for (const token of tokens) {
      tokenFreq.set(token, (tokenFreq.get(token) || 0) + 1);
    }

    // Create TF-IDF vector using existing vocabulary
    const embedding = new Array(this.embeddingDim).fill(0);

    for (const [token, freq] of tokenFreq) {
      const idx = this.vocabulary.get(token);
      if (idx !== undefined && idx < this.embeddingDim) {
        const tf = freq / tokens.length;
        const df = this.documentFrequency.get(token) || 1;
        const idf = this.documentCount > 0 ? Math.log(this.documentCount / df) : 0;
        embedding[idx] = tf * idf;
      }
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= norm;
      }
    }

    return embedding;
  }

  /**
   * Generate embeddings for multiple texts (for indexing)
   * This builds/updates vocabulary and saves it
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    // Don't process empty arrays - preserve existing vocabulary
    if (texts.length === 0) {
      return [];
    }
    
    // Update vocabulary with new texts (preserving existing)
    this.updateVocabulary(texts);

    const embeddings: number[][] = [];
    for (const text of texts) {
      embeddings.push(await this.embed(text));
    }
    return embeddings;
  }
  
  /**
   * Update vocabulary with new texts (for incremental indexing)
   */
  updateVocabulary(newTexts: string[]): void {
    // If vocabulary doesn't exist, build fresh
    if (!this.vocabularyLoaded) {
      this.buildVocabulary(newTexts);
      return;
    }
    
    // Otherwise, update existing vocabulary
    let vocabIndex = this.vocabulary.size;
    
    for (const text of newTexts) {
      const tokens = this.tokenize(text);
      const uniqueTokens = new Set(tokens);

      for (const token of uniqueTokens) {
        if (!this.vocabulary.has(token)) {
          this.vocabulary.set(token, vocabIndex++);
        }
        this.documentFrequency.set(token, (this.documentFrequency.get(token) || 0) + 1);
      }
    }
    
    this.documentCount += newTexts.length;
    this.saveVocabulary();
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}