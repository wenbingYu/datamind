# @datamind/charts

DataMind 高级图表模块 - 支持 12 种图表类型、智能推荐、多格式导出

## 功能特性

### 🎨 12 种图表类型

| 基础图表 | 高级图表 |
|---------|---------|
| 柱状图 (bar) | 热力图 (heatmap) |
| 折线图 (line) | 雷达图 (radar) |
| 饼图 (pie) | 漏斗图 (funnel) |
| 散点图 (scatter) | 树图 (treemap) |
| | 桑基图 (sankey) |
| | 仪表盘 (gauge) |
| | 箱线图 (boxplot) |
| | K线图 (candlestick) |

### 🎭 8 种预设主题

- `default` - 默认蓝色专业风格
- `dark` - 深色科技风格
- `vintage` - 复古文艺风格
- `macarons` - 马卡龙柔和风格
- `shine` - 鲜明对比风格
- `roma` - 经典雅致风格
- `tech` - 科技蓝紫风格
- `forest` - 自然绿色风格

### 🤖 智能图表推荐

根据数据特征自动推荐最佳图表类型：

- 自动检测列类型（数值、分类、日期）
- 分析数据分布特征
- 推荐置信度评分
- 提供推荐理由

### 📤 多格式导出

- **PNG** - 高质量位图（需 Puppeteer）
- **SVG** - 矢量图形
- **PDF** - 文档格式（需 Puppeteer）
- **HTML** - 交互式网页
- **JSON** - ECharts 配置

## 快速开始

### 安装

```bash
npm install @datamind/charts
```

### 基础使用

```typescript
import { ChartGenerator, ChartRecommender, ChartExporter } from '@datamind/charts';

// 数据
const data = {
  columns: ['name', 'value'],
  rows: [['A', 100], ['B', 200], ['C', 150]],
  rowCount: 3
};

// 推荐图表
const recommender = new ChartRecommender();
const recommendations = recommender.recommend(data);
console.log(recommendations[0].type); // 'bar'

// 生成图表
const generator = new ChartGenerator('dark');
const chart = generator.generate(data, {
  type: 'bar',
  title: '销售数据'
});

// 导出图表
const exporter = new ChartExporter();
await exporter.export(chart, {
  format: 'html',
  filename: 'my-chart'
});
```

### 高级图表示例

```typescript
// 热力图
const heatmap = generator.generate(data, {
  type: 'heatmap',
  xColumn: 'weekday',
  yColumn: 'hour',
  valueColumn: 'visits'
});

// 雷达图
const radar = generator.generate(data, {
  type: 'radar',
  dimensions: ['skill', 'score'],
  shape: 'polygon',
  filled: true
});

// 漏斗图
const funnel = generator.generate(data, {
  type: 'funnel',
  stageColumn: 'stage',
  valueColumn: 'count',
  showConversionRate: true
});

// 桑基图
const sankey = generator.generate(data, {
  type: 'sankey',
  sourceColumn: 'from',
  targetColumn: 'to',
  valueColumn: 'amount'
});
```

## API 文档

### ChartGenerator

```typescript
class ChartGenerator {
  constructor(theme?: ChartTheme);
  
  generate(data: QueryResult, options: ChartOptions): ChartResult;
}
```

### ChartRecommender

```typescript
class ChartRecommender {
  recommend(data: QueryResult): ChartRecommendation[];
  analyzeData(data: QueryResult): DataAnalysis;
}
```

### ChartExporter

```typescript
class ChartExporter {
  export(chart: ChartResult, options: ExportOptions): Promise<string>;
  exportMultiple(chart: ChartResult, formats: ExportFormat[], options): Promise<Record<ExportFormat, string>>;
}
```

## 类型定义

```typescript
type ChartType = 
  | 'bar' | 'line' | 'pie' | 'scatter'
  | 'heatmap' | 'radar' | 'funnel' | 'treemap' 
  | 'sankey' | 'gauge' | 'boxplot' | 'candlestick';

type ChartTheme = 
  | 'default' | 'dark' | 'vintage' | 'macarons'
  | 'shine' | 'roma' | 'tech' | 'forest';

interface ChartOptions {
  type: ChartType;
  title?: string;
  theme?: ChartTheme;
  xColumn?: string;
  yColumn?: string;
  // ... 更多选项
}

interface ChartResult {
  config: Record<string, any>; // ECharts 配置
  type: ChartType;
  theme: ChartTheme;
  insights?: string[];
}
```

## 文件结构

```
datamind-charts/
├── index.ts          # 主入口
├── types.ts          # 类型定义
├── generator.ts      # 图表生成器
├── export.ts         # 导出功能
├── themes.ts         # 主题管理
├── recommender.ts    # 智能推荐
├── commands/         # CLI 命令
│   └── chart.ts
├── ui/               # Web UI 组件
│   └── chart-config.html
├── examples.ts       # 测试示例
├── package.json
├── INTEGRATION.md    # 集成指南
└── README.md         # 本文档
```

## 集成到 DataMind

详见 [INTEGRATION.md](./INTEGRATION.md)

## License

MIT