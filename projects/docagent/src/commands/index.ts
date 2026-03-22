import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { v4 as uuidv4 } from 'uuid';
import { loadConfig, ensureDirectories } from '../utils/config';
import { Chunker } from '../utils/chunker';
import { Crawler } from '../crawler';
import { Storage } from '../storage';
import { LocalEmbeddingService } from '../embedding/local';
import { LLMService } from '../embedding/llm';
import { Document, AskResponse } from '../types';

const program = new Command();

program
  .name('docagent')
  .description('Transform online documentation into a queryable knowledge base')
  .version('1.0.0');

// Add command
program
  .command('add <url>')
  .description('Add and index a documentation URL')
  .option('-d, --depth <number>', 'Crawl depth (default: 1, only single page)', '1')
  .action(async (url: string, options) => {
    const config = loadConfig();
    const depth = parseInt(options.depth) || 1;

    ensureDirectories();
    const spinner = ora('Initializing...').start();
    
    try {
      // Initialize services - use local embedding (no API key needed)
      const embeddingService = new LocalEmbeddingService(config);
      const storage = new Storage(embeddingService, true);
      await storage.init();
      const crawler = new Crawler();
      const chunker = new Chunker(config);

      // Crawl pages with BFS
      spinner.text = `Crawling ${url} (depth: ${depth})...`;
      
      const crawlResults = await crawler.crawlRecursive(url, depth, (current, total, currentUrl) => {
        spinner.text = `Crawling (${current}/${total}): ${currentUrl.substring(0, 60)}...`;
      });

      if (crawlResults.length === 0) {
        spinner.fail(chalk.red('No pages found to index'));
        storage.close();
        return;
      }

      spinner.text = `Found ${crawlResults.length} pages. Processing...`;

      // Collect all content for vocabulary building
      const allContents: string[] = [];
      const documents: Document[] = [];
      const allChunks: Array<{ chunk: ReturnType<Chunker['chunkText']>[0], docId: string }> = [];

      for (const crawlResult of crawlResults) {
        // Check if URL already indexed
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

        // Chunk the content
        const chunks = chunker.chunkText(
          crawlResult.markdown,
          document.id,
          document.url,
          document.title
        );

        for (const chunk of chunks) {
          allContents.push(chunk.content);
          allChunks.push({ chunk, docId: document.id });
        }
      }

      // Build vocabulary from all chunks (this saves to disk)
      spinner.text = 'Building vocabulary...';
      // Clear existing chunks for these documents before re-indexing
      for (const doc of documents) {
        const existingChunks = storage.getChunksByDocumentId(doc.id);
        // Delete old chunks by deleting and re-adding document
      }

      // Store documents
      spinner.text = 'Storing documents...';
      for (const doc of documents) {
        storage.addDocument(doc);
      }

      // Generate embeddings for all chunks
      spinner.text = `Generating embeddings for ${allChunks.length} chunks...`;
      const chunksToStore = allChunks.map(({ chunk }) => chunk);
      await storage.addChunks(chunksToStore);

      spinner.succeed(chalk.green(`Successfully indexed ${documents.length} pages`));
      console.log(chalk.dim(`  Start URL: ${url}`));
      console.log(chalk.dim(`  Depth: ${depth}`));
      console.log(chalk.dim(`  Total chunks: ${allChunks.length}`));
      console.log(chalk.dim(`  Pages indexed:`));
      for (const doc of documents.slice(0, 5)) {
        console.log(chalk.dim(`    - ${doc.title}`));
      }
      if (documents.length > 5) {
        console.log(chalk.dim(`    ... and ${documents.length - 5} more`));
      }
      
      storage.close();
    } catch (error) {
      spinner.fail(chalk.red('Failed to index document'));
      console.error(error);
    }
  });

// Ask command
program
  .command('ask <question>')
  .description('Ask a question about indexed documentation')
  .option('-k, --top-k <number>', 'Number of relevant chunks to retrieve', '5')
  .option('-v, --verbose', 'Show sources and confidence')
  .action(async (question: string, options) => {
    const config = loadConfig();

    ensureDirectories();
    const spinner = ora('Searching...').start();

    try {
      const embeddingService = new LocalEmbeddingService(config);
      const storage = new Storage(embeddingService, true);
      await storage.init();
      const llm = new LLMService(config);

      // Hybrid search
      spinner.text = 'Searching relevant content...';
      const results = await storage.hybridSearch(question, parseInt(options.topK) || config.topK);

      if (results.length === 0) {
        spinner.warn(chalk.yellow('No relevant content found in indexed documents.'));
        console.log(chalk.dim('Try adding some documentation first: docagent add <url>'));
        storage.close();
        return;
      }

      // Build context
      const context = results
        .map((r, i) => `[${i + 1}] ${r.chunk.content}`)
        .join('\n\n---\n\n');

      // Generate answer
      spinner.text = 'Generating answer...';
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

      spinner.stop();

      // Output answer
      console.log('\n' + chalk.bold('Answer:'));
      console.log(answer);

      if (options.verbose || confidence === 'low') {
        console.log('\n' + chalk.bold('Sources:'));
        results.forEach((r, i) => {
          console.log(chalk.dim(`  [${i + 1}] ${r.chunk.title}`));
          console.log(chalk.dim(`      ${r.chunk.sourceUrl}`));
          console.log(chalk.dim(`      Score: ${r.score.toFixed(3)}`));
        });

        console.log('\n' + chalk.bold('Confidence: ') + 
          (confidence === 'high' ? chalk.green(confidence) :
           confidence === 'medium' ? chalk.yellow(confidence) :
           chalk.red(confidence)));

        if (confidence === 'low') {
          console.log(chalk.yellow('\n⚠️  Low confidence: The answer may not be accurate. Consider verifying with sources.'));
        }
      }

      storage.close();
    } catch (error) {
      spinner.fail(chalk.red('Failed to answer question'));
      console.error(error);
    }
  });

// List command
program
  .command('list')
  .description('List all indexed documents')
  .action(async () => {
    ensureDirectories();
    const config = loadConfig();

    const embeddingService = new LocalEmbeddingService(config);
    const storage = new Storage(embeddingService, true);
    await storage.init();

    const documents = storage.listDocuments();

    if (documents.length === 0) {
      console.log(chalk.yellow('No documents indexed yet.'));
      console.log(chalk.dim('Add a document: docagent add <url>'));
      storage.close();
      return;
    }

    console.log(chalk.bold(`\nIndexed Documents (${documents.length}):\n`));
    documents.forEach((doc, i) => {
      console.log(chalk.cyan(`${i + 1}. ${doc.title}`));
      console.log(chalk.dim(`   URL: ${doc.url}`));
      console.log(chalk.dim(`   Updated: ${new Date(doc.updatedAt).toLocaleString()}`));
    });

    storage.close();
  });

// Update command
program
  .command('update [url]')
  .description('Update index for a specific URL or all documents')
  .action(async (url?: string) => {
    const config = loadConfig();

    ensureDirectories();
    const embeddingService = new LocalEmbeddingService(config);
    const storage = new Storage(embeddingService, true);
    await storage.init();
    const crawler = new Crawler();
    const chunker = new Chunker(config);

    const documents = url 
      ? [storage.getDocumentByUrl(url)].filter(Boolean) as Document[]
      : storage.listDocuments();

    if (documents.length === 0) {
      console.log(chalk.yellow('No documents to update.'));
      storage.close();
      return;
    }

    console.log(chalk.bold(`\nUpdating ${documents.length} document(s)...\n`));

    for (const doc of documents) {
      const spinner = ora(`Updating ${doc.title}...`).start();
      
      try {
        const crawlResult = await crawler.crawl(doc.url);
        
        const document: Document = {
          ...doc,
          title: crawlResult.title,
          content: crawlResult.content,
          markdown: crawlResult.markdown,
          updatedAt: Date.now(),
        };

        const chunks = chunker.chunkText(
          crawlResult.markdown,
          document.id,
          document.url,
          document.title
        );

        storage.addDocument(document);
        await storage.addChunks(chunks);

        spinner.succeed(chalk.green(`Updated: ${document.title}`));
      } catch (error) {
        spinner.fail(chalk.red(`Failed to update: ${doc.title}`));
        console.error(error);
      }
    }

    storage.close();
  });

// Delete command
program
  .command('delete <url>')
  .description('Delete a document and its chunks from the index')
  .action(async (url: string) => {
    ensureDirectories();
    const config = loadConfig();
    const embeddingService = new LocalEmbeddingService(config);
    const storage = new Storage(embeddingService, true);
    await storage.init();

    const doc = storage.getDocumentByUrl(url);
    
    if (!doc) {
      console.log(chalk.yellow('Document not found.'));
      storage.close();
      return;
    }

    storage.deleteDocument(doc.id);
    console.log(chalk.green(`Deleted: ${doc.title}`));
    console.log(chalk.dim(`  URL: ${url}`));
    
    storage.close();
  });

// UI command
program
  .command('ui')
  .description('Start the web UI server')
  .option('-p, --port <number>', 'Port to listen on', '3000')
  .action(async (options) => {
    const port = parseInt(options.port) || 3000;
    console.log(chalk.cyan(`\nStarting DocAgent Web UI...\n`));
    
    try {
      const { startServer } = await import('../server');
      await startServer(port);
    } catch (error) {
      console.error(chalk.red('Failed to start server:'), error);
      process.exit(1);
    }
  });

program.parse();