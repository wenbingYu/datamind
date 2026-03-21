/**
 * 认证中间件
 * API Key 验证和可选认证
 */

import { Request, Response, NextFunction } from 'express';
import { validateAPIKey, getPlanQuota, APIKeyInfo } from './apikeys';
import { checkRateLimit, RateLimitResult } from './rate-limit';

// 扩展 Request 类型
declare global {
  namespace Express {
    interface Request {
      apiKey?: APIKeyInfo;
      rateLimit?: RateLimitResult;
    }
  }
}

// 不需要认证的端点
const PUBLIC_ENDPOINTS = [
  { method: 'GET', path: '/api/tables' },
  { method: 'GET', path: '/api/health' },
  { method: 'POST', path: '/api/keys' },  // 创建 Key 需要其他验证方式
  { method: 'GET', path: '/api/keys' },   // 列出 Keys 需要其他验证方式
];

/**
 * 检查是否为公开端点
 */
function isPublicEndpoint(method: string, path: string): boolean {
  return PUBLIC_ENDPOINTS.some(ep => 
    ep.method === method && 
    (ep.path === path || path.startsWith(ep.path + '/'))
  );
}

/**
 * 从请求中提取 API Key
 */
function extractAPIKey(req: Request): string | null {
  // 1. 从 Header 获取
  const authHeader = req.headers.authorization;
  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    if (authHeader.startsWith('dm_')) {
      return authHeader;
    }
  }
  
  // 2. 从 X-API-Key Header 获取
  const apiKeyHeader = req.headers['x-api-key'];
  if (apiKeyHeader && typeof apiKeyHeader === 'string') {
    return apiKeyHeader;
  }
  
  // 3. 从 Query 参数获取
  if (req.query.api_key && typeof req.query.api_key === 'string') {
    return req.query.api_key;
  }
  
  return null;
}

/**
 * 认证中间件（可选）
 * 如果提供了 API Key 则验证，否则继续
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = extractAPIKey(req);
  
  if (!apiKey) {
    // 没有 API Key，继续但不设置 apiKey
    next();
    return;
  }
  
  const keyInfo = validateAPIKey(apiKey);
  
  if (!keyInfo) {
    res.status(401).json({
      success: false,
      error: 'Invalid API Key'
    });
    return;
  }
  
  req.apiKey = keyInfo;
  next();
}

/**
 * 认证中间件（必需）
 * 必须提供有效的 API Key
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = extractAPIKey(req);
  
  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: 'API Key required. Provide via Authorization header or X-API-Key header.'
    });
    return;
  }
  
  const keyInfo = validateAPIKey(apiKey);
  
  if (!keyInfo) {
    res.status(401).json({
      success: false,
      error: 'Invalid or revoked API Key'
    });
    return;
  }
  
  req.apiKey = keyInfo;
  next();
}

/**
 * 条件认证中间件
 * 公开端点可选认证，其他端点必需认证
 */
export function conditionalAuth(req: Request, res: Response, next: NextFunction): void {
  if (isPublicEndpoint(req.method, req.path)) {
    optionalAuth(req, res, next);
  } else {
    requireAuth(req, res, next);
  }
}

/**
 * 限流中间件
 * 需要在认证中间件之后使用
 */
export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 如果没有 API Key，使用 IP 作为标识符
  const identifier = req.apiKey?.key || req.ip || 'anonymous';
  const plan = req.apiKey?.plan || 'free';
  
  const result = checkRateLimit(identifier, plan);
  
  // 设置限流相关的响应头
  res.setHeader('X-RateLimit-Limit-Minute', result.limit.minute);
  res.setHeader('X-RateLimit-Limit-Day', result.limit.day);
  res.setHeader('X-RateLimit-Remaining-Minute', result.remaining.minute);
  res.setHeader('X-RateLimit-Remaining-Day', result.remaining.day);
  res.setHeader('X-RateLimit-Reset-Minute', result.resetAt.minute);
  res.setHeader('X-RateLimit-Reset-Day', result.resetAt.day);
  
  if (!result.allowed) {
    const resetInSeconds = Math.ceil((result.resetAt.minute - Date.now()) / 1000);
    res.setHeader('Retry-After', resetInSeconds);
    
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      retryAfter: resetInSeconds,
      limit: result.limit,
      remaining: result.remaining,
      resetAt: result.resetAt
    });
    return;
  }
  
  req.rateLimit = result;
  next();
}

/**
 * 管理员认证中间件
 * 用于管理 API Key 的端点
 * 这里使用简单的本地验证（检查请求是否来自本机）
 */
export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  // 检查是否来自本地
  const ip = req.ip || req.socket.remoteAddress;
  const isLocal = ip === '127.0.0.1' || 
                  ip === '::1' || 
                  ip === '::ffff:127.0.0.1' ||
                  ip === 'localhost';
  
  // 如果是本地请求，允许管理操作
  if (isLocal) {
    next();
    return;
  }
  
  // 非本地请求需要提供管理员 API Key
  // 这里简单检查是否以 'dm_admin_' 开头
  const apiKey = extractAPIKey(req);
  
  if (apiKey && apiKey.startsWith('dm_admin_')) {
    const keyInfo = validateAPIKey(apiKey);
    if (keyInfo && !keyInfo.revoked) {
      req.apiKey = keyInfo;
      next();
      return;
    }
  }
  
  res.status(403).json({
    success: false,
    error: 'Admin access required. This endpoint is only accessible from localhost or with an admin API Key.'
  });
}

/**
 * 创建管理员 API Key
 * 只能在本地执行
 */
export function createAdminAPIKey(): string {
  const crypto = require('crypto');
  const randomPart = crypto.randomBytes(32).toString('hex');
  return `dm_admin_${randomPart}`;
}