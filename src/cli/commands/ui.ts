import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import chalk from 'chalk';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { getAllTablesMeta, executeSQL, executeSQLWithTime, getTableMeta, dropTable, exportTableToCSV } from '../../core/engine/duckdb';
import { getLLMClient } from '../../core/llm/client';
import { SQLBuilder } from '../../core/llm/sql-builder';
import { getConfig, validateConfig } from '../../utils/config';
import { analyzeTable } from '../../core/analyzer/insights';
import { indexTableSchema, recommendTables } from '../../core/engine/lancedb';
import { importCSV } from '../../core/importer/csv';

const PORT = 3000;

// Configure multer for file uploads
const upload = multer({ 
  dest: os.tmpdir(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

export async function uiCommand(port: number = PORT): Promise<void> {
  const app = express();
  
  // 中间件
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  
  // 静态文件
  app.use(express.static(path.join(__dirname, '../../ui/public')));
  
  // API 路由
  const api = express.Router();
  
  // GET /api/tables - 获取表列表
  api.get('/tables', async (req, res) => {
    try {
      const tables = await getAllTablesMeta();
      res.json({
        success: true,
        data: tables.map(t => ({
          name: t.name,
          rowCount: t.rowCount,
          columns: t.columns.map(c => ({
            name: c.name,
            type: c.type,
            sampleValues: c.sampleValues.slice(0, 3)
          })),
          createdAt: t.createdAt,
          updatedAt: t.updatedAt
        }))
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // POST /api/import - 导入数据
  api.post('/import', async (req, res) => {
    try {
      const { file, data, name } = req.body;
      
      // 支持直接上传 CSV 数据
      if (data && name) {
        // 写入临时文件
        const tempPath = path.join('/tmp', `${name}_${Date.now()}.csv`);
        fs.writeFileSync(tempPath, data);
        
        const meta = await importCSV(tempPath);
        
        // 建立索引
        await indexTableSchema(meta.name, meta.columns);
        
        // 删除临时文件
        fs.unlinkSync(tempPath);
        
        res.json({
          success: true,
          data: {
            name: meta.name,
            rowCount: meta.rowCount,
            columns: meta.columns.length
          }
        });
      } else if (file) {
        const meta = await importCSV(file);
        await indexTableSchema(meta.name, meta.columns);
        
        res.json({
          success: true,
          data: {
            name: meta.name,
            rowCount: meta.rowCount,
            columns: meta.columns.length
          }
        });
      } else {
        res.status(400).json({
          success: false,
          error: '请提供 file 或 data 参数'
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // POST /api/upload - 上传文件（form-data）
  api.post('/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: '请选择文件'
        });
      }
      
      const originalName = req.file.originalname;
      const tempPath = req.file.path;
      
      // 检查文件类型
      if (!originalName.match(/\.(csv|xlsx|xls)$/i)) {
        fs.unlinkSync(tempPath);
        return res.status(400).json({
          success: false,
          error: '只支持 CSV、XLSX、XLS 格式'
        });
      }
      
      const name = originalName.replace(/\.(csv|xlsx|xls)$/i, '');
      const meta = await importCSV(tempPath);
      
      // 建立索引
      await indexTableSchema(meta.name, meta.columns);
      
      // 删除临时文件
      fs.unlinkSync(tempPath);
      
      res.json({
        success: true,
        data: {
          name: meta.name,
          id: meta.name,
          rowCount: meta.rowCount,
          columns: meta.columns.length
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // POST /api/chat - 对话式查询
  api.post('/chat', async (req, res) => {
    try {
      const { messages, files } = req.body;
      
      if (!messages || messages.length === 0) {
        return res.status(400).json({
          success: false,
          error: '请提供消息'
        });
      }
      
      const config = getConfig();
      
      // 验证 API Key 配置
      try {
        validateConfig(config);
      } catch {
        return res.status(400).json({
          success: false,
          error: '未配置 API Key，请设置 DATAMIND_API_KEY 或 ZHIPU_API_KEY 环境变量'
        });
      }
      
      // 获取最后一条用户消息
      const lastMessage = messages.filter((m: any) => m.role === 'user').pop();
      const question = lastMessage?.content || '';
      
      if (!question) {
        return res.json({
          success: true,
          data: {
            message: '请输入您的问题',
            sql: '',
            columns: [],
            rows: [],
            rowCount: 0
          }
        });
      }
      
      // 获取表
      let tables = await getAllTablesMeta();
      
      if (tables.length === 0) {
        return res.json({
          success: true,
          data: {
            message: '暂无数据表，请先上传数据文件',
            sql: '',
            columns: [],
            rows: [],
            rowCount: 0
          }
        });
      }
      
      // 使用向量索引推荐表
      const recommended = await recommendTables(question);
      if (recommended.length > 0) {
        tables = tables.filter(t => recommended.includes(t.name));
        if (tables.length === 0) {
          tables = await getAllTablesMeta();
        }
      }
      
      // 生成 SQL
      const client = getLLMClient(config);
      const builder = new SQLBuilder(client);
      const sql = await builder.generateSQL(question, tables);
      
      // 执行查询
      const { rows, time } = await executeSQLWithTime(sql);
      
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      
      // 生成分析摘要
      let message = generateSummary(question, rows, columns);
      
      res.json({
        success: true,
        data: {
          message,
          sql,
          columns,
          rows: rows.slice(0, 1000),
          rowCount: rows.length,
          executionTime: time
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // POST /api/ask - 查询数据
  api.post('/ask', async (req, res) => {
    try {
      const { question, table } = req.body;
      
      if (!question) {
        return res.status(400).json({
          success: false,
          error: '请提供 question 参数'
        });
      }
      
      const config = getConfig();
      
      // 验证 API Key 配置
      try {
        validateConfig(config);
      } catch {
        return res.status(400).json({
          success: false,
          error: '未配置 API Key，请设置 DATAMIND_API_KEY 或 ZHIPU_API_KEY 环境变量'
        });
      }
      
      // 获取表
      let tables = await getAllTablesMeta();
      
      if (tables.length === 0) {
        return res.json({
          success: true,
          data: {
            sql: '',
            columns: [],
            rows: [],
            rowCount: 0,
            message: '暂无数据表，请先导入数据'
          }
        });
      }
      
      // 如果指定了表
      if (table) {
        tables = tables.filter(t => t.name.toLowerCase() === table.toLowerCase());
      } else {
        // 使用向量索引推荐表
        const recommended = await recommendTables(question);
        if (recommended.length > 0) {
          tables = tables.filter(t => recommended.includes(t.name));
          if (tables.length === 0) {
            tables = await getAllTablesMeta();
          }
        }
      }
      
      // 生成 SQL
      const client = getLLMClient(config);
      const builder = new SQLBuilder(client);
      const sql = await builder.generateSQL(question, tables);
      
      // 执行查询
      const { rows, time } = await executeSQLWithTime(sql);
      
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      
      res.json({
        success: true,
        data: {
          sql,
          columns,
          rows: rows.slice(0, 1000),
          rowCount: rows.length,
          executionTime: time
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // GET /api/analyze/:table - 分析表
  api.get('/analyze/:table', async (req, res) => {
    try {
      const { table } = req.params;
      const result = await analyzeTable(table);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // POST /api/query - 直接执行 SQL
  api.post('/query', async (req, res) => {
    try {
      const { sql } = req.body;
      
      if (!sql) {
        return res.status(400).json({
          success: false,
          error: '请提供 sql 参数'
        });
      }
      
      const { rows, time } = await executeSQLWithTime(sql);
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      
      res.json({
        success: true,
        data: {
          sql,
          columns,
          rows: rows.slice(0, 1000),
          rowCount: rows.length,
          executionTime: time
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // GET /api/schema/:table - 获取表结构
  api.get('/schema/:table', async (req, res) => {
    try {
      const { table } = req.params;
      const meta = await getTableMeta(table);
      
      if (!meta) {
        return res.status(404).json({
          success: false,
          error: `表 "${table}" 不存在`
        });
      }
      
      res.json({
        success: true,
        data: meta
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // GET /api/export/:table - 导出表数据
  api.get('/export/:table', async (req, res) => {
    try {
      const { table } = req.params;
      const csv = await exportTableToCSV(table);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${table}.csv"`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // DELETE /api/tables/:table - 删除表
  api.delete('/tables/:table', async (req, res) => {
    try {
      const { table } = req.params;
      
      // 检查表是否存在
      const meta = await getTableMeta(table);
      if (!meta) {
        return res.status(404).json({
          success: false,
          error: `表 "${table}" 不存在`
        });
      }
      
      await dropTable(table);
      
      res.json({
        success: true,
        message: `表 "${table}" 已删除`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  app.use('/api', api);
  
  // 前端路由 - 返回 index.html
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../ui/public/index.html'));
  });
  
  // 启动服务器
  const server = app.listen(port, () => {
    console.log();
    console.log(chalk.cyan.bold('  🚀 DataMind UI'));
    console.log();
    console.log(chalk.white(`  本地访问: `) + chalk.green(`http://localhost:${port}`));
    console.log();
    console.log(chalk.dim('  API 端点:'));
    console.log(chalk.dim(`    GET  /api/tables        获取表列表`));
    console.log(chalk.dim(`    POST /api/import        导入数据`));
    console.log(chalk.dim(`    POST /api/upload        上传文件`));
    console.log(chalk.dim(`    POST /api/chat          对话式查询`));
    console.log(chalk.dim(`    POST /api/ask           自然语言查询`));
    console.log(chalk.dim(`    POST /api/query         执行 SQL`));
    console.log(chalk.dim(`    GET  /api/analyze/:table 分析表`));
    console.log(chalk.dim(`    GET  /api/schema/:table  获取表结构`));
    console.log();
    console.log(chalk.yellow('  按 Ctrl+C 停止服务'));
    console.log();
  });
  
  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(chalk.red(`端口 ${port} 已被占用，请使用其他端口`));
      console.log(chalk.dim(`尝试: datamind ui --port ${port + 1}`));
      process.exit(1);
    } else {
      console.error(chalk.red(err.message));
      process.exit(1);
    }
  });
  
  // 优雅关闭
  process.on('SIGINT', () => {
    console.log(chalk.dim('\n正在关闭服务...'));
    server.close(() => {
      console.log(chalk.green('服务已关闭'));
      process.exit(0);
    });
  });
}

// Generate summary for chat response
function generateSummary(question: string, rows: any[], columns: string[]): string {
  if (rows.length === 0) {
    return '查询未返回任何结果，可能没有符合条件的数据。';
  }
  
  const questionLower = question.toLowerCase();
  
  // Check for top N queries
  const topMatch = questionLower.match(/top\s*(\d+)|前\s*(\d+)|(\d+)\s*(个|条|名)/);
  if (topMatch) {
    const n = parseInt(topMatch[1] || topMatch[2] || topMatch[3]) || 10;
    return `查询返回了 ${rows.length} 条数据。以下是排名前 ${Math.min(n, rows.length)} 的结果：`;
  }
  
  // Check for aggregation queries
  if (questionLower.includes('总') || questionLower.includes('合计') || questionLower.includes('sum') || questionLower.includes('count')) {
    if (rows.length === 1 && columns.length <= 3) {
      const values = columns.map(c => `${c}: ${rows[0][c]}`).join(', ');
      return `统计结果：${values}`;
    }
    return `统计查询返回 ${rows.length} 条结果。`;
  }
  
  // Check for average queries
  if (questionLower.includes('平均') || questionLower.includes('avg')) {
    if (rows.length === 1 && columns.length <= 3) {
      const values = columns.map(c => `${c}: ${rows[0][c]}`).join(', ');
      return `平均统计结果：${values}`;
    }
    return `查询返回 ${rows.length} 条结果。`;
  }
  
  // Check for max/min queries
  if (questionLower.includes('最高') || questionLower.includes('最大') || questionLower.includes('max') ||
      questionLower.includes('最低') || questionLower.includes('最小') || questionLower.includes('min')) {
    if (rows.length === 1) {
      return `查询结果：${columns.map(c => `${c}: ${rows[0][c]}`).join(', ')}`;
    }
    return `查询返回 ${rows.length} 条结果。`;
  }
  
  // Default summary
  if (rows.length <= 5) {
    return `查询返回 ${rows.length} 条数据。`;
  }
  return `查询返回 ${rows.length} 条数据，以下是部分结果：`;
}