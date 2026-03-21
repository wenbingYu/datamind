# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-03-22

### Added - Phase 4 商业化功能

#### 高级图表模块 (`src/charts/`)
- **12种图表类型**: bar, line, pie, scatter, heatmap, radar, funnel, treemap, sankey, gauge, boxplot, candlestick
- **8种预设主题**: default, dark, vintage, macarons, shine, roma, tech, forest
- **智能图表推荐**: 根据数据特征自动推荐最佳图表类型
- **多格式导出**: HTML, JSON, SVG
- **CLI**: `datamind chart <table> --recommend` 或 `datamind chart <table> -t heatmap`

#### 高级分析引擎 (`src/analyzer/`)
- **时间序列预测**: 移动平均、指数平滑（单/双/三）、趋势分析、季节性检测
- **异常检测**: Z-Score、IQR、MAD、移动窗口、K-Means
- **关联分析**: Apriori 算法、支持度/置信度/提升度计算
- **相关性分析**: Pearson、Spearman 相关系数
- **CLI**: `datamind analyze <table> --forecast/--anomaly/--association/--correlation`

#### API 服务增强 (`src/ui/`)
- **API Key 管理**: 生成、验证、撤销、列出
- **请求限流**: free(10/min)、pro(100/min)、team(500/min)
- **认证中间件**: API Key 验证、可选认证
- **新增端点**: /api/keys, /api/chart, /api/forecast, /api/anomaly, /api/association
- **CLI**: `datamind key generate/list/revoke`, `datamind serve --auth`

#### 配置增强
- **自定义数据目录**: 支持 `DATAMIND_HOME` 环境变量
- **本地优先**: 所有数据本地处理，数据不出域

## [1.0.0] - 2026-03-21

### Added

#### CLI Commands
- `datamind import <file>` - Import CSV data files with automatic type inference
- `datamind list` - List all imported data tables
- `datamind ask "<question>"` - Natural language to SQL query with results
- `datamind analyze [table]` - Automatic insight generation from data
- `datamind export <file>` - Export analysis reports in Markdown/HTML format
- `datamind ui` - Launch local Web UI for interactive analysis

#### Features
- **Natural Language Query**: Ask questions in plain Chinese/English, auto-generate SQL
- **Automatic Type Inference**: Smart detection of number, string, date, boolean types
- **Insight Engine**: Discover trends, anomalies, correlations, and distributions
- **Chart Generation**: Support for bar, line, pie, and scatter charts
- **Batch Import**: Optimized performance for large datasets (10K+ rows)
- **Web UI**: Dark-themed interactive interface with drag-and-drop upload
- **Vector Search**: LanceDB integration for intelligent table recommendations

#### API Endpoints
- `GET /api/tables` - List all tables
- `POST /api/import` - Upload data files
- `POST /api/ask` - Natural language query
- `POST /api/query` - Execute raw SQL
- `GET /api/analyze/:table` - Analyze table
- `GET /api/schema/:table` - Get table schema
- `GET /api/export/:table` - Export as CSV
- `DELETE /api/tables/:table` - Delete table

#### Technical
- **DuckDB Integration**: Embedded OLAP database for fast analytics
- **LanceDB Integration**: Vector database for semantic search
- **OpenAI Compatible API**: Support for OpenAI, Alibaba Cloud, Zhipu, and local models
- **Parameterized Queries**: SQL injection protection
- **Unified Error Handling**: Custom error classes with friendly messages

### Testing
- 74 unit test cases
- 94% code coverage
- Jest testing framework

### Security
- Parameterized SQL queries to prevent injection
- Input validation for table and column names
- API key validation with helpful error messages

### Performance
- Batch insert for large datasets (1000 rows per batch)
- Progress display during import
- Execution time tracking for queries

## [0.1.0] - 2026-03-21

### Added
- Initial MVP release
- Basic CLI framework
- DuckDB integration
- CSV import functionality
- Natural language query with LLM
### 改进

#### 用户引导增强
- **首次启动向导**: 运行 `datamind setup` 配置 AI 服务，引导用户选择服务商和输入 API Key
- **配置查看**: 运行 `datamind config` 查看当前配置
- **无需环境变量**: 通过向导配置后，无需设置 DATAMIND_API_KEY 环境变量

#### 数据安全
- **本地存储**: API Key 保存在本地配置文件，不上传云端
- **数据不出域**: 所有数据处理在本地完成

### 使用流程

```bash
# 1. 安装
npm install -g datamind

# 2. 配置（首次运行）
datamind setup

# 3. 使用
datamind import your_data.csv
datamind ask "你的问题"
```
