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
  /** 图表标题 */
  title?: string;
  /** 图表副标题 */
  subtitle?: string;
  /** 图表类型 */
  type: ChartType;
  /** 主题 */
  theme?: ChartTheme;
  /** 自定义颜色 */
  colors?: Partial<ChartColors>;
  /** 宽度 (px) */
  width?: number;
  /** 高度 (px) */
  height?: number;
  /** X 轴列名 */
  xColumn?: string;
  /** Y 轴列名 (可以是数组，用于多系列) */
  yColumn?: string | string[];
  /** 分组列 (用于热力图等) */
  categoryColumn?: string;
  /** 值列 (用于热力图等) */
  valueColumn?: string;
  /** 是否显示图例 */
  showLegend?: boolean;
  /** 是否显示工具栏 */
  showToolbox?: boolean;
  /** 是否启用动画 */
  animation?: boolean;
  /** 自定义 ECharts 配置 (会覆盖默认配置) */
  customConfig?: Record<string, any>;
}

/** 热力图特定配置 */
export interface HeatmapOptions extends ChartOptions {
  type: 'heatmap';
  /** X 轴维度列 */
  xColumn: string;
  /** Y 轴维度列 */
  yColumn: string;
  /** 值列 */
  valueColumn: string;
  /** 是否显示数值标签 */
  showLabels?: boolean;
  /** 颜色渐变范围 */
  colorRange?: [string, string];
}

/** 雷达图特定配置 */
export interface RadarOptions extends ChartOptions {
  type: 'radar';
  /** 维度列名数组 */
  dimensions?: string[];
  /** 指标列名数组 */
  metrics?: string[];
  /** 形状: polygon(多边形) | circle(圆形) */
  shape?: 'polygon' | 'circle';
  /** 是否填充区域 */
  filled?: boolean;
}

/** 漏斗图特定配置 */
export interface FunnelOptions extends ChartOptions {
  type: 'funnel';
  /** 阶段名称列 */
  stageColumn: string;
  /** 数值列 */
  valueColumn: string;
  /** 排序方式: descending(降序) | ascending(升序) | none(不排序) */
  sort?: 'descending' | 'ascending' | 'none';
  /** 对齐方式: left | center | right */
  align?: 'left' | 'center' | 'right';
  /** 是否显示转换率 */
  showConversionRate?: boolean;
}

/** 树图特定配置 */
export interface TreemapOptions extends ChartOptions {
  type: 'treemap';
  /** 名称列 */
  nameColumn: string;
  /** 父节点列 */
  parentColumn?: string;
  /** 值列 */
  valueColumn: string;
  /** 是否显示标签 */
  showLabels?: boolean;
  /** 叶子节点深度 */
  leafDepth?: number;
}

/** 桑基图特定配置 */
export interface SankeyOptions extends ChartOptions {
  type: 'sankey';
  /** 源节点列 */
  sourceColumn: string;
  /** 目标节点列 */
  targetColumn: string;
  /** 值列 */
  valueColumn: string;
  /** 节点宽度 */
  nodeWidth?: number;
  /** 节点间距 */
  nodeGap?: number;
  /** 布局迭代次数 */
  layoutIterations?: number;
}

/** 仪表盘特定配置 */
export interface GaugeOptions extends ChartOptions {
  type: 'gauge';
  /** 值列 */
  valueColumn: string;
  /** 最小值 */
  min?: number;
  /** 最大值 */
  max?: number;
  /** 分段阈值 */
  splits?: { value: number; color: string; label?: string }[];
  /** 单位 */
  unit?: string;
}

/** 箱线图特定配置 */
export interface BoxplotOptions extends ChartOptions {
  type: 'boxplot';
  /** 分组列 */
  groupColumn?: string;
  /** 值列 */
  valueColumn: string;
  /** 是否显示异常点 */
  showOutliers?: boolean;
}

/** K线图特定配置 */
export interface CandlestickOptions extends ChartOptions {
  type: 'candlestick';
  /** 开盘价列 */
  openColumn: string;
  /** 收盘价列 */
  closeColumn: string;
  /** 最低价列 */
  lowColumn: string;
  /** 最高价列 */
  highColumn: string;
  /** 日期/时间列 */
  dateColumn?: string;
  /** 成交量列 (可选) */
  volumeColumn?: string;
}

/** 图表导出格式 */
export type ExportFormat = 'png' | 'svg' | 'pdf' | 'html' | 'json';

/** 图表导出选项 */
export interface ExportOptions {
  /** 导出格式 */
  format: ExportFormat;
  /** 文件名 (不含扩展名) */
  filename?: string;
  /** 输出目录 */
  outputDir?: string;
  /** 图片宽度 (用于 png/svg/pdf) */
  width?: number;
  /** 图片高度 (用于 png/svg/pdf) */
  height?: number;
  /** 图片质量 (用于 png, 1-100) */
  quality?: number;
  /** 背景色 */
  backgroundColor?: string;
  /** 是否包含标题 */
  includeTitle?: boolean;
  /** 是否包含水印 */
  watermark?: string;
}

/** 图表生成结果 */
export interface ChartResult {
  /** ECharts 配置对象 */
  config: Record<string, any>;
  /** 图表类型 */
  type: ChartType;
  /** 图表主题 */
  theme: ChartTheme;
  /** 推荐的导出格式 */
  recommendedExport: ExportFormat[];
  /** 图表说明 */
  description?: string;
  /** 数据洞察 */
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