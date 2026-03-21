/**
 * 时间序列预测模块
 * Time Series Forecasting Module
 * 
 * 实现功能:
 * - 移动平均预测 (Moving Average)
 * - 指数平滑 (Exponential Smoothing - Single, Double, Triple)
 * - 趋势分析 (Trend Analysis)
 * - 季节性检测 (Seasonality Detection)
 */

// ==================== 类型定义 ====================

export interface TimeSeriesPoint {
  timestamp: number | Date;
  value: number;
}

export interface ForecastResult {
  predictions: TimeSeriesPoint[];
  confidenceInterval: {
    lower: number[];
    upper: number[];
  };
  method: string;
  accuracy?: {
    mape?: number;  // Mean Absolute Percentage Error
    mae?: number;   // Mean Absolute Error
    rmse?: number;  // Root Mean Square Error
  };
  trend?: {
    direction: 'up' | 'down' | 'stable';
    strength: number;
    slope: number;
  };
  seasonality?: {
    detected: boolean;
    period?: number;
    strength?: number;
  };
}

export interface ForecastOptions {
  horizon: number;           // 预测步数
  windowSize?: number;       // 移动平均窗口大小
  alpha?: number;            // 简单指数平滑参数 (0-1)
  beta?: number;             // 双指数平滑趋势参数 (0-1)
  gamma?: number;            // 三指数平滑季节参数 (0-1)
  confidenceLevel?: number;  // 置信区间水平 (默认 0.95)
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

function linearRegression(x: number[], y: number[]): { slope: number; intercept: number; r2: number } {
  const n = Math.min(x.length, y.length);
  if (n < 2) return { slope: 0, intercept: mean(y), r2: 0 };
  
  const sumX = x.slice(0, n).reduce((s, v) => s + v, 0);
  const sumY = y.slice(0, n).reduce((s, v) => s + v, 0);
  const sumXY = x.slice(0, n).reduce((s, v, i) => s + v * y[i], 0);
  const sumX2 = x.slice(0, n).reduce((s, v) => s + v * v, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // R² 计算
  const yMean = sumY / n;
  const ssTotal = y.slice(0, n).reduce((s, v) => s + Math.pow(v - yMean, 2), 0);
  const ssResidual = y.slice(0, n).reduce((s, v, i) => s + Math.pow(v - (slope * x[i] + intercept), 2), 0);
  const r2 = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;
  
  return { slope: isNaN(slope) ? 0 : slope, intercept, r2 };
}

// ==================== 移动平均预测 ====================

export function movingAverageForecast(
  data: number[],
  options: ForecastOptions
): ForecastResult {
  const window = options.windowSize || Math.min(Math.floor(data.length / 3), 10);
  const horizon = options.horizon;
  const confidenceLevel = options.confidenceLevel || 0.95;
  
  if (data.length < window) {
    throw new Error(`数据点数量 (${data.length}) 少于窗口大小 (${window})`);
  }
  
  // 计算移动平均
  const movingAvgs: number[] = [];
  for (let i = window - 1; i < data.length; i++) {
    const windowData = data.slice(i - window + 1, i + 1);
    movingAvgs.push(mean(windowData));
  }
  
  // 最后一个移动平均作为预测基础
  const lastMA = movingAvgs[movingAvgs.length - 1];
  
  // 生成预测
  const predictions: number[] = [];
  for (let i = 0; i < horizon; i++) {
    predictions.push(lastMA);
  }
  
  // 计算置信区间
  const residuals = data.slice(window - 1).map((v, i) => v - movingAvgs[i]);
  const residualStd = stdDev(residuals);
  const zScore = confidenceLevel === 0.95 ? 1.96 : confidenceLevel === 0.90 ? 1.645 : 1.96;
  
  const lower = predictions.map(p => p - zScore * residualStd);
  const upper = predictions.map(p => p + zScore * residualStd);
  
  // 计算准确性指标
  const mae = mean(residuals.map(Math.abs));
  const mape = mean(residuals.map((r, i) => 
    data[window - 1 + i] !== 0 ? Math.abs(r / data[window - 1 + i]) * 100 : 0
  ));
  const rmse = Math.sqrt(mean(residuals.map(r => r * r)));
  
  // 趋势分析
  const trend = analyzeTrend(data);
  
  return {
    predictions: predictions.map((v, i) => ({
      timestamp: i,
      value: v
    })),
    confidenceInterval: { lower, upper },
    method: `移动平均 (窗口=${window})`,
    accuracy: { mae, mape, rmse },
    trend
  };
}

// ==================== 指数平滑预测 ====================

/**
 * 简单指数平滑 (Single Exponential Smoothing)
 * 适用于无趋势、无季节性的数据
 */
export function singleExponentialSmoothing(
  data: number[],
  options: ForecastOptions
): ForecastResult {
  const alpha = options.alpha ?? 0.3;
  const horizon = options.horizon;
  const confidenceLevel = options.confidenceLevel || 0.95;
  
  if (data.length < 2) {
    throw new Error('简单指数平滑至少需要 2 个数据点');
  }
  
  // 计算 SES
  const smoothed: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    smoothed.push(alpha * data[i] + (1 - alpha) * smoothed[i - 1]);
  }
  
  // 预测值（最后一个平滑值）
  const forecast = smoothed[smoothed.length - 1];
  const predictions = Array(horizon).fill(forecast);
  
  // 计算残差和置信区间
  const residuals = data.map((v, i) => v - smoothed[i]);
  const residualStd = stdDev(residuals);
  const zScore = confidenceLevel === 0.95 ? 1.96 : 1.645;
  
  const lower = predictions.map(p => p - zScore * residualStd);
  const upper = predictions.map(p => p + zScore * residualStd);
  
  // 准确性指标
  const mae = mean(residuals.map(Math.abs));
  const mape = mean(residuals.map((r, i) => data[i] !== 0 ? Math.abs(r / data[i]) * 100 : 0));
  const rmse = Math.sqrt(mean(residuals.map(r => r * r)));
  
  return {
    predictions: predictions.map((v, i) => ({ timestamp: i, value: v })),
    confidenceInterval: { lower, upper },
    method: `简单指数平滑 (α=${alpha.toFixed(2)})`,
    accuracy: { mae, mape, rmse },
    trend: analyzeTrend(data)
  };
}

/**
 * 双指数平滑 (Double Exponential Smoothing - Holt's Method)
 * 适用于有趋势、无季节性的数据
 */
export function doubleExponentialSmoothing(
  data: number[],
  options: ForecastOptions
): ForecastResult {
  const alpha = options.alpha ?? 0.3;
  const beta = options.beta ?? 0.1;
  const horizon = options.horizon;
  const confidenceLevel = options.confidenceLevel || 0.95;
  
  if (data.length < 3) {
    throw new Error('双指数平滑至少需要 3 个数据点');
  }
  
  // 初始化
  const level: number[] = [data[0]];
  const trend: number[] = [data[1] - data[0]];
  
  // Holt 方法
  for (let i = 1; i < data.length; i++) {
    const newLevel = alpha * data[i] + (1 - alpha) * (level[i - 1] + trend[i - 1]);
    const newTrend = beta * (newLevel - level[i - 1]) + (1 - beta) * trend[i - 1];
    level.push(newLevel);
    trend.push(newTrend);
  }
  
  // 预测
  const lastLevel = level[level.length - 1];
  const lastTrend = trend[trend.length - 1];
  const predictions: number[] = [];
  for (let i = 0; i < horizon; i++) {
    predictions.push(lastLevel + (i + 1) * lastTrend);
  }
  
  // 残差和置信区间
  const fitted = level.map((l, i) => l + (i > 0 ? trend[i - 1] : 0));
  const residuals = data.map((v, i) => v - fitted[i]);
  const residualStd = stdDev(residuals);
  const zScore = confidenceLevel === 0.95 ? 1.96 : 1.645;
  
  const lower = predictions.map((p, i) => p - zScore * residualStd * Math.sqrt(1 + i * 0.1));
  const upper = predictions.map((p, i) => p + zScore * residualStd * Math.sqrt(1 + i * 0.1));
  
  // 准确性指标
  const mae = mean(residuals.map(Math.abs));
  const mape = mean(residuals.map((r, i) => data[i] !== 0 ? Math.abs(r / data[i]) * 100 : 0));
  const rmse = Math.sqrt(mean(residuals.map(r => r * r)));
  
  return {
    predictions: predictions.map((v, i) => ({ timestamp: i, value: v })),
    confidenceInterval: { lower, upper },
    method: `双指数平滑 (α=${alpha.toFixed(2)}, β=${beta.toFixed(2)})`,
    accuracy: { mae, mape, rmse },
    trend: {
      direction: lastTrend > 0.01 ? 'up' : lastTrend < -0.01 ? 'down' : 'stable',
      strength: Math.abs(lastTrend) / lastLevel,
      slope: lastTrend
    }
  };
}

/**
 * 三指数平滑 (Triple Exponential Smoothing - Holt-Winters)
 * 适用于有趋势和季节性的数据
 */
export function tripleExponentialSmoothing(
  data: number[],
  period: number,
  options: ForecastOptions
): ForecastResult {
  const alpha = options.alpha ?? 0.2;
  const beta = options.beta ?? 0.1;
  const gamma = options.gamma ?? 0.1;
  const horizon = options.horizon;
  const confidenceLevel = options.confidenceLevel || 0.95;
  
  if (data.length < period * 2) {
    // 数据不足，退回到双指数平滑
    return doubleExponentialSmoothing(data, options);
  }
  
  // 初始化季节因子
  const seasonalFactors: number[] = [];
  const numSeasons = Math.floor(data.length / period);
  
  // 计算初始季节因子
  for (let i = 0; i < period; i++) {
    let sum = 0;
    let count = 0;
    for (let j = i; j < data.length; j += period) {
      sum += data[j];
      count++;
    }
    seasonalFactors.push(sum / count);
  }
  
  // 标准化季节因子
  const avgFactor = mean(seasonalFactors);
  for (let i = 0; i < period; i++) {
    seasonalFactors[i] /= avgFactor;
  }
  
  // 初始化 level 和 trend
  const level = data[0] / seasonalFactors[0];
  const trend = (data[period] / seasonalFactors[period] - data[0] / seasonalFactors[0]) / period;
  
  const levels: number[] = [level];
  const trends: number[] = [trend];
  const seasons: number[] = [...seasonalFactors];
  
  // Holt-Winters 递推
  for (let i = 1; i < data.length; i++) {
    const seasonIdx = i % period;
    
    const newLevel = alpha * (data[i] / seasons[seasonIdx]) + (1 - alpha) * (levels[i - 1] + trends[i - 1]);
    const newTrend = beta * (newLevel - levels[i - 1]) + (1 - beta) * trends[i - 1];
    const newSeason = gamma * (data[i] / newLevel) + (1 - gamma) * seasons[seasonIdx];
    
    levels.push(newLevel);
    trends.push(newTrend);
    seasons[seasonIdx] = newSeason;
  }
  
  // 预测
  const lastLevel = levels[levels.length - 1];
  const lastTrend = trends[trends.length - 1];
  const predictions: number[] = [];
  
  for (let i = 0; i < horizon; i++) {
    const seasonIdx = (data.length + i) % period;
    predictions.push((lastLevel + (i + 1) * lastTrend) * seasons[seasonIdx]);
  }
  
  // 计算拟合值和残差
  const fitted: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const seasonIdx = i % period;
    fitted.push((levels[i] + trends[i]) * seasons[seasonIdx]);
  }
  
  const residuals = data.map((v, i) => v - fitted[i]);
  const residualStd = stdDev(residuals);
  const zScore = confidenceLevel === 0.95 ? 1.96 : 1.645;
  
  const lower = predictions.map((p, i) => p - zScore * residualStd * Math.sqrt(1 + i * 0.05));
  const upper = predictions.map((p, i) => p + zScore * residualStd * Math.sqrt(1 + i * 0.05));
  
  // 准确性指标
  const mae = mean(residuals.map(Math.abs));
  const mape = mean(residuals.map((r, i) => data[i] !== 0 ? Math.abs(r / data[i]) * 100 : 0));
  const rmse = Math.sqrt(mean(residuals.map(r => r * r)));
  
  return {
    predictions: predictions.map((v, i) => ({ timestamp: i, value: v })),
    confidenceInterval: { lower, upper },
    method: `三指数平滑 (α=${alpha.toFixed(2)}, β=${beta.toFixed(2)}, γ=${gamma.toFixed(2)}, 周期=${period})`,
    accuracy: { mae, mape, rmse },
    trend: {
      direction: lastTrend > 0.01 ? 'up' : lastTrend < -0.01 ? 'down' : 'stable',
      strength: Math.abs(lastTrend) / lastLevel,
      slope: lastTrend
    },
    seasonality: {
      detected: true,
      period,
      strength: Math.sqrt(variance(seasons) / variance(data))
    }
  };
}

// ==================== 趋势分析 ====================

export function analyzeTrend(data: number[]): ForecastResult['trend'] {
  if (data.length < 3) {
    return { direction: 'stable', strength: 0, slope: 0 };
  }
  
  const x = data.map((_, i) => i);
  const { slope, r2 } = linearRegression(x, data);
  
  // 判断趋势方向
  const avgValue = mean(data);
  const relativeSlope = slope / avgValue;
  
  let direction: 'up' | 'down' | 'stable';
  if (relativeSlope > 0.01) {
    direction = 'up';
  } else if (relativeSlope < -0.01) {
    direction = 'down';
  } else {
    direction = 'stable';
  }
  
  return {
    direction,
    strength: Math.abs(r2),
    slope
  };
}

// ==================== 季节性检测 ====================

export function detectSeasonality(data: number[]): { detected: boolean; period: number; strength: number } {
  const n = data.length;
  
  if (n < 10) {
    return { detected: false, period: 0, strength: 0 };
  }
  
  // 使用自相关方法检测季节性
  const avg = mean(data);
  const variance = data.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / n;
  
  if (variance === 0) {
    return { detected: false, period: 0, strength: 0 };
  }
  
  // 计算不同滞后期的自相关
  const maxLag = Math.min(Math.floor(n / 3), 52); // 最大滞后
  const autocorrelations: number[] = [];
  
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = lag; i < n; i++) {
      sum += (data[i] - avg) * (data[i - lag] - avg);
    }
    autocorrelations.push(sum / (n * variance));
  }
  
  // 找到最大的自相关（滞后 > 1）
  let maxCorr = 0;
  let bestPeriod = 0;
  
  for (let i = 1; i < autocorrelations.length; i++) {
    if (autocorrelations[i] > maxCorr && autocorrelations[i] > 0.3) {
      maxCorr = autocorrelations[i];
      bestPeriod = i + 1;
    }
  }
  
  // 季节性强度
  const strength = maxCorr;
  
  return {
    detected: strength > 0.3 && bestPeriod > 1,
    period: bestPeriod,
    strength
  };
}

// ==================== 自动选择最佳方法 ====================

export function autoForecast(
  data: number[],
  options: ForecastOptions = { horizon: 5 }
): ForecastResult {
  if (data.length < 3) {
    throw new Error('预测至少需要 3 个数据点');
  }
  
  const { detected: hasSeasonality, period, strength } = detectSeasonality(data);
  const trend = analyzeTrend(data);
  
  let result: ForecastResult;
  
  // 根据数据特征选择方法
  if (hasSeasonality && period > 1 && data.length >= period * 2) {
    // 有季节性 -> 三指数平滑
    result = tripleExponentialSmoothing(data, period, options);
  } else if (trend && trend.direction !== 'stable' && trend.strength > 0.1) {
    // 有趋势 -> 双指数平滑
    result = doubleExponentialSmoothing(data, options);
  } else {
    // 无明显特征 -> 尝试多种方法，选择最佳
    const methods = [
      { name: 'MA', result: movingAverageForecast(data, options) },
      { name: 'SES', result: singleExponentialSmoothing(data, options) },
      { name: 'DES', result: doubleExponentialSmoothing(data, options) }
    ];
    
    // 选择 MAPE 最低的方法
    methods.sort((a, b) => (a.result.accuracy?.mape || Infinity) - (b.result.accuracy?.mape || Infinity));
    result = methods[0].result;
  }
  
  // 添加季节性信息
  if (hasSeasonality) {
    result.seasonality = { detected: true, period, strength };
  }
  
  return result;
}

// ==================== 输出格式化 ====================

export interface ForecastReport {
  summary: {
    method: string;
    dataPoints: number;
    horizon: number;
    trendDirection: string;
    trendStrength: string;
    seasonality: string;
  };
  predictions: {
    period: number;
    value: number;
    lower: number;
    upper: number;
  }[];
  accuracy?: {
    mape: string;
    mae: string;
    rmse: string;
  };
  insights: string[];
}

export function formatForecastReport(
  data: number[],
  result: ForecastResult
): ForecastReport {
  const trend = result.trend;
  const seasonality = result.seasonality;
  
  const insights: string[] = [];
  
  // 趋势洞察
  if (trend && trend.direction !== 'stable') {
    const trendDesc = trend.direction === 'up' ? '上升' : '下降';
    insights.push(`数据呈现${trendDesc}趋势，斜率为 ${trend.slope.toFixed(4)}`);
  } else if (trend) {
    insights.push(`数据趋势平稳，斜率为 ${trend.slope.toFixed(4)}`);
  }
  
  // 季节性洞察
  if (seasonality?.detected) {
    insights.push(`检测到季节性模式，周期约为 ${seasonality.period} 个时间单位，强度 ${((seasonality.strength || 0) * 100).toFixed(1)}%`);
  }
  
  // 准确性洞察
  if (result.accuracy && result.accuracy.mape !== undefined) {
    const mape = result.accuracy.mape;
    if (mape < 10) {
      insights.push(`预测准确性较高，MAPE = ${mape.toFixed(2)}%`);
    } else if (mape < 20) {
      insights.push(`预测准确性中等，MAPE = ${mape.toFixed(2)}%`);
    } else {
      insights.push(`预测准确性较低，MAPE = ${mape.toFixed(2)}%，建议增加历史数据或选择其他模型`);
    }
  }
  
  // 预测方向洞察
  const firstPrediction = result.predictions[0]?.value || 0;
  const lastPrediction = result.predictions[result.predictions.length - 1]?.value || 0;
  if (Math.abs(lastPrediction - firstPrediction) > 0.01 * Math.abs(firstPrediction)) {
    const direction = lastPrediction > firstPrediction ? '增长' : '下降';
    const changePercent = Math.abs((lastPrediction - firstPrediction) / firstPrediction * 100);
    insights.push(`预测期内预计${direction} ${changePercent.toFixed(1)}%`);
  }
  
  return {
    summary: {
      method: result.method,
      dataPoints: data.length,
      horizon: result.predictions.length,
      trendDirection: trend?.direction || 'stable',
      trendStrength: trend ? `${(trend.strength * 100).toFixed(1)}%` : 'N/A',
      seasonality: seasonality?.detected ? `周期 ${seasonality.period}` : '未检测到'
    },
    predictions: result.predictions.map((p, i) => ({
      period: i + 1,
      value: p.value,
      lower: result.confidenceInterval.lower[i],
      upper: result.confidenceInterval.upper[i]
    })),
    accuracy: result.accuracy ? {
      mape: result.accuracy.mape !== undefined ? `${result.accuracy.mape.toFixed(2)}%` : 'N/A',
      mae: result.accuracy.mae !== undefined ? result.accuracy.mae.toFixed(4) : 'N/A',
      rmse: result.accuracy.rmse !== undefined ? result.accuracy.rmse.toFixed(4) : 'N/A'
    } : undefined,
    insights
  };
}