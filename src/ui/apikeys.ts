/**
 * API Key 管理模块
 * 本地存储、生成、验证、撤销 API Keys
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

// API Key 存储路径 - 支持自定义数据目录
const APIKEYS_DIR = process.env.DATAMIND_HOME || path.join(os.homedir(), '.datamind');
const APIKEYS_FILE = path.join(APIKEYS_DIR, 'apikeys.json');

// API Key 计划类型
export type PlanType = 'free' | 'pro' | 'team';

// API Key 配额配置
export const PLAN_QUOTAS: Record<PlanType, { requestsPerMinute: number; requestsPerDay: number }> = {
  free: { requestsPerMinute: 10, requestsPerDay: 100 },
  pro: { requestsPerMinute: 100, requestsPerDay: 10000 },
  team: { requestsPerMinute: 500, requestsPerDay: 100000 }
};

// API Key 信息接口
export interface APIKeyInfo {
  key: string;
  name: string;
  plan: PlanType;
  createdAt: number;
  lastUsedAt?: number;
  requestCount: number;
  revoked: boolean;
  revokedAt?: number;
}

// API Keys 存储结构
interface APIKeysStore {
  keys: APIKeyInfo[];
  version: number;
}

/**
 * 确保 API Keys 目录和文件存在
 */
function ensureStore(): void {
  if (!fs.existsSync(APIKEYS_DIR)) {
    fs.mkdirSync(APIKEYS_DIR, { recursive: true });
  }
  
  if (!fs.existsSync(APIKEYS_FILE)) {
    const initialStore: APIKeysStore = {
      keys: [],
      version: 1
    };
    fs.writeFileSync(APIKEYS_FILE, JSON.stringify(initialStore, null, 2), 'utf-8');
  }
}

/**
 * 读取 API Keys 存储
 */
function readStore(): APIKeysStore {
  ensureStore();
  try {
    const content = fs.readFileSync(APIKEYS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { keys: [], version: 1 };
  }
}

/**
 * 写入 API Keys 存储
 */
function writeStore(store: APIKeysStore): void {
  ensureStore();
  fs.writeFileSync(APIKEYS_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

/**
 * 生成随机字符串
 */
function generateRandomString(length: number): string {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

/**
 * 生成 API Key
 * 格式: dm_<32位随机字符>
 */
export function generateAPIKey(): string {
  const randomPart = generateRandomString(32);
  return `dm_${randomPart}`;
}

/**
 * 创建新的 API Key
 */
export function createAPIKey(options: {
  name: string;
  plan?: PlanType;
}): APIKeyInfo {
  const store = readStore();
  
  const keyInfo: APIKeyInfo = {
    key: generateAPIKey(),
    name: options.name,
    plan: options.plan || 'free',
    createdAt: Date.now(),
    requestCount: 0,
    revoked: false
  };
  
  store.keys.push(keyInfo);
  writeStore(store);
  
  return keyInfo;
}

/**
 * 验证 API Key
 * 返回 Key 信息，如果无效返回 null
 */
export function validateAPIKey(key: string): APIKeyInfo | null {
  if (!key || !key.startsWith('dm_')) {
    return null;
  }
  
  const store = readStore();
  const keyInfo = store.keys.find(k => k.key === key);
  
  if (!keyInfo) {
    return null;
  }
  
  if (keyInfo.revoked) {
    return null;
  }
  
  // 更新最后使用时间和请求计数
  keyInfo.lastUsedAt = Date.now();
  keyInfo.requestCount++;
  writeStore(store);
  
  return keyInfo;
}

/**
 * 撤销 API Key
 */
export function revokeAPIKey(key: string): boolean {
  const store = readStore();
  const keyInfo = store.keys.find(k => k.key === key);
  
  if (!keyInfo) {
    return false;
  }
  
  if (keyInfo.revoked) {
    return true; // 已经撤销
  }
  
  keyInfo.revoked = true;
  keyInfo.revokedAt = Date.now();
  writeStore(store);
  
  return true;
}

/**
 * 删除 API Key
 */
export function deleteAPIKey(key: string): boolean {
  const store = readStore();
  const index = store.keys.findIndex(k => k.key === key);
  
  if (index === -1) {
    return false;
  }
  
  store.keys.splice(index, 1);
  writeStore(store);
  
  return true;
}

/**
 * 列出所有 API Keys
 */
export function listAPIKeys(includeRevoked: boolean = false): APIKeyInfo[] {
  const store = readStore();
  
  if (includeRevoked) {
    return store.keys;
  }
  
  return store.keys.filter(k => !k.revoked);
}

/**
 * 获取 API Key 信息
 */
export function getAPIKeyInfo(key: string): APIKeyInfo | null {
  const store = readStore();
  return store.keys.find(k => k.key === key) || null;
}

/**
 * 获取计划的配额
 */
export function getPlanQuota(plan: PlanType): { requestsPerMinute: number; requestsPerDay: number } {
  return PLAN_QUOTAS[plan];
}

/**
 * 清理过期的 API Keys (已撤销超过30天的)
 */
export function cleanupOldKeys(): number {
  const store = readStore();
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  
  const initialLength = store.keys.length;
  store.keys = store.keys.filter(k => {
    if (k.revoked && k.revokedAt && k.revokedAt < thirtyDaysAgo) {
      return false;
    }
    return true;
  });
  
  if (store.keys.length !== initialLength) {
    writeStore(store);
  }
  
  return initialLength - store.keys.length;
}