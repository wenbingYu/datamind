/**
 * 相关性分析模块
 * Correlation Analysis Module
 * 
 * 实现功能:
 * - Pearson 相关系数
 * - Spearman 相关系数
 * - 相关性矩阵生成
 * - 热力图数据输出
 */

// ==================== 类型定义 ====================

export interface CorrelationResult {
  coefficient: number;
  pValue: number;
  sampleSize: number;
  strength: 'none' | 'weak' | 'moderate' | 'strong' | 'very_strong';
  direction: 'positive' | 'negative' | 'none';
  interpretation: string;
}

export interface CorrelationMatrix {
  columns: string[];
  matrix: number[][];
  method: 'pearson' | 'spearman';
}

export interface HeatmapData {
  x: string[];
  y: string[];
  z: number[][];
  colorscale: string;
  zmin: number;
  zmax: number;
}

export interface CorrelationPair {
  col1: string;
  col2: string;
  coefficient: number;
  pValue: number;
  interpretation: string;
}

export interface CorrelationAnalysisResult {
  matrix: CorrelationMatrix;
  pairs: CorrelationPair[];
  significantCorrelations: CorrelationPair[];
  summary: string;
}

// ==================== 辅助函数 ====================

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

function variance(arr: number[]): number {
  if (arr.length <= 1) return 0;
  const avg = mean(arr);
  return arr.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / (arr.length - 1);
}

function stdDev(arr: number[]): number {
  return Math.sqrt(variance(arr));
}

function rank(arr: number[]): number[] {
  const sorted = arr.map((v, i) => ({ value: v, index: i }))
    .sort((a, b) => a.value - b.value);
  
  const ranks: number[] = new Array(arr.length);
  
  // 处理相同值的平均排名
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length && sorted[j].value === sorted[i].value) {
      j++;
    }
    
    const avgRank = (i + j - 1) / 2 + 1; // 1-based ranking
    for (let k = i; k < j; k++) {
      ranks[sorted[k].index] = avgRank;
    }
    
    i = j;
  }
  
  return ranks;
}

// t分布近似（用于计算p值）
function tDistributionPValue(t: number, df: number): number {
  // 使用近似公式计算双侧p值
  const absT = Math.abs(t);
  
  if (df >= 30) {
    // 大样本使用正态近似
    return 2 * (1 - normalCDF(absT));
  }
  
  // 小样本使用 t 分布近似
  const x = df / (df + absT * absT);
  return 2 * incompleteBeta(df / 2, 0.5, x);
}

// 正态分布CDF近似
function normalCDF(x: number): number {
  // Abramowitz and Stegun approximation
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  
  return 0.5 * (1.0 + sign * y);
}

// 不完全Beta函数近似
function incompleteBeta(a: number, b: number, x: number): number {
  // 简化近似，适用于相关性p值计算
  if (x === 0) return 0;
  if (x === 1) return 1;
  
  // 使用级数展开
  const maxIter = 100;
  const eps = 1e-10;
  
  let sum = 1;
  let term = 1;
  
  for (let i = 0; i < maxIter; i++) {
    term *= (a + b + i) * x / (a + 1 + i);
    sum += term;
    if (Math.abs(term) < eps) break;
  }
  
  return Math.pow(x, a) * Math.pow(1 - x, b) * sum / beta(a, b);
}

// Beta函数
function beta(a: number, b: number): number {
  return gamma(a) * gamma(b) / gamma(a + b);
}

// Gamma函数（Stirling近似）
function gamma(x: number): number {
  if (x === 1) return 1;
  if (x === 0.5) return Math.sqrt(Math.PI);
  
  // Lanczos近似
  const g = 7;
  const c = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7
  ];
  
  if (x < 0.5) {
    return Math.PI / (Math.sin(Math.PI * x) * gamma(1 - x));
  }
  
  x -= 1;
  
  let ag = c[0];
  for (let i = 1; i < g + 2; i++) {
    ag += c[i] / (x + i);
  }
  
  const t = x + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, x + 0.5) * Math.exp(-t) * ag;
}

// ==================== Pearson 相关系数 ====================

export function pearsonCorrelation(x: number[], y: number[]): CorrelationResult {
  const n = Math.min(x.length, y.length);
  
  if (n < 3) {
    return {
      coefficient: 0,
      pValue: 1,
      sampleSize: n,
      strength: 'none',
      direction: 'none',
      interpretation: '样本量不足，无法计算相关性'
    };
  }
  
  const xSlice = x.slice(0, n);
  const ySlice = y.slice(0, n);
  
  const meanX = mean(xSlice);
  const meanY = mean(ySlice);
  
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;
  
  for (let i = 0; i < n; i++) {
    const dx = xSlice[i] - meanX;
    const dy = ySlice[i] - meanY;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }
  
  const denominator = Math.sqrt(sumX2 * sumY2);
  
  if (denominator === 0) {
    return {
      coefficient: 0,
      pValue: 1,
      sampleSize: n,
      strength: 'none',
      direction: 'none',
      interpretation: '方差为零，无法计算相关性'
    };
  }
  
  const r = sumXY / denominator;
  
  // 计算 p 值
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  const pValue = tDistributionPValue(t, n - 2);
  
  return formatCorrelationResult(r, pValue, n);
}

// ==================== Spearman 相关系数 ====================

export function spearmanCorrelation(x: number[], y: number[]): CorrelationResult {
  const n = Math.min(x.length, y.length);
  
  if (n < 3) {
    return {
      coefficient: 0,
      pValue: 1,
      sampleSize: n,
      strength: 'none',
      direction: 'none',
      interpretation: '样本量不足，无法计算相关性'
    };
  }
  
  // 转换为排名
  const rankX = rank(x.slice(0, n));
  const rankY = rank(y.slice(0, n));
  
  // 计算排名的 Pearson 相关系数
  const result = pearsonCorrelation(rankX, rankY);
  
  return {
    ...result,
    interpretation: getSpearmanInterpretation(result.coefficient, result.pValue)
  };
}

// ==================== 相关性矩阵 ====================

export function correlationMatrix(
  data: { [column: string]: number }[],
  columns: string[],
  method: 'pearson' | 'spearman' = 'pearson'
): CorrelationMatrix {
  const n = columns.length;
  const matrix: number[][] = [];
  
  for (let i = 0; i < n; i++) {
    matrix[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1;
      } else {
        const x = data.map(row => row[columns[i]]).filter(v => v !== null && v !== undefined);
        const y = data.map(row => row[columns[j]]).filter(v => v !== null && v !== undefined);
        
        // 只使用两者都有值的配对
        const pairs = data.filter(row => 
          row[columns[i]] !== null && row[columns[i]] !== undefined &&
          row[columns[j]] !== null && row[columns[j]] !== undefined
        );
        
        const xClean = pairs.map(row => row[columns[i]]);
        const yClean = pairs.map(row => row[columns[j]]);
        
        if (method === 'pearson') {
          matrix[i][j] = pearsonCorrelation(xClean, yClean).coefficient;
        } else {
          matrix[i][j] = spearmanCorrelation(xClean, yClean).coefficient;
        }
      }
    }
  }
  
  return {
    columns,
    matrix,
    method
  };
}

// ==================== 热力图数据生成 ====================

export function generateHeatmapData(correlationMatrix: CorrelationMatrix): HeatmapData {
  return {
    x: correlationMatrix.columns,
    y: correlationMatrix.columns.slice().reverse(),
    z: correlationMatrix.matrix.map(row => row.slice()).reverse(),
    colorscale: 'RdBu',
    zmin: -1,
    zmax: 1
  };
}

// ==================== 综合相关性分析 ====================

export function analyzeCorrelation(
  data: { [column: string]: number }[],
  columns: string[],
  method: 'pearson' | 'spearman' = 'pearson',
  significanceLevel: number = 0.05
): CorrelationAnalysisResult {
  // 计算相关性矩阵
  const matrix = correlationMatrix(data, columns, method);
  
  // 计算所有配对的相关性
  const pairs: CorrelationPair[] = [];
  const significantCorrelations: CorrelationPair[] = [];
  
  for (let i = 0; i < columns.length; i++) {
    for (let j = i + 1; j < columns.length; j++) {
      const col1 = columns[i];
      const col2 = columns[j];
      
      const pairs_clean = data.filter(row => 
        row[col1] !== null && row[col1] !== undefined &&
        row[col2] !== null && row[col2] !== undefined
      );
      
      const x = pairs_clean.map(row => row[col1]);
      const y = pairs_clean.map(row => row[col2]);
      
      let result: CorrelationResult;
      if (method === 'pearson') {
        result = pearsonCorrelation(x, y);
      } else {
        result = spearmanCorrelation(x, y);
      }
      
      const pair: CorrelationPair = {
        col1,
        col2,
        coefficient: result.coefficient,
        pValue: result.pValue,
        interpretation: result.interpretation
      };
      
      pairs.push(pair);
      
      if (result.pValue < significanceLevel && Math.abs(result.coefficient) > 0.3) {
        significantCorrelations.push(pair);
      }
    }
  }
  
  // 按相关系数绝对值排序
  pairs.sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient));
  significantCorrelations.sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient));
  
  // 生成摘要
  const summary = generateCorrelationSummary(columns.length, pairs.length, significantCorrelations.length);
  
  return {
    matrix,
    pairs,
    significantCorrelations,
    summary
  };
}

// ==================== 辅助函数 ====================

function formatCorrelationResult(r: number, pValue: number, n: number): CorrelationResult {
  const absR = Math.abs(r);
  
  let strength: CorrelationResult['strength'];
  if (absR >= 0.9) strength = 'very_strong';
  else if (absR >= 0.7) strength = 'strong';
  else if (absR >= 0.4) strength = 'moderate';
  else if (absR >= 0.2) strength = 'weak';
  else strength = 'none';
  
  const direction: CorrelationResult['direction'] = 
    r > 0.05 ? 'positive' : r < -0.05 ? 'negative' : 'none';
  
  const interpretation = getInterpretation(r, pValue, n);
  
  return {
    coefficient: Math.round(r * 1000) / 1000, // 保留3位小数
    pValue: Math.round(pValue * 1000) / 1000,
    sampleSize: n,
    strength,
    direction,
    interpretation
  };
}

function getInterpretation(r: number, pValue: number, n: number): string {
  const absR = Math.abs(r);
  const isSignificant = pValue < 0.05;
  
  if (absR < 0.2) {
    return isSignificant 
      ? `相关性极弱 (r=${r.toFixed(3)})，但统计显著 (p=${pValue.toFixed(3)})`
      : `无显著相关性 (r=${r.toFixed(3)}, p=${pValue.toFixed(3)})`;
  }
  
  const strengthDesc = 
    absR >= 0.9 ? '极强' :
    absR >= 0.7 ? '强' :
    absR >= 0.4 ? '中等' : '弱';
  
  const directionDesc = r > 0 ? '正相关' : '负相关';
  
  if (isSignificant) {
    return `${strengthDesc}${directionDesc} (r=${r.toFixed(3)}, p=${pValue.toFixed(3)})`;
  } else {
    return `${strengthDesc}${directionDesc}，但不显著 (r=${r.toFixed(3)}, p=${pValue.toFixed(3)})`;
  }
}

function getSpearmanInterpretation(r: number, pValue: number): string {
  const absR = Math.abs(r);
  const isSignificant = pValue < 0.05;
  
  if (absR < 0.2) {
    return isSignificant 
      ? `秩相关极弱 (ρ=${r.toFixed(3)})，但统计显著`
      : `无显著秩相关 (ρ=${r.toFixed(3)}, p=${pValue.toFixed(3)})`;
  }
  
  const strengthDesc = 
    absR >= 0.9 ? '极强' :
    absR >= 0.7 ? '强' :
    absR >= 0.4 ? '中等' : '弱';
  
  const directionDesc = r > 0 ? '正相关' : '负相关';
  
  return `Spearman ${strengthDesc}${directionDesc} (ρ=${r.toFixed(3)})`;
}

function generateCorrelationSummary(nCols: number, nPairs: number, nSignificant: number): string {
  if (nSignificant === 0) {
    return `在 ${nCols} 个变量之间的 ${nPairs} 个配对中，未发现显著相关性`;
  }
  
  const pct = ((nSignificant / nPairs) * 100).toFixed(1);
  return `在 ${nCols} 个变量之间的 ${nPairs} 个配对中，发现 ${nSignificant} 个显著相关 (${pct}%)`;
}

// ==================== 输出格式化 ====================

export interface CorrelationReport {
  summary: string;
  matrix: {
    columns: string[];
    rows: {
      column: string;
      values: { column: string; coefficient: number; formatted: string }[];
    }[];
  };
  topCorrelations: {
    pair: string;
    coefficient: number;
    pValue: string;
    strength: string;
    direction: string;
    interpretation: string;
  }[];
  significantCorrelations: {
    pair: string;
    coefficient: number;
    interpretation: string;
  }[];
  insights: string[];
}

export function formatCorrelationReport(
  result: CorrelationAnalysisResult,
  topN: number = 10
): CorrelationReport {
  const insights: string[] = [];
  
  // 强相关洞察
  const strongCorrelations = result.significantCorrelations.filter(
    p => Math.abs(p.coefficient) > 0.7
  );
  if (strongCorrelations.length > 0) {
    insights.push(`🔗 发现 ${strongCorrelations.length} 对强相关变量（|r| > 0.7）`);
  }
  
  // 负相关洞察
  const negativeCorrelations = result.significantCorrelations.filter(
    p => p.coefficient < -0.4
  );
  if (negativeCorrelations.length > 0) {
    insights.push(`📉 ${negativeCorrelations.length} 对变量呈现显著负相关`);
  }
  
  // 格式化矩阵
  const matrixRows = result.matrix.columns.map((col, i) => ({
    column: col,
    values: result.matrix.columns.map((col2, j) => ({
      column: col2,
      coefficient: result.matrix.matrix[i][j],
      formatted: i === j ? '1.00' : result.matrix.matrix[i][j].toFixed(3)
    }))
  }));
  
  return {
    summary: result.summary,
    matrix: {
      columns: result.matrix.columns,
      rows: matrixRows
    },
    topCorrelations: result.pairs.slice(0, topN).map(p => ({
      pair: `${p.col1} ↔ ${p.col2}`,
      coefficient: p.coefficient,
      pValue: p.pValue < 0.001 ? '< 0.001' : p.pValue.toFixed(3),
      strength: 
        Math.abs(p.coefficient) >= 0.7 ? '强' :
        Math.abs(p.coefficient) >= 0.4 ? '中等' :
        Math.abs(p.coefficient) >= 0.2 ? '弱' : '极弱',
      direction: p.coefficient > 0 ? '正' : '负',
      interpretation: p.interpretation
    })),
    significantCorrelations: result.significantCorrelations.map(p => ({
      pair: `${p.col1} ↔ ${p.col2}`,
      coefficient: p.coefficient,
      interpretation: p.interpretation
    })),
    insights
  };
}