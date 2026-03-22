import express from 'express';
import path from 'path';
import { loadConfig, ensureDirectories } from '../utils/config';
import { Chunker } from '../utils/chunker';
import { Crawler } from '../crawler';
import { Storage } from '../storage';
import { LocalEmbeddingService } from '../embedding/local';
import { LLMService } from '../embedding/llm';
import { Document } from '../types';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store active storage instance
let storage: Storage | null = null;
let embeddingService: LocalEmbeddingService | null = null;

async function getStorage(): Promise<Storage> {
  if (!storage || !embeddingService) {
    const config = loadConfig();
    ensureDirectories();
    embeddingService = new LocalEmbeddingService(config);
    storage = new Storage(embeddingService, true);
    await storage.init();
  }
  return storage;
}

// API: List all documents
app.get('/api/documents', async (req, res) => {
  try {
    const storage = await getStorage();
    const documents = storage.listDocuments();
    res.json({ success: true, documents });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// API: Add a document
app.post('/api/add', async (req, res) => {
  try {
    const { url, depth = 1 } = req.body;
    
    if (!url) {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }

    const config = loadConfig();
    const storage = await getStorage();
    const crawler = new Crawler();
    const chunker = new Chunker(config);

    // Crawl pages with BFS
    const crawlResults = await crawler.crawlRecursive(url, depth);

    if (crawlResults.length === 0) {
      return res.json({ success: false, error: 'No pages found' });
    }

    const documents: Document[] = [];
    const allChunks: any[] = [];

    for (const crawlResult of crawlResults) {
      const existingDoc = storage.getDocumentByUrl(crawlResult.url);
      
      const docId = existingDoc?.id || uuidv4();
      const document: Document = {
        id: docId,
        url: crawlResult.url,
        title: crawlResult.title,
        content: crawlResult.content,
        markdown: crawlResult.markdown,
        createdAt: existingDoc?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      documents.push(document);

      const chunks = chunker.chunkText(
        crawlResult.markdown,
        document.id,
        document.url,
        document.title
      );

      allChunks.push(...chunks);
    }

    // Store documents
    for (const doc of documents) {
      storage.addDocument(doc);
    }

    // Generate embeddings
    await storage.addChunks(allChunks);

    res.json({ 
      success: true, 
      pagesIndexed: documents.length,
      chunksCreated: allChunks.length,
      documents: documents.map(d => ({ title: d.title, url: d.url }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// API: Ask a question
app.post('/api/ask', async (req, res) => {
  try {
    const { question, topK = 5 } = req.body;
    
    if (!question) {
      return res.status(400).json({ success: false, error: 'Question is required' });
    }

    const config = loadConfig();
    const storage = await getStorage();
    const llm = new LLMService(config);

    // Search for relevant chunks
    const results = await storage.hybridSearch(question, topK);

    if (results.length === 0) {
      return res.json({ 
        success: true, 
        answer: 'No relevant content found. Try adding some documentation first.',
        sources: [],
        confidence: 'low'
      });
    }

    // Build context
    const context = results
      .map((r, i) => `[${i + 1}] ${r.chunk.content}`)
      .join('\n\n---\n\n');

    // Generate answer
    const answer = await llm.askWithContext(question, context);

    // Calculate confidence
    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    let confidence: 'high' | 'medium' | 'low';
    if (avgScore >= config.similarityThreshold) {
      confidence = 'high';
    } else if (avgScore >= config.similarityThreshold * 0.7) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    res.json({
      success: true,
      answer,
      sources: results.map(r => ({
        title: r.chunk.title,
        url: r.chunk.sourceUrl,
        score: r.score,
        content: r.chunk.content.substring(0, 200) + '...'
      })),
      confidence
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// API: Delete a document
app.delete('/api/documents/:url', async (req, res) => {
  try {
    const url = decodeURIComponent(req.params.url);
    const storage = await getStorage();
    
    const doc = storage.getDocumentByUrl(url);
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    storage.deleteDocument(doc.id);
    res.json({ success: true, message: `Deleted: ${doc.title}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Start server
export function startServer(port: number = 3000) {
  return new Promise<void>((resolve) => {
    app.listen(port, () => {
      console.log(`DocAgent Web UI running at http://localhost:${port}`);
      resolve();
    });
  });
}

export { app };