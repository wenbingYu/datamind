/**
 * DataMind 高级图表类型定义
 */

/** 基础图表类型 */
export type BasicChartType = 'bar' | 'line' | 'pie' | 'scatter';

/** 高级图表类型 */
export type AdvancedChartType = 
  | 'heatmap'    // 热力图
  | 'radar'      // 雷达图
  | 'funnel'     // 漏斗图
  | 'treemap'    // 树图
  | 'sankey'     // 桑基图
  | 'gauge'      // 仪表盘
  | 'boxplot'    // 箱线图
  | 'candlestick'; // K线图

/** 所有支持的图表类型 */
export type ChartType = BasicChartType | AdvancedChartType;

/** 图表主题 */
export type ChartTheme = 
  | 'default'    // 默认蓝色主题
  | 'dark'       // 深色主题
  | 'vintage'    // 复古主题
  | 'macarons'   // 马卡龙主题
  | 'shine'      // 闪耀主题
  | 'roma'       // 罗马主题
  | 'tech'       // 科技主题
  | 'forest'     // 森林主题
  | 'custom';    // 自定义主题

/** 图表颜色配置 */
export interface ChartColors {
  primary: string;
  secondary: string;
  accent: string[];
  background: string;
  text: string;
  grid: string;
}

/** 图表配置选项 */
export interface ChartOptions {
  title?: string;
  subtitle?: string;
  type: ChartType;
  theme?: ChartTheme;
  colors?: Partial<ChartColors>;
  width?: number;
  height?: number;
  xColumn?: string;
  yColumn?: string | string[];
  categoryColumn?: string;
  valueColumn?: string;
  showLegend?: boolean;
  showToolbox?: boolean;
  animation?: boolean;
  customConfig?: Record<string, any>;
}

/** 图表导出格式 */
export type ExportFormat = 'png' | 'svg' | 'pdf' | 'html' | 'json';

/** 图表导出选项 */
export interface ExportOptions {
  format: ExportFormat;
  filename?: string;
  outputDir?: string;
  width?: number;
  height?: number;
  quality?: number;
  backgroundColor?: string;
  includeTitle?: boolean;
  watermark?: string;
}

/** 图表生成结果 */
export interface ChartResult {
  config: Record<string, any>;
  type: ChartType;
  theme: ChartTheme;
  recommendedExport: ExportFormat[];
  description?: string;
  insights?: string[];
}

/** 预设主题配置 */
export const CHART_THEMES: Record<ChartTheme, Partial<ChartColors>> = {
  default: {
    primary: '#5470c6',
    secondary: '#91cc75',
    accent: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4'],
    background: '#ffffff',
    text: '#333333',
    grid: '#cccccc'
  },
  dark: {
    primary: '#4992ff',
    secondary: '#7cffb2',
    accent: ['#4992ff', '#7cffb2', '#fddd60', '#ff6e76', '#58d9f9', '#05c091', '#ff8a45', '#8d48e3'],
    background: '#1a1a1a',
    text: '#ffffff',
    grid: '#333333'
  },
  vintage: {
    primary: '#d87c7c',
    secondary: '#919e8b',
    accent: ['#d87c7c', '#919e8b', '#d7ab82', '#6e7074', '#61a0a8', '#efa18d', '#787464', '#cc7e63'],
    background: '#fef8ef',
    text: '#333333',
    grid: '#e0e0e0'
  },
  macarons: {
    primary: '#2ec7c9',
    secondary: '#b6a2de',
    accent: ['#2ec7c9', '#b6a2de', '#5ab1ef', '#ffb980', '#d87a80', '#8d98b3', '#e5cf0d', '#97b552'],
    background: '#ffffff',
    text: '#333333',
    grid: '#e0e0e0'
  },
  shine: {
    primary: '#c12e34',
    secondary: '#e6b600',
    accent: ['#c12e34', '#e6b600', '#0098d9', '#2b821d', '#005eaa', '#339ca8', '#cda819', '#26a0c0'],
    background: '#ffffff',
    text: '#333333',
    grid: '#e0e0e0'
  },
  roma: {
    primary: '#e01f54',
    secondary: '#001852',
    accent: ['#e01f54', '#001852', '#f5e8c8', '#b8d2c7', '#c6b38e', '#a4dde8', '#f0d5a3', '#d7b98e'],
    background: '#ffffff',
    text: '#333333',
    grid: '#e0e0e0'
  },
  tech: {
    primary: '#00f0ff',
    secondary: '#7b2cff',
    accent: ['#00f0ff', '#7b2cff', '#00ff88', '#ff00aa', '#ffaa00', '#00aaff', '#ff5500', '#aa00ff'],
    background: '#0a0a1a',
    text: '#e0e0e0',
    grid: '#1a1a3a'
  },
  forest: {
    primary: '#3ba272',
    secondary: '#91cc75',
    accent: ['#3ba272', '#91cc75', '#5470c6', '#73c0de', '#fc8452', '#9a60b4', '#ea7ccc', '#fac858'],
    background: '#f5f9f5',
    text: '#2d3a2d',
    grid: '#d0e0d0'
  },
  custom: {}
};

/** 图表类型与数据要求的映射 */
export const CHART_DATA_REQUIREMENTS: Record<ChartType, {
  minColumns: number;
  maxColumns?: number;
  requiredColumns: string[];
  description: string;
}> = {
  bar: { minColumns: 1, requiredColumns: ['x', 'y'], description: '柱状图，适合展示分类数据的比较' },
  line: { minColumns: 2, requiredColumns: ['x', 'y'], description: '折线图，适合展示时间序列或连续数据趋势' },
  pie: { minColumns: 2, requiredColumns: ['name', 'value'], description: '饼图，适合展示占比分布' },
  scatter: { minColumns: 2, requiredColumns: ['x', 'y'], description: '散点图，适合展示两个变量的关系' },
  heatmap: { minColumns: 3, requiredColumns: ['x', 'y', 'value'], description: '热力图，适合展示二维数据的密度分布' },
  radar: { minColumns: 3, requiredColumns: ['dimensions', 'values'], description: '雷达图，适合多维度数据对比' },
  funnel: { minColumns: 2, requiredColumns: ['stage', 'value'], description: '漏斗图，适合展示流程转化' },
  treemap: { minColumns: 2, requiredColumns: ['name', 'value'], description: '树图，适合展示层级数据的占比' },
  sankey: { minColumns: 3, requiredColumns: ['source', 'target', 'value'], description: '桑基图，适合展示流向关系' },
  gauge: { minColumns: 1, requiredColumns: ['value'], description: '仪表盘，适合展示单个指标值' },
  boxplot: { minColumns: 1, requiredColumns: ['values'], description: '箱线图，适合展示数据分布和异常值' },
  candlestick: { minColumns: 4, requiredColumns: ['open', 'close', 'low', 'high'], description: 'K线图，适合展示股票等金融数据' }
};