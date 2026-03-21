/**
 * 异常检测模块
 * Anomaly Detection Module
 * 
 * 实现功能:
 * - 统计方法: Z-Score, IQR, MAD
 * - 时间序列异常: 移动窗口检测
 * - 聚类异常: K-Means 离群点
 */

// ==================== 类型定义 ====================

export interface AnomalyPoint {
  index: number;
  value: number;
  score: number;        // 异常分数 (0-1)
  reason: string;       // 异常原因
  methods: string[];    // 检测到异常的方法
}

export interface AnomalyResult {
  anomalies: AnomalyPoint[];
  statistics: {
    totalPoints: number;
    anomalyCount: number;
    anomalyRate: number;
    methodsUsed: string[];
  };
  thresholds: {
    [method: string]: { lower: number; upper: number };
  };
  summary: string;
}

export interface AnomalyOptions {
  methods?: ('zscore' | 'iqr' | 'mad' | 'window' | 'kmeans')[];
  threshold?: number;       // Z-Score 阈值 (默认 3)
  windowSize?: number;      // 移动窗口大小
  contamination?: number;   // 预期异常比例 (默认 0.1)
}

// ==================== 辅助函数 ====================

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function variance(arr: number[]): number {
  if (arr.length <= 1) return 0;
  const avg = mean(arr);
  return arr.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / (arr.length - 1);
}

function stdDev(arr: number[]): number {
  return Math.sqrt(variance(arr));
}

function mad(arr: number[]): number {
  const med = median(arr);
  const deviations = arr.map(v => Math.abs(v - med));
  return median(deviations);
}

// ==================== Z-Score 方法 ====================

export function zScoreAnomaly(
  data: number[],
  threshold: number = 3
): { anomalies: Map<number, number>; bounds: { lower: number; upper: number } } {
  const anomalies = new Map<number, number>();
  
  if (data.length < 3) {
    return { anomalies, bounds: { lower: -Infinity, upper: Infinity } };
  }
  
  const avg = mean(data);
  const std = stdDev(data);
  
  if (std === 0) {
    return { anomalies, bounds: { lower: avg, upper: avg } };
  }
  
  const lower = avg - threshold * std;
  const upper = avg + threshold * std;
  
  data.forEach((value, index) => {
    const zScore = Math.abs((value - avg) / std);
    if (zScore > threshold) {
      anomalies.set(index, zScore);
    }
  });
  
  return { anomalies, bounds: { lower, upper } };
}

// ==================== IQR 方法 ====================

export function iqrAnomaly(
  data: number[],
  k: number = 1.5
): { anomalies: Map<number, number>; bounds: { lower: number; upper: number } } {
  const anomalies = new Map<number, number>();
  
  if (data.length < 4) {
    return { anomalies, bounds: { lower: -Infinity, upper: Infinity } };
  }
  
  const sorted = [...data].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;
  
  const lower = q1 - k * iqr;
  const upper = q3 + k * iqr;
  
  data.forEach((value, index) => {
    if (value < lower || value > upper) {
      const score = value < lower 
        ? (lower - value) / iqr 
        : (value - upper) / iqr;
      anomalies.set(index, score);
    }
  });
  
  return { anomalies, bounds: { lower, upper } };
}

// ==================== MAD 方法 ====================

export function madAnomaly(
  data: number[],
  threshold: number = 3.5
): { anomalies: Map<number, number>; bounds: { lower: number; upper: number } } {
  const anomalies = new Map<number, number>();
  
  if (data.length < 3) {
    return { anomalies, bounds: { lower: -Infinity, upper: Infinity } };
  }
  
  const med = median(data);
  const madValue = mad(data);
  
  // MAD 的比例因子（对于正态分布约为 1.4826）
  const scaledMAD = madValue * 1.4826;
  
  if (scaledMAD === 0) {
    // 如果 MAD 为 0，检查是否有非中位数的点
    data.forEach((value, index) => {
      if (value !== med) {
        anomalies.set(index, Infinity);
      }
    });
    return { anomalies, bounds: { lower: med, upper: med } };
  }
  
  const lower = med - threshold * scaledMAD;
  const upper = med + threshold * scaledMAD;
  
  data.forEach((value, index) => {
    const modifiedZScore = Math.abs((value - med) / scaledMAD);
    if (modifiedZScore > threshold) {
      anomalies.set(index, modifiedZScore);
    }
  });
  
  return { anomalies, bounds: { lower, upper } };
}

// ==================== 移动窗口异常检测 ====================

export function windowAnomaly(
  data: number[],
  windowSize: number = 10,
  threshold: number = 3
): { anomalies: Map<number, number>; bounds: Map<number, { lower: number; upper: number }> } {
  const anomalies = new Map<number, number>();
  const bounds = new Map<number, { lower: number; upper: number }>();
  
  if (data.length < windowSize) {
    return { anomalies, bounds };
  }
  
  const halfWindow = Math.floor(windowSize / 2);
  
  for (let i = 0; i < data.length; i++) {
    // 使用当前点前后的窗口
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(data.length, i + halfWindow + 1);
    
    // 排除当前点计算局部统计
    const windowData = [...data.slice(start, i), ...data.slice(i + 1, end)];
    
    if (windowData.length < 3) continue;
    
    const avg = mean(windowData);
    const std = stdDev(windowData);
    
    if (std === 0) continue;
    
    const lower = avg - threshold * std;
    const upper = avg + threshold * std;
    
    bounds.set(i, { lower, upper });
    
    const value = data[i];
    if (value < lower || value > upper) {
      const zScore = Math.abs((value - avg) / std);
      anomalies.set(i, zScore);
    }
  }
  
  return { anomalies, bounds };
}

// ==================== K-Means 离群点检测 ====================

export interface ClusterCenter {
  center: number;
  count: number;
}

export function kMeansAnomaly(
  data: number[],
  k: number = 3,
  contamination: number = 0.1
): { anomalies: Map<number, number>; clusters: ClusterCenter[] } {
  const anomalies = new Map<number, number>();
  
  if (data.length < k * 2) {
    return { anomalies, clusters: [] };
  }
  
  // 初始化聚类中心（使用等距分位数）
  const sorted = [...data].sort((a, b) => a - b);
  const centers: number[] = [];
  for (let i = 0; i < k; i++) {
    const idx = Math.floor((i + 0.5) * sorted.length / k);
    centers.push(sorted[idx]);
  }
  
  // K-Means 迭代
  const maxIterations = 100;
  let clusters: number[][] = Array(k).fill(null).map(() => []);
  
  for (let iter = 0; iter < maxIterations; iter++) {
    // 分配点到最近的聚类
    clusters = Array(k).fill(null).map(() => []);
    
    for (const value of data) {
      let minDist = Infinity;
      let minIdx = 0;
      
      for (let i = 0; i < centers.length; i++) {
        const dist = Math.abs(value - centers[i]);
        if (dist < minDist) {
          minDist = dist;
          minIdx = i;
        }
      }
      
      clusters[minIdx].push(value);
    }
    
    // 更新聚类中心
    const newCenters = clusters.map((cluster, i) => {
      if (cluster.length === 0) return centers[i];
      return mean(cluster);
    });
    
    // 检查收敛
    const converged = centers.every((c, i) => Math.abs(c - newCenters[i]) < 0.0001);
    
    for (let i = 0; i < centers.length; i++) {
      centers[i] = newCenters[i];
    }
    
    if (converged) break;
  }
  
  // 计算每个点到其聚类中心的距离
  const distances: { index: number; distance: number }[] = [];
  
  data.forEach((value, index) => {
    let minDist = Infinity;
    for (const center of centers) {
      const dist = Math.abs(value - center);
      minDist = Math.min(minDist, dist);
    }
    distances.push({ index, distance: minDist });
  });
  
  // 按距离排序，标记最远的 contamination 比例的点为异常
  distances.sort((a, b) => b.distance - a.distance);
  const numAnomalies = Math.ceil(data.length * contamination);
  
  const threshold = distances[numAnomalies - 1]?.distance || 0;
  
  distances.forEach(({ index, distance }, rank) => {
    if (rank < numAnomalies) {
      anomalies.set(index, distance / (threshold || 1));
    }
  });
  
  return {
    anomalies,
    clusters: centers.map((center, i) => ({
      center,
      count: clusters[i].length
    }))
  };
}

// ==================== 综合异常检测 ====================

export function detectAnomalies(
  data: number[],
  options: AnomalyOptions = {}
): AnomalyResult {
  const methods = options.methods || ['zscore', 'iqr', 'mad'];
  const threshold = options.threshold || 3;
  const windowSize = options.windowSize || 10;
  const contamination = options.contamination || 0.1;
  
  // 存储每种方法检测到的异常
  const methodResults = new Map<string, Map<number, number>>();
  const thresholds: { [method: string]: { lower: number; upper: number } } = {};
  
  // 运行每种方法
  if (methods.includes('zscore')) {
    const result = zScoreAnomaly(data, threshold);
    methodResults.set('zscore', result.anomalies);
    thresholds['zscore'] = result.bounds;
  }
  
  if (methods.includes('iqr')) {
    const result = iqrAnomaly(data, 1.5);
    methodResults.set('iqr', result.anomalies);
    thresholds['iqr'] = result.bounds;
  }
  
  if (methods.includes('mad')) {
    const result = madAnomaly(data, 3.5);
    methodResults.set('mad', result.anomalies);
    thresholds['mad'] = result.bounds;
  }
  
  if (methods.includes('window')) {
    const result = windowAnomaly(data, windowSize, threshold);
    methodResults.set('window', result.anomalies);
    // 取平均边界
    const boundValues = Array.from(result.bounds.values());
    if (boundValues.length > 0) {
      thresholds['window'] = {
        lower: Math.min(...boundValues.map(b => b.lower)),
        upper: Math.max(...boundValues.map(b => b.upper))
      };
    }
  }
  
  if (methods.includes('kmeans')) {
    const result = kMeansAnomaly(data, Math.min(3, Math.floor(data.length / 2)), contamination);
    methodResults.set('kmeans', result.anomalies);
  }
  
  // 合并结果：被至少两种方法检测到的点为异常
  const anomalyCounts = new Map<number, { score: number; methods: string[] }>();
  
  methodResults.forEach((anomalies, method) => {
    anomalies.forEach((score, index) => {
      const existing = anomalyCounts.get(index);
      if (existing) {
        existing.score = Math.max(existing.score, score);
        existing.methods.push(method);
      } else {
        anomalyCounts.set(index, { score, methods: [method] });
      }
    });
  });
  
  // 过滤：至少被一种方法检测到
  const anomalyPoints: AnomalyPoint[] = [];
  
  anomalyCounts.forEach((info, idx) => {
    anomalyPoints.push({
      index: idx,
      value: data[idx] ?? 0,
      score: Math.min(info.score / threshold, 1), // 归一化分数
      reason: getAnomalyReason(idx, info.methods, thresholds),
      methods: info.methods
    });
  });
  
  // 按异常分数排序
  anomalyPoints.sort((a, b) => b.score - a.score);
  
  // 生成摘要
  const summary = generateSummary(data.length, anomalyPoints.length, methods);
  
  return {
    anomalies: anomalyPoints,
    statistics: {
      totalPoints: data.length,
      anomalyCount: anomalyPoints.length,
      anomalyRate: data.length > 0 ? anomalyPoints.length / data.length : 0,
      methodsUsed: methods
    },
    thresholds,
    summary
  };
}

function getAnomalyReason(
  index: number,
  methods: string[],
  thresholds: { [method: string]: { lower: number; upper: number } }
): string {
  const methodNames: { [key: string]: string } = {
    zscore: 'Z-Score',
    iqr: 'IQR',
    mad: 'MAD',
    window: '移动窗口',
    kmeans: 'K-Means'
  };
  
  if (methods.length === 1) {
    const method = methods[0];
    const bounds = thresholds[method];
    if (bounds) {
      return `被 ${methodNames[method]} 方法检测为异常 (正常范围: [${bounds.lower.toFixed(2)}, ${bounds.upper.toFixed(2)}])`;
    }
    return `被 ${methodNames[method]} 方法检测为异常`;
  }
  
  return `被 ${methods.map(m => methodNames[m]).join(', ')} 方法共同检测为异常`;
}

function generateSummary(total: number, anomalyCount: number, methods: string[]): string {
  const rate = total > 0 ? (anomalyCount / total * 100).toFixed(2) : '0.00';
  
  if (anomalyCount === 0) {
    return `在 ${total} 个数据点中未检测到异常值（使用 ${methods.join(', ')} 方法）`;
  }
  
  if (anomalyCount === 1) {
    return `在 ${total} 个数据点中检测到 1 个异常值（${rate}%），建议进一步检查该数据点`;
  }
  
  if (anomalyCount <= total * 0.05) {
    return `在 ${total} 个数据点中检测到 ${anomalyCount} 个异常值（${rate}%），异常比例较低，数据质量良好`;
  }
  
  if (anomalyCount <= total * 0.1) {
    return `在 ${total} 个数据点中检测到 ${anomalyCount} 个异常值（${rate}%），异常比例适中，建议检查异常数据`;
  }
  
  return `在 ${total} 个数据点中检测到 ${anomalyCount} 个异常值（${rate}%），异常比例较高，建议检查数据质量或调整阈值`;
}

// ==================== 输出格式化 ====================

export interface AnomalyReport {
  summary: string;
  statistics: {
    totalPoints: number;
    anomalyCount: number;
    anomalyRate: string;
    methodsUsed: string[];
  };
  anomalies: {
    index: number;
    value: number;
    score: string;
    reason: string;
    detectedBy: string[];
  }[];
  insights: string[];
}

export function formatAnomalyReport(
  data: number[],
  result: AnomalyResult,
  labels?: string[]
): AnomalyReport {
  const insights: string[] = [];
  
  // 异常比例洞察
  if (result.statistics.anomalyRate > 0.1) {
    insights.push(`⚠️ 异常比例超过 10%，可能存在系统性数据问题`);
  } else if (result.statistics.anomalyRate > 0.05) {
    insights.push(`📊 异常比例适中，建议关注异常数据点`);
  } else if (result.statistics.anomalyCount > 0) {
    insights.push(`✅ 异常比例较低，数据整体质量良好`);
  }
  
  // 异常值范围洞察
  const anomalyValues = result.anomalies.map(a => a.value);
  if (anomalyValues.length > 0) {
    const maxAnomaly = Math.max(...anomalyValues);
    const minAnomaly = Math.min(...anomalyValues);
    const normalMax = Math.max(...data.filter(v => !anomalyValues.includes(v)));
    const normalMin = Math.min(...data.filter(v => !anomalyValues.includes(v)));
    
    insights.push(`📈 异常值范围: [${minAnomaly.toFixed(2)}, ${maxAnomaly.toFixed(2)}]，正常值范围: [${normalMin.toFixed(2)}, ${normalMax.toFixed(2)}]`);
  }
  
  // 检测方法洞察
  const methodAgreement = result.anomalies.filter(a => a.methods.length > 1).length;
  if (methodAgreement > 0) {
    insights.push(`🔍 ${methodAgreement} 个异常点被多种方法共同检测，可信度较高`);
  }
  
  return {
    summary: result.summary,
    statistics: {
      totalPoints: result.statistics.totalPoints,
      anomalyCount: result.statistics.anomalyCount,
      anomalyRate: `${(result.statistics.anomalyRate * 100).toFixed(2)}%`,
      methodsUsed: result.statistics.methodsUsed
    },
    anomalies: result.anomalies.map(a => ({
      index: a.index,
      value: a.value,
      score: `${(a.score * 100).toFixed(1)}%`,
      reason: a.reason,
      detectedBy: a.methods
    })),
    insights
  };
}