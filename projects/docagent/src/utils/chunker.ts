import { Config, Chunk } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class Chunker {
  private chunkSize: number;
  private chunkOverlap: number;

  constructor(config: Config) {
    this.chunkSize = config.chunkSize;
    this.chunkOverlap = config.chunkOverlap;
  }

  chunkText(
    text: string,
    documentId: string,
    sourceUrl: string,
    title: string
  ): Chunk[] {
    const chunks: Chunk[] = [];
    const paragraphs = text.split(/\n\n+/);
    
    let currentChunk = '';
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();
      if (!trimmed) continue;

      if (currentChunk.length + trimmed.length > this.chunkSize) {
        if (currentChunk) {
          chunks.push(this.createChunk(currentChunk, documentId, sourceUrl, title, chunkIndex++));
          
          // Keep overlap from the end of previous chunk
          const overlap = this.getOverlap(currentChunk);
          currentChunk = overlap + trimmed;
        } else {
          // Paragraph is longer than chunk size, split it
          const subChunks = this.splitLongParagraph(trimmed, documentId, sourceUrl, title, chunkIndex);
          chunks.push(...subChunks.chunks);
          chunkIndex = subChunks.lastIndex;
          currentChunk = subChunks.remaining;
        }
      } else {
        currentChunk = currentChunk ? currentChunk + '\n\n' + trimmed : trimmed;
      }
    }

    // Don't forget the last chunk
    if (currentChunk.trim()) {
      chunks.push(this.createChunk(currentChunk, documentId, sourceUrl, title, chunkIndex));
    }

    return chunks;
  }

  private createChunk(
    content: string,
    documentId: string,
    sourceUrl: string,
    title: string,
    index: number
  ): Chunk {
    return {
      id: uuidv4(),
      documentId,
      content: content.trim(),
      sourceUrl,
      title,
      chunkIndex: index,
      createdAt: Date.now(),
    };
  }

  private getOverlap(text: string): string {
    if (text.length <= this.chunkOverlap) return text;
    
    // Find a good break point
    const overlapText = text.slice(-this.chunkOverlap);
    const firstSentence = overlapText.indexOf('. ');
    
    if (firstSentence !== -1) {
      return overlapText.slice(firstSentence + 2);
    }
    
    const firstSpace = overlapText.indexOf(' ');
    if (firstSpace !== -1) {
      return overlapText.slice(firstSpace + 1);
    }
    
    return overlapText;
  }

  private splitLongParagraph(
    text: string,
    documentId: string,
    sourceUrl: string,
    title: string,
    startIndex: number
  ): { chunks: Chunk[]; lastIndex: number; remaining: string } {
    const chunks: Chunk[] = [];
    let remaining = text;
    let index = startIndex;

    while (remaining.length > this.chunkSize) {
      // Try to find a good break point
      let breakPoint = this.chunkSize;
      const searchStart = Math.max(this.chunkSize - 100, 0);
      
      // Look for sentence end
      const sentenceEnd = remaining.lastIndexOf('. ', this.chunkSize);
      if (sentenceEnd > searchStart) {
        breakPoint = sentenceEnd + 1;
      } else {
        // Look for word boundary
        const spaceIndex = remaining.lastIndexOf(' ', this.chunkSize);
        if (spaceIndex > searchStart) {
          breakPoint = spaceIndex;
        }
      }

      const chunkContent = remaining.slice(0, breakPoint).trim();
      if (chunkContent) {
        chunks.push(this.createChunk(chunkContent, documentId, sourceUrl, title, index++));
      }
      
      remaining = remaining.slice(breakPoint).trim();
    }

    return { chunks, lastIndex: index, remaining };
  }
}