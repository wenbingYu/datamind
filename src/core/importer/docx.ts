import * as path from 'path';
import * as fs from 'fs';
import ora from 'ora';
import { ColumnMeta, TableMeta } from '../../types';
import { executeSQL, tableExists, getTableMeta } from '../engine/duckdb';
import { indexTableSchema } from '../engine/lancedb';
import { lemmatize, detectPhrases } from '../nlp/lemmatizer';

// mammoth does not ship type declarations
const mammoth = require('mammoth');

/**
 * 验证表名，允许中文、字母、数字、下划线
 */
function validateTableName(name: string): string {
  const sanitized = name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9_]/g, '_');
  if (sanitized.length === 0) {
    throw new Error('无效的表名');
  }
  return sanitized;
}

/**
 * 从 Word 文档中提取纯文本
 */
async function extractTextFromDocx(filePath: string): Promise<string> {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`文件不存在: ${absolutePath}`);
  }
  const result = await mammoth.extractRawText({ path: absolutePath });
  return result.value as string;
}

/**
 * 将文本拆分为段落
 */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

/**
 * 从段落中提取英文单词（保留位置信息）
 */
function tokenizeWords(paragraph: string): { word: string; position: number }[] {
  const tokens: { word: string; position: number }[] = [];
  const regex = /[a-zA-Z]+/g;
  let match: RegExpExecArray | null;
  let position = 0;

  while ((match = regex.exec(paragraph)) !== null) {
    tokens.push({
      word: match[0].toLowerCase(),
      position: position
    });
    position++;
  }

  return tokens;
}

/**
 * 导入 Word (.docx) 文件
 *
 * 为每个文档创建两张 DuckDB 表：
 *   1. {name}_paragraphs  — 段落级别（paragraph_id, text, word_count）
 *   2. {name}_words       — 单词级别（word_id, word, paragraph_id, position）
 *
 * @param filePath  .docx 文件路径
 * @param tableName 可选的基础表名（不指定则使用文件名）
 * @returns 导入的表元数据数组
 */
export async function importDocx(
  filePath: string,
  tableName?: string
): Promise<TableMeta[]> {
  const baseName = validateTableName(
    tableName || path.basename(filePath, path.extname(filePath))
  );
  const paraTableName = `${baseName}_paragraphs`;
  const wordsTableName = `${baseName}_words`;

  // 1. 提取文本
  const spinner = ora(`正在解析 Word 文档...`).start();
  const fullText = await extractTextFromDocx(filePath);
  const paragraphs = splitParagraphs(fullText);

  if (paragraphs.length === 0) {
    spinner.fail('Word 文档内容为空');
    throw new Error('Word 文档内容为空');
  }

  spinner.text = `解析完成，共 ${paragraphs.length} 个段落，正在创建表...`;

  // 2. 如果表已存在则先删除
  if (await tableExists(paraTableName)) {
    await executeSQL(`DROP TABLE "${paraTableName}"`);
  }
  if (await tableExists(wordsTableName)) {
    await executeSQL(`DROP TABLE "${wordsTableName}"`);
  }

  // 3. 创建段落表
  await executeSQL(`CREATE TABLE "${paraTableName}" (
    "paragraph_id" INTEGER,
    "text" VARCHAR,
    "word_count" INTEGER
  )`);

  // 4. 创建单词表（含 lemma 列用于词形归一匹配）
  await executeSQL(`CREATE TABLE "${wordsTableName}" (
    "word_id" INTEGER,
    "word" VARCHAR,
    "lemma" VARCHAR,
    "paragraph_id" INTEGER,
    "position" INTEGER
  )`);

  // 5. 填充数据
  let totalWords = 0;
  let wordId = 0;
  const BATCH_SIZE = 500;

  // --- 插入段落 ---
  const paraBatches = Math.ceil(paragraphs.length / BATCH_SIZE);
  for (let b = 0; b < paraBatches; b++) {
    const start = b * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, paragraphs.length);
    const batch = paragraphs.slice(start, end);

    const valueRows = batch.map((para, i) => {
      const idx = start + i;
      const words = (para.match(/[a-zA-Z]+/g) || []);
      return `(${idx}, '${para.replace(/'/g, "''")}', ${words.length})`;
    });

    await executeSQL(
      `INSERT INTO "${paraTableName}" VALUES ${valueRows.join(', ')}`
    );

    spinner.text = `导入段落... ${Math.round(((b + 1) / paraBatches) * 100)}%`;
  }

  // --- 插入单词 ---
  let wordRows: string[] = [];
  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const tokens = tokenizeWords(paragraphs[pIdx]);
    const wordList = tokens.map(t => t.word);

    // 多词短语检测（如 "artificial intelligence" → lemma "ai"）
    const phraseResults = detectPhrases(wordList);

    for (let ti = 0; ti < tokens.length; ti++) {
      const tok = tokens[ti];
      const pr = phraseResults[ti];

      // 短语续词标记为 phraseSkip，不插入为独立单词行
      if (pr.phraseSkip) continue;

      // 如果短语检测已匹配到缩写，直接用缩写作为 lemma；否则走常规 lemmatize
      const lem = pr.lemma !== tok.word ? pr.lemma : lemmatize(tok.word);

      wordRows.push(
        `(${wordId}, '${tok.word.replace(/'/g, "''")}', '${lem.replace(/'/g, "''")}', ${pIdx}, ${tok.position})`
      );
      wordId++;
      totalWords++;

      if (wordRows.length >= BATCH_SIZE) {
        await executeSQL(
          `INSERT INTO "${wordsTableName}" VALUES ${wordRows.join(', ')}`
        );
        wordRows = [];
        spinner.text = `导入单词... ${totalWords} 个`;
      }
    }
  }

  // 插入剩余单词
  if (wordRows.length > 0) {
    await executeSQL(
      `INSERT INTO "${wordsTableName}" VALUES ${wordRows.join(', ')}`
    );
  }

  spinner.succeed(
    `Word 文档导入完成：${paragraphs.length} 段落，${totalWords} 个单词`
  );

  // 6. 获取元数据并建立 LanceDB 索引
  const metas: TableMeta[] = [];

  for (const tblName of [paraTableName, wordsTableName]) {
    const meta = await getTableMeta(tblName);
    if (meta) {
      try {
        await indexTableSchema(meta.name, meta.columns);
      } catch {
        // 忽略索引错误
      }
      metas.push(meta);
    }
  }

  return metas;
}
