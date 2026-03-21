/**
 * 请求限流模块
 * 基于内存的限流，支持每分钟/每天的请求数限制
 */

import { PlanType, PLAN_QUOTAS } from './apikeys';

// 限流记录接口
interface RateLimitRecord {
  minuteCount: number;
  minuteResetAt: number;
  dayCount: number;
  dayResetAt: number;
}

// 限流存储（内存）
const rateLimitStore = new Map<string, RateLimitRecord>();

// 清理间隔（毫秒）
const CLEANUP_INTERVAL = 60 * 1000; // 每分钟清理一次

// 上次清理时间
let lastCleanupAt = 0;

/**
 * 获取当前分钟开始时间戳
 */
function getMinuteStart(): number {
  const now = Date.now();
  return Math.floor(now / 60000) * 60000;
}

/**
 * 获取当天开始时间戳
 */
function getDayStart(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/**
 * 清理过期记录
 */
function cleanupExpiredRecords(): void {
  const now = Date.now();
  
  if (now - lastCleanupAt < CLEANUP_INTERVAL) {
    return;
  }
  
  lastCleanupAt = now;
  
  for (const [key, record] of rateLimitStore.entries()) {
    if (record.minuteResetAt < now && record.dayResetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * 限流结果
 */
export interface RateLimitResult {
  allowed: boolean;
  limit: {
    minute: number;
    day: number;
  };
  remaining: {
    minute: number;
    day: number;
  };
  resetAt: {
    minute: number;
    day: number;
  };
}

/**
 * 检查是否允许请求
 */
export function checkRateLimit(
  identifier: string,
  plan: PlanType
): RateLimitResult {
  cleanupExpiredRecords();
  
  const now = Date.now();
  const minuteStart = getMinuteStart();
  const dayStart = getDayStart();
  const quota = PLAN_QUOTAS[plan];
  
  // 获取或创建记录
  let record = rateLimitStore.get(identifier);
  
  if (!record) {
    record = {
      minuteCount: 0,
      minuteResetAt: minuteStart + 60000,
      dayCount: 0,
      dayResetAt: dayStart + 24 * 60 * 60 * 1000
    };
    rateLimitStore.set(identifier, record);
  }
  
  // 检查分钟重置
  if (record.minuteResetAt <= now) {
    record.minuteCount = 0;
    record.minuteResetAt = minuteStart + 60000;
  }
  
  // 检查天重置
  if (record.dayResetAt <= now) {
    record.dayCount = 0;
    record.dayResetAt = dayStart + 24 * 60 * 60 * 1000;
  }
  
  const minuteRemaining = Math.max(0, quota.requestsPerMinute - record.minuteCount);
  const dayRemaining = Math.max(0, quota.requestsPerDay - record.dayCount);
  
  // 检查是否超限
  const minuteExceeded = record.minuteCount >= quota.requestsPerMinute;
  const dayExceeded = record.dayCount >= quota.requestsPerDay;
  
  if (minuteExceeded || dayExceeded) {
    return {
      allowed: false,
      limit: {
        minute: quota.requestsPerMinute,
        day: quota.requestsPerDay
      },
      remaining: {
        minute: minuteRemaining,
        day: dayRemaining
      },
      resetAt: {
        minute: record.minuteResetAt,
        day: record.dayResetAt
      }
    };
  }
  
  // 增加计数
  record.minuteCount++;
  record.dayCount++;
  
  return {
    allowed: true,
    limit: {
      minute: quota.requestsPerMinute,
      day: quota.requestsPerDay
    },
    remaining: {
      minute: minuteRemaining - 1,
      day: dayRemaining - 1
    },
    resetAt: {
      minute: record.minuteResetAt,
      day: record.dayResetAt
    }
  };
}

/**
 * 重置某个标识符的限流记录
 */
export function resetRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}

/**
 * 获取某个标识符的限流状态
 */
export function getRateLimitStatus(
  identifier: string,
  plan: PlanType
): RateLimitResult {
  const now = Date.now();
  const quota = PLAN_QUOTAS[plan];
  const record = rateLimitStore.get(identifier);
  
  if (!record) {
    return {
      allowed: true,
      limit: {
        minute: quota.requestsPerMinute,
        day: quota.requestsPerDay
      },
      remaining: {
        minute: quota.requestsPerMinute,
        day: quota.requestsPerDay
      },
      resetAt: {
        minute: getMinuteStart() + 60000,
        day: getDayStart() + 24 * 60 * 60 * 1000
      }
    };
  }
  
  const minuteCount = record.minuteResetAt > now ? record.minuteCount : 0;
  const dayCount = record.dayResetAt > now ? record.dayCount : 0;
  
  return {
    allowed: minuteCount < quota.requestsPerMinute && dayCount < quota.requestsPerDay,
    limit: {
      minute: quota.requestsPerMinute,
      day: quota.requestsPerDay
    },
    remaining: {
      minute: Math.max(0, quota.requestsPerMinute - minuteCount),
      day: Math.max(0, quota.requestsPerDay - dayCount)
    },
    resetAt: {
      minute: record.minuteResetAt,
      day: record.dayResetAt
    }
  };
}

/**
 * 清除所有限流记录
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
}