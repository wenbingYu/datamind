/**
 * DataMind API Server
 * 增强版 API 服务，支持认证、限流和高级分析功能
 */

import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';
import chalk from 'chalk';
import express, { Request, Response, NextFunction, Router } from 'express';
import cors from 'cors';
import multer from 'multer';
import { getAllTablesMeta, executeSQL, executeSQLWithTime, getTableMeta, dropTable, exportTableToCSV } from '../core/engine/duckdb';
import { getLLMClient } from '../core/llm/client';
import { SQLBuilder } from '../core/llm/sql-builder';
import { getConfig, validateConfig } from '../utils/config';
import { analyzeTable } from '../core/analyzer/insights';
import { indexTableSchema, recommendTables } from '../core/engine/lancedb';
import { importCSV } from '../core/importer/csv';
import {
  createAPIKey,
  listAPIKeys,
  revokeAPIKey,
  deleteAPIKey,
  getAPIKeyInfo,
  PlanType,
  PLAN_QUOTAS,
  APIKeyInfo
} from './apikeys';
import { checkRateLimit, getRateLimitStatus } from './rate-limit';
import {
  optionalAuth,
  requireAuth,
  rateLimitMiddleware,
  adminAuth
} from './auth';

/**
 * 将对象中的 BigInt 转换为 Number
 * 用于 JSON 序列化
 */
function sanitizeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeBigInt);
  if (typeof obj === 'object') {
    const result: any = {};
    for (const key of Object.keys(obj)) {
      result[key] = sanitizeBigInt(obj[key]);
    }
    return result;
  }
  return obj;
}

// 配置 multer 用于文件上传
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB 限制
});

// 扩展 Request 类型
declare global {
  namespace Express {
    interface Request {
      apiKey?: APIKeyInfo;
      rateLimit?: {
        allowed: boolean;
        limit: { minute: number; day: number };
        remaining: { minute: number; day: number };
        resetAt: { minute: number; day: number };
      };
    }
  }
}

// Server 配置
export interface ServerOptions {
  port?: number;
  auth?: boolean;  // 是否启用认证
  host?: string;
}

// 存储活跃的查询会话
const activeQueries = new Map<string, { sql: string; startTime: number }>();

/**
 * 创建 Express 应用
 */
export function createApp(options: ServerOptions = {}): express.Application {
  const { auth = false } = options;
  
  const app = express();
  
  // 中间件
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  
  // 前端路由（放在静态文件之前）
  // 首页 - 产品官网
  app.get('/', (req, res) => {
    const landingPath = path.resolve(__dirname, 'public', 'landing.html');
    fs.readFile(landingPath, 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading landing.html:', err);
        res.status(500).send('Error loading page');
      } else {
        res.setHeader('Content-Type', 'text/html');
        res.send(data);
      }
    });
  });
  
  // 应用入口 - 聊天界面
  app.get('/app', (req, res) => {
    const indexPath = path.resolve(__dirname, 'public', 'index.html');
    fs.readFile(indexPath, 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading index.html:', err);
        res.status(500).send('Error loading page');
      } else {
        res.setHeader('Content-Type', 'text/html');
        res.send(data);
      }
    });
  });
  
  // 静态文件
  app.use(express.static(path.join(__dirname, 'public')));
  
  // 健康检查端点
  app.get('/api/health', (req, res) => {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: Date.now(),
      version: '1.1.1'
    });
  });
  
  // API 路由
  const api = Router();
  
  // 根据配置决定认证策略
  if (auth) {
    api.use(requireAuth);
    api.use(rateLimitMiddleware);
  } else {
    api.use(optionalAuth);
    api.use(rateLimitMiddleware);
  }
  
  // ================== 数据表 API ==================
  
  // GET /api/tables - 获取表列表
  api.get('/tables', async (req, res) => {
    try {
      const tables = await getAllTablesMeta();
      res.json({
        success: true,
        data: sanitizeBigInt(tables.map(t => ({
          name: t.name,
          rowCount: t.rowCount,
          columns: t.columns.map(c => ({
            name: c.name,
            type: c.type,
            sampleValues: c.sampleValues.slice(0, 3)
          })),
          createdAt: t.createdAt,
          updatedAt: t.updatedAt
        })))
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // POST /api/import - 导入数据（JSON）
  api.post('/import', async (req, res) => {
    try {
      const { file, data, name } = req.body;
      
      if (data && name) {
        const tempPath = path.join('/tmp', `${name}_${Date.now()}.csv`);
        fs.writeFileSync(tempPath, data);
        
        const meta = await importCSV(tempPath);
        await indexTableSchema(meta.name, meta.columns);
        fs.unlinkSync(tempPath);
        
        res.json({
          success: true,
          data: sanitizeBigInt({
            name: meta.name,
            rowCount: meta.rowCount,
            columns: meta.columns.length
          })
        });
      } else if (file) {
        const meta = await importCSV(file);
        await indexTableSchema(meta.name, meta.columns);
        
        res.json({
          success: true,
          data: sanitizeBigInt({
            name: meta.name,
            rowCount: meta.rowCount,
            columns: meta.columns.length
          })
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
      
      if (!originalName.match(/\.(csv|xlsx|xls)$/i)) {
        fs.unlinkSync(tempPath);
        return res.status(400).json({
          success: false,
          error: '只支持 CSV、XLSX、XLS 格式'
        });
      }
      
      const meta = await importCSV(tempPath);
      await indexTableSchema(meta.name, meta.columns);
      fs.unlinkSync(tempPath);
      
      res.json({
        success: true,
        data: sanitizeBigInt({
          name: meta.name,
          id: meta.name,
          rowCount: meta.rowCount,
          columns: meta.columns.length
        })
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // POST /api/ask - 自然语言查询
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
      
      try {
        validateConfig(config);
      } catch {
        return res.status(400).json({
          success: false,
          error: '未配置 API Key，请设置 DATAMIND_API_KEY 或 ZHIPU_API_KEY 环境变量'
        });
      }
      
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
      
      if (table) {
        tables = tables.filter(t => t.name.toLowerCase() === table.toLowerCase());
      } else {
        const recommended = await recommendTables(question);
        if (recommended.length > 0) {
          tables = tables.filter(t => recommended.includes(t.name));
          if (tables.length === 0) {
            tables = await getAllTablesMeta();
          }
        }
      }
      
      const client = getLLMClient(config);
      const builder = new SQLBuilder(client);
      const sql = await builder.generateSQL(question, tables);
      
      const { rows, time } = await executeSQLWithTime(sql);
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      
      res.json({
        success: true,
        data: {
          sql,
          columns,
          rows: sanitizeBigInt(rows.slice(0, 1000)),
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
      
      try {
        validateConfig(config);
      } catch {
        return res.status(400).json({
          success: false,
          error: '未配置 API Key，请设置 DATAMIND_API_KEY 或 ZHIPU_API_KEY 环境变量'
        });
      }
      
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
      
      const recommended = await recommendTables(question);
      if (recommended.length > 0) {
        tables = tables.filter(t => recommended.includes(t.name));
        if (tables.length === 0) {
          tables = await getAllTablesMeta();
        }
      }
      
      const client = getLLMClient(config);
      const builder = new SQLBuilder(client);
      const sql = await builder.generateSQL(question, tables);
      
      const { rows, time } = await executeSQLWithTime(sql);
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      const message = generateSummary(question, rows, columns);
      
      res.json({
        success: true,
        data: {
          message,
          sql,
          columns,
          rows: sanitizeBigInt(rows.slice(0, 1000)),
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
  
  // POST /api/query - 执行 SQL
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
          rows: sanitizeBigInt(rows.slice(0, 1000)),
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
        data: sanitizeBigInt(result)
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
        data: sanitizeBigInt(meta)
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
  
  // ================== API Key 管理 API ==================
  
  // POST /api/keys - 创建 API Key (需要管理员权限)
  api.post('/keys', adminAuth, (req, res) => {
    try {
      const { name, plan = 'free' } = req.body;
      
      if (!name) {
        return res.status(400).json({
          success: false,
          error: '请提供 name 参数'
        });
      }
      
      if (!['free', 'pro', 'team'].includes(plan)) {
        return res.status(400).json({
          success: false,
          error: '无效的计划类型，支持: free, pro, team'
        });
      }
      
      const keyInfo = createAPIKey({ name, plan: plan as PlanType });
      
      res.json({
        success: true,
        data: {
          key: keyInfo.key,
          name: keyInfo.name,
          plan: keyInfo.plan,
          quota: PLAN_QUOTAS[keyInfo.plan],
          createdAt: keyInfo.createdAt
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // GET /api/keys - 列出 API Keys (需要管理员权限)
  api.get('/keys', adminAuth, (req, res) => {
    try {
      const includeRevoked = req.query.includeRevoked === 'true';
      const keys = listAPIKeys(includeRevoked);
      
      res.json({
        success: true,
        data: keys.map(k => ({
          key: k.key,
          name: k.name,
          plan: k.plan,
          quota: PLAN_QUOTAS[k.plan],
          createdAt: k.createdAt,
          lastUsedAt: k.lastUsedAt,
          requestCount: k.requestCount,
          revoked: k.revoked,
          revokedAt: k.revokedAt
        }))
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // GET /api/keys/:key - 获取单个 API Key 信息
  api.get('/keys/:key', adminAuth, (req, res) => {
    try {
      const key = req.params.key as string;
      const keyInfo = getAPIKeyInfo(key);
      
      if (!keyInfo) {
        return res.status(404).json({
          success: false,
          error: 'API Key 不存在'
        });
      }
      
      // 获取限流状态
      const rateLimitStatus = getRateLimitStatus(key, keyInfo.plan);
      
      res.json({
        success: true,
        data: {
          key: keyInfo.key,
          name: keyInfo.name,
          plan: keyInfo.plan,
          quota: PLAN_QUOTAS[keyInfo.plan],
          createdAt: keyInfo.createdAt,
          lastUsedAt: keyInfo.lastUsedAt,
          requestCount: keyInfo.requestCount,
          revoked: keyInfo.revoked,
          revokedAt: keyInfo.revokedAt,
          rateLimit: rateLimitStatus
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // DELETE /api/keys/:key - 删除/撤销 API Key
  api.delete('/keys/:key', adminAuth, (req, res) => {
    try {
      const key = req.params.key as string;
      const { revoke } = req.query;
      
      const shouldRevoke = typeof revoke === 'string' && revoke === 'true';
      let success: boolean;
      
      if (shouldRevoke) {
        success = revokeAPIKey(key);
      } else {
        success = deleteAPIKey(key);
      }
      
      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'API Key 不存在'
        });
      }
      
      res.json({
        success: true,
        message: shouldRevoke ? 'API Key 已撤销' : 'API Key 已删除'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // ================== 高级分析 API ==================
  
  // POST /api/chart - 生成图表配置
  api.post('/chart', async (req, res) => {
    try {
      const { sql, table, chartType = 'bar', options = {} } = req.body;
      
      // 获取数据
      let data: any[] = [];
      let columns: string[] = [];
      
      if (sql) {
        const result = await executeSQL(sql);
        data = result;
        columns = data.length > 0 ? Object.keys(data[0]) : [];
      } else if (table) {
        const meta = await getTableMeta(table);
        if (!meta) {
          return res.status(404).json({
            success: false,
            error: `表 "${table}" 不存在`
          });
        }
        const result = await executeSQL(`SELECT * FROM ${table} LIMIT 1000`);
        data = result;
        columns = meta.columns.map(c => c.name);
      } else {
        return res.status(400).json({
          success: false,
          error: '请提供 sql 或 table 参数'
        });
      }
      
      if (data.length === 0) {
        return res.json({
          success: true,
          data: {
            chartType,
            columns,
            data: [],
            config: null,
            message: '没有数据'
          }
        });
      }
      
      // 生成图表配置
      const config = generateChartConfig(data, columns, chartType, options);
      
      res.json({
        success: true,
        data: {
          chartType,
          columns,
          data: sanitizeBigInt(data.slice(0, 100)),
          rowCount: data.length,
          config
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // POST /api/forecast - 时间序列预测
  api.post('/forecast', async (req, res) => {
    try {
      const { table, timeColumn, valueColumn, periods = 7 } = req.body;
      
      if (!table || !timeColumn || !valueColumn) {
        return res.status(400).json({
          success: false,
          error: '请提供 table, timeColumn, valueColumn 参数'
        });
      }
      
      // 获取时间序列数据
      const sql = `
        SELECT ${timeColumn}, ${valueColumn}
        FROM ${table}
        ORDER BY ${timeColumn}
      `;
      const data = await executeSQL(sql);
      
      if (data.length < 10) {
        return res.status(400).json({
          success: false,
          error: '数据点太少，至少需要10个数据点进行预测'
        });
      }
      
      // 简单移动平均预测
      const values = data.map((d: any) => Number(d[valueColumn]) || 0);
      const lastValues = values.slice(-Math.min(7, values.length));
      const avg = lastValues.reduce((a: number, b: number) => a + b, 0) / lastValues.length;
      
      // 计算趋势
      const firstHalf = values.slice(0, Math.floor(values.length / 2));
      const secondHalf = values.slice(Math.floor(values.length / 2));
      const firstAvg = firstHalf.reduce((a: number, b: number) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a: number, b: number) => a + b, 0) / secondHalf.length;
      const trend = (secondAvg - firstAvg) / (values.length / 2);
      
      // 生成预测
      const lastTime = new Date(data[data.length - 1][timeColumn]);
      const forecasts = [];
      
      for (let i = 1; i <= periods; i++) {
        const forecastTime = new Date(lastTime);
        forecastTime.setDate(forecastTime.getDate() + i);
        
        forecasts.push({
          [timeColumn]: forecastTime.toISOString().split('T')[0],
          [valueColumn]: Math.round((avg + trend * i) * 100) / 100,
          type: 'forecast'
        });
      }
      
      // 计算置信区间（简化版）
      const stdDev = Math.sqrt(
        values.reduce((sum: number, v: number) => sum + Math.pow(v - avg, 2), 0) / values.length
      );
      
      res.json({
        success: true,
        data: {
          historical: data.slice(-30).map((d: any) => ({ ...d, type: 'historical' })),
          forecast: forecasts,
          statistics: {
            average: Math.round(avg * 100) / 100,
            trend: Math.round(trend * 100) / 100,
            stdDev: Math.round(stdDev * 100) / 100,
            confidence: 0.95
          },
          config: {
            timeColumn,
            valueColumn,
            periods
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // POST /api/anomaly - 异常检测
  api.post('/anomaly', async (req, res) => {
    try {
      const { table, columns, method = 'zscore', threshold = 3 } = req.body;
      
      if (!table) {
        return res.status(400).json({
          success: false,
          error: '请提供 table 参数'
        });
      }
      
      const meta = await getTableMeta(table);
      if (!meta) {
        return res.status(404).json({
          success: false,
          error: `表 "${table}" 不存在`
        });
      }
      
      // 确定要分析的列
      const analyzeColumns = columns || meta.columns
        .filter(c => c.type === 'number')
        .map(c => c.name);
      
      if (analyzeColumns.length === 0) {
        return res.status(400).json({
          success: false,
          error: '没有可分析的数值列'
        });
      }
      
      // 获取数据
      const data = await executeSQL(`SELECT * FROM ${table}`);
      
      // 检测异常
      const anomalies: any[] = [];
      
      for (const col of analyzeColumns.slice(0, 3)) { // 最多分析3列
        const values = data.map((d: any) => Number(d[col]) || 0).filter((v: number) => !isNaN(v));
        
        if (values.length < 10) continue;
        
        const mean = values.reduce((a: number, b: number) => a + b, 0) / values.length;
        const stdDev = Math.sqrt(
          values.reduce((sum: number, v: number) => sum + Math.pow(v - mean, 2), 0) / values.length
        );
        
        // Z-Score 异常检测
        for (let i = 0; i < data.length; i++) {
          const val = Number(data[i][col]);
          if (isNaN(val)) continue;
          
          const zscore = stdDev > 0 ? Math.abs((val - mean) / stdDev) : 0;
          
          if (zscore > threshold) {
            anomalies.push({
              rowIndex: i,
              column: col,
              value: val,
              zscore: Math.round(zscore * 100) / 100,
              mean: Math.round(mean * 100) / 100,
              stdDev: Math.round(stdDev * 100) / 100,
              severity: zscore > threshold * 1.5 ? 'high' : zscore > threshold ? 'medium' : 'low'
            });
          }
        }
      }
      
      res.json({
        success: true,
        data: {
          totalRows: data.length,
          analyzedColumns: analyzeColumns.slice(0, 3),
          anomalyCount: anomalies.length,
          anomalies: anomalies.slice(0, 100),
          summary: {
            high: anomalies.filter(a => a.severity === 'high').length,
            medium: anomalies.filter(a => a.severity === 'medium').length,
            low: anomalies.filter(a => a.severity === 'low').length
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // POST /api/association - 关联分析
  api.post('/association', async (req, res) => {
    try {
      const { table, column1, column2, method = 'correlation' } = req.body;
      
      if (!table || !column1 || !column2) {
        return res.status(400).json({
          success: false,
          error: '请提供 table, column1, column2 参数'
        });
      }
      
      const meta = await getTableMeta(table);
      if (!meta) {
        return res.status(404).json({
          success: false,
          error: `表 "${table}" 不存在`
        });
      }
      
      // 获取数据
      const data = await executeSQL(`SELECT ${column1}, ${column2} FROM ${table}`);
      
      // 提取值
      const pairs = data
        .map((d: any) => [Number(d[column1]), Number(d[column2])])
        .filter(([a, b]) => !isNaN(a) && !isNaN(b));
      
      if (pairs.length < 10) {
        return res.status(400).json({
          success: false,
          error: '有效数据点太少'
        });
      }
      
      // 计算相关系数
      const x = pairs.map(p => p[0]);
      const y = pairs.map(p => p[1]);
      
      const meanX = x.reduce((a, b) => a + b, 0) / x.length;
      const meanY = y.reduce((a, b) => a + b, 0) / y.length;
      
      let sumXY = 0, sumX2 = 0, sumY2 = 0;
      for (let i = 0; i < x.length; i++) {
        const dx = x[i] - meanX;
        const dy = y[i] - meanY;
        sumXY += dx * dy;
        sumX2 += dx * dx;
        sumY2 += dy * dy;
      }
      
      const correlation = sumX2 > 0 && sumY2 > 0 
        ? sumXY / Math.sqrt(sumX2 * sumY2) 
        : 0;
      
      // 线性回归
      const slope = sumX2 > 0 ? sumXY / sumX2 : 0;
      const intercept = meanY - slope * meanX;
      
      // 计算 R²
      let ssTotal = 0, ssRes = 0;
      for (let i = 0; i < x.length; i++) {
        ssTotal += Math.pow(y[i] - meanY, 2);
        ssRes += Math.pow(y[i] - (slope * x[i] + intercept), 2);
      }
      const rSquared = ssTotal > 0 ? 1 - ssRes / ssTotal : 0;
      
      res.json({
        success: true,
        data: {
          column1,
          column2,
          sampleSize: pairs.length,
          correlation: {
            coefficient: Math.round(correlation * 1000) / 1000,
            strength: Math.abs(correlation) > 0.7 ? 'strong' : Math.abs(correlation) > 0.4 ? 'moderate' : 'weak',
            direction: correlation > 0 ? 'positive' : correlation < 0 ? 'negative' : 'none'
          },
          regression: {
            slope: Math.round(slope * 1000) / 1000,
            intercept: Math.round(intercept * 1000) / 1000,
            rSquared: Math.round(rSquared * 1000) / 1000
          },
          statistics: {
            meanX: Math.round(meanX * 100) / 100,
            meanY: Math.round(meanY * 100) / 100,
            stdDevX: Math.round(Math.sqrt(sumX2 / x.length) * 100) / 100,
            stdDevY: Math.round(Math.sqrt(sumY2 / y.length) * 100) / 100
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // 挂载 API 路由
  app.use('/api', api);
  
  // 错误处理
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(chalk.red('Server Error:'), err.message);
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message
    });
  });
  
  return app;
}

/**
 * 启动服务器
 */
export async function startServer(options: ServerOptions = {}): Promise<http.Server> {
  const { port = 3000, host = '0.0.0.0', auth = false } = options;
  
  const app = createApp(options);
  
  const server = app.listen(port, host, () => {
    console.log();
    console.log(chalk.cyan.bold('  🚀 DataMind API Server'));
    console.log();
    console.log(chalk.white(`  本地访问: `) + chalk.green(`http://localhost:${port}`));
    console.log();
    console.log(chalk.dim('  API 端点:'));
    console.log(chalk.dim(`    GET  /api/health           健康检查`));
    console.log(chalk.dim(`    GET  /api/tables           获取表列表`));
    console.log(chalk.dim(`    POST /api/import           导入数据`));
    console.log(chalk.dim(`    POST /api/upload           上传文件`));
    console.log(chalk.dim(`    POST /api/ask              自然语言查询`));
    console.log(chalk.dim(`    POST /api/chat             对话式查询`));
    console.log(chalk.dim(`    POST /api/query            执行 SQL`));
    console.log(chalk.dim(`    GET  /api/analyze/:table   分析表`));
    console.log(chalk.dim(`    POST /api/chart            生成图表`));
    console.log(chalk.dim(`    POST /api/forecast         时间序列预测`));
    console.log(chalk.dim(`    POST /api/anomaly          异常检测`));
    console.log(chalk.dim(`    POST /api/association      关联分析`));
    console.log();
    if (auth) {
      console.log(chalk.yellow('  🔐 认证已启用 - 需要 API Key'));
    } else {
      console.log(chalk.dim('  认证未启用 - 公开访问'));
    }
    console.log();
    console.log(chalk.yellow('  按 Ctrl+C 停止服务'));
    console.log();
  });
  
  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(chalk.red(`端口 ${port} 已被占用，请使用其他端口`));
      console.log(chalk.dim(`尝试: datamind serve --port ${port + 1}`));
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
  
  return server;
}

/**
 * 生成图表配置
 */
function generateChartConfig(
  data: any[],
  columns: string[],
  chartType: string,
  options: any
): any {
  const xColumn = options.xColumn || columns[0];
  const yColumns = options.yColumns || columns.slice(1, 3);
  
  const baseConfig: any = {
    tooltip: { trigger: 'axis' },
    legend: { data: yColumns },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: data.slice(0, 50).map((d: any) => String(d[xColumn] || ''))
    },
    yAxis: { type: 'value' }
  };
  
  switch (chartType) {
    case 'line':
      baseConfig.series = yColumns.map((col: string) => ({
        name: col,
        type: 'line',
        data: data.slice(0, 50).map((d: any) => d[col] || 0),
        smooth: true
      }));
      break;
    
    case 'pie':
      const pieData = data.slice(0, 10).map((d: any) => ({
        name: String(d[xColumn] || ''),
        value: d[yColumns[0]] || 0
      }));
      return {
        tooltip: { trigger: 'item' },
        legend: { orient: 'vertical', left: 'left' },
        series: [{
          type: 'pie',
          radius: '50%',
          data: pieData,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }]
      };
    
    case 'scatter':
      return {
        tooltip: { trigger: 'item' },
        xAxis: { type: 'value', name: yColumns[0] || 'X' },
        yAxis: { type: 'value', name: yColumns[1] || yColumns[0] || 'Y' },
        series: [{
          type: 'scatter',
          data: data.map((d: any) => [d[yColumns[0]] || 0, d[yColumns[1] || yColumns[0]] || 0]),
          symbolSize: 10
        }]
      };
    
    case 'bar':
    default:
      baseConfig.series = yColumns.map((col: string) => ({
        name: col,
        type: 'bar',
        data: data.slice(0, 50).map((d: any) => d[col] || 0)
      }));
      break;
  }
  
  return baseConfig;
}

/**
 * 生成对话摘要
 */
function generateSummary(question: string, rows: any[], columns: string[]): string {
  if (rows.length === 0) {
    return '查询未返回任何结果，可能没有符合条件的数据。';
  }
  
  const questionLower = question.toLowerCase();
  
  const topMatch = questionLower.match(/top\s*(\d+)|前\s*(\d+)|(\d+)\s*(个|条|名)/);
  if (topMatch) {
    const n = parseInt(topMatch[1] || topMatch[2] || topMatch[3]) || 10;
    return `查询返回了 ${rows.length} 条数据。以下是排名前 ${Math.min(n, rows.length)} 的结果：`;
  }
  
  if (questionLower.includes('总') || questionLower.includes('合计') || questionLower.includes('sum') || questionLower.includes('count')) {
    if (rows.length === 1 && columns.length <= 3) {
      const values = columns.map(c => `${c}: ${rows[0][c]}`).join(', ');
      return `统计结果：${values}`;
    }
    return `统计查询返回 ${rows.length} 条结果。`;
  }
  
  if (questionLower.includes('平均') || questionLower.includes('avg')) {
    if (rows.length === 1 && columns.length <= 3) {
      const values = columns.map(c => `${c}: ${rows[0][c]}`).join(', ');
      return `平均统计结果：${values}`;
    }
    return `查询返回 ${rows.length} 条结果。`;
  }
  
  if (questionLower.includes('最高') || questionLower.includes('最大') || questionLower.includes('max') ||
      questionLower.includes('最低') || questionLower.includes('最小') || questionLower.includes('min')) {
    if (rows.length === 1) {
      return `查询结果：${columns.map(c => `${c}: ${rows[0][c]}`).join(', ')}`;
    }
    return `查询返回 ${rows.length} 条结果。`;
  }
  
  if (rows.length <= 5) {
    return `查询返回 ${rows.length} 条数据。`;
  }
  return `查询返回 ${rows.length} 条数据，以下是部分结果：`;
}

// 默认导出
export default { createApp, startServer };