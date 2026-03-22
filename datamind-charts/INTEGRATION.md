# DataMind 高级图表模块集成指南

## 概述

本模块为 DataMind 添加高级图表功能，包括：

- **12种图表类型**: bar, line, pie, scatter, heatmap, radar, funnel, treemap, sankey, gauge, boxplot, candlestick
- **8种预设主题**: default, dark, vintage, macarons, shine, roma, tech, forest
- **智能图表推荐**: 根据数据特征自动推荐最佳图表类型
- **多格式导出**: PNG, SVG, PDF, HTML, JSON

## 安装

### 方法 1: 自动安装 (推荐)

```bash
# 首先修复权限
sudo chown -R $(whoami):staff /Users/wenbing/.openclaw/workspace/projects/datamind

# 运行安装脚本
chmod +x /Users/wenbing/.openclaw/workspace/datamind-charts/install.sh
./install.sh
```

### 方法 2: 手动安装

```bash
# 1. 创建目录
mkdir -p /Users/wenbing/.openclaw/workspace/projects/datamind/src/charts

# 2. 复制文件
cp /Users/wenbing/.openclaw/workspace/datamind-charts/*.ts \
   /Users/wenbing/.openclaw/workspace/projects/datamind/src/charts/

# 3. 复制 CLI 命令
mkdir -p /Users/wenbing/.openclaw/workspace/projects/datamind/src/cli/commands
cp /Users/wenbing/.openclaw/workspace/datamind-charts/commands/chart.ts \
   /Users/wenbing/.openclaw/workspace/projects/datamind/src/cli/commands/
```

## 集成步骤

### 1. 更新 CLI 入口 (src/cli/index.ts)

```typescript
#!/usr/bin/env node

import { Command } from 'commander';
// ... 其他导入 ...

// 添加图表命令
import { chartCommand, listChartTypes, listThemes } from './commands/chart';

const program = new Command();

// ... 其他命令 ...

// 图表命令
program
  .command('chart <table>')
  .description('生成高级图表')
  .option('-t, --type <type>', '图表类型 (bar/line/pie/scatter/heatmap/radar/funnel/treemap/sankey/gauge/boxplot/candlestick)')
  .option('-o, --output <path>', '输出文件路径')
  .option('-f, --format <format>', '导出格式 (png/svg/pdf/html/json)', 'html')
  .option('--theme <theme>', '主题 (default/dark/vintage/macarons/shine/roma/tech/forest)', 'default')
  .option('--title <title>', '图表标题')
  .option('--x <column>', 'X轴列名')
  .option('--y <column>', 'Y轴列名')
  .option('--width <pixels>', '宽度', parseInt, 800)
  .option('--height <pixels>', '高度', parseInt, 600)
  .action(chartCommand);

// 图表类型列表
program
  .command('chart-types')
  .description('显示支持的图表类型')
  .action(listChartTypes);

// 主题列表
program
  .command('chart-themes')
  .description('显示支持的主题')
  .action(listThemes);

program.parse();
```

### 2. 更新 Web UI API (src/cli/commands/ui.ts)

添加图表相关 API 端点：

```typescript
import { ChartGenerator, ChartRecommender, ChartExporter } from '../../charts';

// ... 在 api 路由中添加 ...

// POST /api/chart/recommend - 推荐图表类型
api.post('/chart/recommend', async (req, res) => {
  try {
    const { data } = req.body;
    const recommender = new ChartRecommender();
    const recommendations = recommender.recommend(data);
    
    res.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// POST /api/chart/generate - 生成图表
api.post('/chart/generate', async (req, res) => {
  try {
    const { data, config } = req.body;
    const generator = new ChartGenerator(config.theme || 'default');
    const chart = generator.generate(data, config);
    
    res.json({
      success: true,
      data: chart.config
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// POST /api/chart/export - 导出图表
api.post('/chart/export', async (req, res) => {
  try {
    const { chartConfig, format, filename } = req.body;
    const exporter = new ChartExporter();
    
    const chart = { config: chartConfig, type: 'custom', theme: 'default' };
    const path = await exporter.export(chart, { format, filename });
    
    if (format === 'png' || format === 'svg' || format === 'pdf') {
      // 返回文件
      res.download(path);
    } else {
      res.json({ success: true, path });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});
```

### 3. 更新 Web UI 前端 (src/ui/public/index.html)

将 `ui/chart-config.html` 中的样式和脚本集成到主 HTML 文件中。

## 使用示例

### CLI 使用

```bash
# 自动推荐图表
datamind chart sales

# 指定图表类型
datamind chart sales --type heatmap

# 使用深色主题
datamind chart sales --type line --theme dark

# 导出为 PNG
datamind chart sales --type bar --format png --output ./my-chart.png

# 查看支持的图表类型
datamind chart-types

# 查看支持的主题
datamind chart-themes
```

### API 使用

```bash
# 推荐图表
curl -X POST http://localhost:3000/api/chart/recommend \
  -H "Content-Type: application/json" \
  -d '{"data": {"columns": ["name", "value"], "rows": [["A", 100], ["B", 200]], "rowCount": 2}}'

# 生成图表
curl -X POST http://localhost:3000/api/chart/generate \
  -H "Content-Type: application/json" \
  -d '{"data": {...}, "config": {"type": "bar", "theme": "dark"}}'
```

### 代码使用

```typescript
import { ChartGenerator, ChartRecommender, ChartExporter } from './charts';

// 数据
const data = {
  columns: ['product', 'sales', 'region'],
  rows: [
    ['iPhone', 1000, 'East'],
    ['MacBook', 800, 'West'],
    ['iPad', 600, 'North']
  ],
  rowCount: 3
};

// 推荐图表
const recommender = new ChartRecommender();
const recommendations = recommender.recommend(data);
console.log('推荐:', recommendations[0]);

// 生成图表
const generator = new ChartGenerator('dark');
const chart = generator.generate(data, {
  type: 'heatmap',
  xColumn: 'product',
  yColumn: 'region',
  valueColumn: 'sales'
});

// 导出图表
const exporter = new ChartExporter();
await exporter.export(chart, {
  format: 'html',
  filename: 'my-heatmap',
  outputDir: './output'
});
```

## 图表类型说明

| 类型 | 图标 | 适用场景 | 数据要求 |
|------|------|----------|----------|
| bar | 📊 | 分类比较 | 1+ 分类 + 1+ 数值 |
| line | 📈 | 时间趋势 | 时间 + 数值 |
| pie | 🥧 | 占比分布 | 分类 + 数值 (≤8类) |
| scatter | ⚬ | 变量关系 | 2 数值 |
| heatmap | 🌡️ | 二维密度 | 2 分类 + 1 数值 |
| radar | 🕸️ | 多维对比 | 3+ 数值 |
| funnel | 🔺 | 流程转化 | 阶段 + 数值 |
| treemap | 🌳 | 层级占比 | 名称 + 数值 |
| sankey | 🌊 | 流向关系 | 源 + 目标 + 值 |
| gauge | ⏱️ | 单指标 | 1 数值 |
| boxplot | 📦 | 分布分析 | 1+ 数值 |
| candlestick | 📈 | 金融数据 | 开高低收 |

## 主题说明

| 主题 | 风格 | 适用场景 |
|------|------|----------|
| default | 蓝色专业 | 通用商务 |
| dark | 深色科技 | 演示/技术 |
| vintage | 复古文艺 | 报告/设计 |
| macarons | 柔和多彩 | 生活/教育 |
| shine | 鲜明对比 | 重点展示 |
| roma | 经典雅致 | 传统行业 |
| tech | 科技蓝紫 | 科技产品 |
| forest | 自然绿 | 环保/健康 |

## 故障排除

### 权限问题

```bash
# 修复目录权限
sudo chown -R $(whoami):staff /Users/wenbing/.openclaw/workspace/projects/datamind
```

### 编译错误

```bash
# 清理并重新编译
cd /Users/wenbing/.openclaw/workspace/projects/datamind
rm -rf dist node_modules
npm install
npm run build
```

### 类型错误

确保 `tsconfig.json` 包含正确的配置：

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```