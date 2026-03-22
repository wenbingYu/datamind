import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { CrawlResult } from '../types';

export class Crawler {
  private turndown: TurndownService;
  private userAgent: string;
  private timeout: number;

  constructor(options?: { timeout?: number; userAgent?: string }) {
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });
    this.timeout = options?.timeout || 30000;
    this.userAgent = options?.userAgent || 'DocAgent/1.0 (Knowledge Base Crawler)';
  }

  async crawl(url: string): Promise<CrawlResult> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      timeout: this.timeout,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $('script, style, nav, header, footer, aside, .sidebar, .navigation, .menu').remove();

    // Get title
    const title = $('title').text().trim() || 
                 $('h1').first().text().trim() || 
                 url;

    // Get main content
    const mainContent = $('main, article, .content, .main, #content, #main').first();
    const contentElement = mainContent.length > 0 ? mainContent : $('body');
    
    const content = contentElement.text().replace(/\s+/g, ' ').trim();
    const markdown = this.turndown.turndown(contentElement.html() || '');

    // Extract links for potential recursive crawling
    const links: string[] = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        try {
          const absoluteUrl = new URL(href, url).href;
          // Only include same-origin links
          if (new URL(absoluteUrl).origin === new URL(url).origin) {
            links.push(absoluteUrl);
          }
        } catch {
          // Invalid URL, skip
        }
      }
    });

    return {
      url,
      title,
      content,
      markdown,
      links: [...new Set(links)],
    };
  }

  /**
   * Crawl recursively with BFS up to specified depth
   */
  async crawlRecursive(
    startUrl: string, 
    maxDepth: number = 1,
    onProgress?: (current: number, total: number, url: string) => void
  ): Promise<CrawlResult[]> {
    const visited = new Set<string>();
    const results: CrawlResult[] = [];
    const queue: Array<{ url: string; depth: number }> = [{ url: startUrl, depth: 0 }];
    
    // Normalize start URL
    const baseUrl = new URL(startUrl);
    const baseOrigin = baseUrl.origin;

    while (queue.length > 0) {
      const { url: currentUrl, depth } = queue.shift()!;
      
      // Skip if already visited
      if (visited.has(currentUrl)) {
        continue;
      }
      
      visited.add(currentUrl);
      
      // Skip if beyond max depth
      if (depth > maxDepth) {
        continue;
      }

      try {
        if (onProgress) {
          onProgress(visited.size, visited.size + queue.length, currentUrl);
        }

        const result = await this.crawl(currentUrl);
        results.push(result);

        // Add links to queue if we haven't reached max depth
        if (depth < maxDepth) {
          for (const link of result.links) {
            if (!visited.has(link)) {
              try {
                const linkUrl = new URL(link);
                // Only follow same-origin links
                if (linkUrl.origin === baseOrigin) {
                  // Skip common non-content paths
                  const skipPatterns = [
                    /\.(pdf|zip|tar|gz|png|jpg|jpeg|gif|svg|ico|mp4|mp3|avi|mov)$/i,
                    /\/(api|login|logout|register|signup|signin|admin|search|tag|tags|category|categories)\//i,
                    /\?/, // Skip URLs with query params to avoid duplicates
                    /#/, // Skip anchor links
                  ];
                  
                  const shouldSkip = skipPatterns.some(pattern => pattern.test(link));
                  if (!shouldSkip) {
                    queue.push({ url: link, depth: depth + 1 });
                  }
                }
              } catch {
                // Invalid URL, skip
              }
            }
          }
        }

        // Be polite - add delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        // Log error but continue with other URLs
        console.error(`Failed to crawl ${currentUrl}:`, error instanceof Error ? error.message : error);
      }
    }

    return results;
  }

  async crawlMultiple(urls: string[], concurrency: number = 3): Promise<CrawlResult[]> {
    const results: CrawlResult[] = [];
    
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(url => this.crawl(url))
      );
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      }
      
      // Be polite, add delay between batches
      if (i + concurrency < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }
}