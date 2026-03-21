# DataMind

**智能数据分析助手 — 上传数据，用自然语言分析，无需 SQL/Python**

[![npm version](https://img.shields.io/npm/v/datamind.svg)](https://www.npmjs.com/package/datamind)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/wenbingYu/datamind.svg?style=social)](https://github.com/wenbingYu/datamind/stargazers)

## 功能特性

- 📊 **数据导入** — 支持 CSV、Excel、Parquet 格式
- 💬 **自然语言查询** — 用中文提问，自动生成 SQL 并执行
- 🔍 **自动洞察** — 智能发现数据中的趋势、异常和关联
- 📈 **可视化** — 自动生成图表，支持导出
- 📝 **报告生成** — 一键生成 Markdown 分析报告
- 🔒 **本地运行** — 数据不出域，隐私安全

## 快速开始

### 安装

```bash
npm install -g datamind
```

### 使用

```bash
# 导入数据
datamind import sales.csv

# 查询数据
datamind ask "上个月销售额最高的 Top 10 产品"

# 自动分析
datamind analyze

# 导出报告
datamind export report.md

# 启动 Web UI
datamind ui
```

## 文档

- [设计文档](./DESIGN.md) — 完整的产品设计和技术架构
- [安装指南](./docs/INSTALLATION.md) — 详细的安装步骤
- [快速教程](./docs/QUICK_START.md) — 5 分钟上手

## 开发

```bash
# 克隆仓库
git clone https://github.com/wenbingYu/datamind.git
cd datamind

# 安装依赖
npm install

# 构建
npm run build

# 开发模式
npm run dev
```

## 技术栈

- **数据引擎**: DuckDB — 嵌入式 OLAP 数据库
- **向量存储**: LanceDB — 轻量级向量数据库
- **LLM**: OpenAI 兼容 API (支持阿里云/智谱/本地模型)
- **图表**: ECharts
- **CLI**: Commander + TypeScript

## License

MIT © wembing