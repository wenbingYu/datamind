# DataMind — 智能数据分析助手

## 产品愿景

**让每个人都能用自然语言分析数据，无需技术背景。**

## 产品定位

- **一句话**：上传数据，用自然语言分析，无需 SQL/Python
- **目标客户**：数据分析师、产品经理、运营人员、中小企业
- **差异化**：本地运行、数据不出域、零学习成本

## 发展路线

```
Phase 1: CLI MVP (2周) → 验证核心能力
    ↓
Phase 2: 开源发布 (1周) → 建立影响力
    ↓
Phase 3: Web UI (1个月) → 普惠化
    ↓
Phase 4: Cloud SaaS (3-6个月) → 商业化
```

---

## Phase 1: CLI MVP

### 核心功能

| 功能 | 命令 | 说明 |
|------|------|------|
| 数据导入 | `datamind import <file>` | 支持 CSV/Excel/Parquet |
| 数据列表 | `datamind list` | 显示已导入的数据表 |
| 自然语言查询 | `datamind ask "<问题>"` | 自动生成 SQL 并执行 |
| 自动洞察 | `datamind analyze [table]` | 发现数据中的洞察 |
| 报告导出 | `datamind export <file>` | 导出 Markdown/HTML 报告 |
| Web UI | `datamind ui` | 启动本地 Web 界面 |

### CLI 示例

```bash
# 安装
npm install -g datamind

# 导入数据
datamind import sales.csv
✔ Table "sales" created with 1,234 rows, 8 columns

# 列出数据
datamind list
┌──────────┬────────┬──────────────────────────────────────┐
│ 表名     │ 行数   │ 列                                   │
├──────────┼────────┼──────────────────────────────────────┤
│ sales    │ 1,234  │ date, product, region, amount, ...   │
│ users    │ 5,678  │ id, name, signup_date, ...           │
└──────────┴────────┴──────────────────────────────────────┘

# 自然语言查询
datamind ask "上个月销售额最高的 Top 10 产品"
┌────────────────┬──────────────┬────────┐
│ 产品名称       │ 销售额       │ 占比   │
├────────────────┼──────────────┼────────┤
│ iPhone 15 Pro  │ ¥1,234,567   │ 12.3%  │
│ MacBook Air    │ ¥987,654     │ 9.8%   │
│ iPad Pro       │ ¥756,432     │ 7.5%   │
│ ...            │ ...          │ ...    │
└────────────────┴──────────────┴────────┘

# 自动洞察
datamind analyze sales
📊 数据概览:
  • 时间范围: 2024-01 ~ 2024-12
  • 总销售额: ¥45,678,901
  • 产品数: 156

🔍 发现 3 个洞察:
  1. 销售额环比增长 23%，主要由新品驱动
  2. 华东地区贡献 45% 销售额，需关注区域差异
  3. 存在 5 笔异常订单，金额超均值 10 倍

# 导出报告
datamind export report.md --title "2024销售分析报告"
✔ 报告已保存到 report.md

# 启动 Web UI
datamind ui
🚀 DataMind UI running at http://localhost:3000
```

---

## 技术架构

### 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                     DataMind Agent                       │
├─────────────────────────────────────────────────────────┤
│  CLI / Web UI / API                                     │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ SQL Builder │  │ Chart Gen   │  │ Insight Engine  │  │
│  │ (LLM)       │  │ (ECharts)   │  │ (LLM + Rules)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────────┐  ┌───────────────────────────┐   │
│  │      DuckDB       │  │        LanceDB            │   │
│  │  • 结构化数据     │  │  • 表结构向量            │   │
│  │  • SQL 执行引擎   │  │  • 文档向量存储          │   │
│  │  • 聚合/窗口函数  │  │  • 语义检索              │   │
│  └───────────────────┘  └───────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  LLM Provider (OpenAI Compatible)                       │
│  • 阿里云百炼 / 智谱 GLM / OpenAI / 本地模型            │
├─────────────────────────────────────────────────────────┤
│  Local Storage (~/.datamind/)                           │
│  ├── data/           # 原始数据文件                     │
│  ├── duckdb/         # DuckDB 数据库文件                │
│  ├── lancedb/        # LanceDB 向量库                   │
│  └── config.json     # 配置文件                         │
└─────────────────────────────────────────────────────────┘
```

### 数据流

```
用户问题
    │
    ▼
┌─────────────────┐
│ 意图识别 (LLM)  │ ← 判断是查询/分析/导出
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
 查询类     分析类
    │         │
    ▼         ▼
┌─────────┐ ┌─────────────┐
│SQL 生成 │ │ 数据统计    │
│(LLM)    │ │ + 规则引擎  │
└────┬────┘ └──────┬──────┘
     │             │
     ▼             ▼
┌─────────────────────┐
│    DuckDB 执行      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  结果渲染 (表格/图表)│
└─────────────────────┘
```

---

## 技术选型

### 核心组件

| 组件 | 选择 | 版本 | 理由 |
|------|------|------|------|
| 运行时 | Node.js | 20+ | 跨平台，生态丰富 |
| 语言 | TypeScript | 5.x | 类型安全，开发体验好 |
| CLI 框架 | Commander | 12.x | 成熟稳定，社区活跃 |
| 数据引擎 | DuckDB | 1.x | 嵌入式 OLAP，SQL 标准 |
| 向量存储 | LanceDB | 0.x | 轻量，多模态，无服务 |
| LLM SDK | OpenAI SDK | 4.x | 兼容多家 API |
| 图表 | ECharts | 5.x | 丰富图表，Node 端渲染 |
| 表格 | cli-table3 | 0.x | 终端表格美化 |
| Markdown | marked | 12.x | 报告生成 |

### DuckDB 集成

```typescript
// 使用 duckdb-node
import * as duckdb from 'duckdb';

// 或使用 duckdb-async (推荐)
import { Database } from 'duckdb-async';

const db = await Database.create('~/.datamind/duckdb/datamind.db');
await db.exec('CREATE TABLE IF NOT EXISTS ...');
const result = await db.all('SELECT * FROM sales LIMIT 10');
```

### LanceDB 集成

```typescript
import * as lancedb from 'vectordb';

const db = await lancedb.connect('~/.datamind/lancedb');
const table = await db.createTable('table_schemas', vectors);
await table.search(queryVector).limit(5).execute();
```

---

## 模块设计

### 目录结构

```
datamind/
├── src/
│   ├── cli/                    # CLI 入口
│   │   ├── index.ts            # 主入口
│   │   └── commands/           # 命令实现
│   │       ├── import.ts       # datamind import
│   │       ├── list.ts         # datamind list
│   │       ├── ask.ts          # datamind ask
│   │       ├── analyze.ts      # datamind analyze
│   │       ├── export.ts       # datamind export
│   │       └── ui.ts           # datamind ui
│   │
│   ├── core/                   # 核心引擎
│   │   ├── engine/             # 数据引擎
│   │   │   ├── duckdb.ts       # DuckDB 封装
│   │   │   └── lancedb.ts      # LanceDB 封装
│   │   │
│   │   ├── llm/                # LLM 集成
│   │   │   ├── client.ts       # LLM 客户端
│   │   │   ├── prompts.ts      # Prompt 模板
│   │   │   └── sql-builder.ts  # SQL 生成器
│   │   │
│   │   ├── analyzer/           # 数据分析
│   │   │   ├── insights.ts     # 洞察生成
│   │   │   ├── statistics.ts   # 统计分析
│   │   │   └── anomaly.ts      # 异常检测
│   │   │
│   │   └── importer/           # 数据导入
│   │       ├── csv.ts          # CSV 解析
│   │       ├── excel.ts        # Excel 解析
│   │       └── parquet.ts      # Parquet 解析
│   │
│   ├── ui/                     # Web UI (Phase 3)
│   │   ├── server.ts           # Express 服务
│   │   └── public/             # 前端资源
│   │
│   └── utils/                  # 工具函数
│       ├── config.ts           # 配置管理
│       ├── output.ts           # 输出格式化
│       └── charts.ts           # 图表生成
│
├── examples/                   # 示例数据
│   ├── sales.csv
│   └── users.csv
│
├── tests/                      # 测试
│   ├── unit/
│   └── integration/
│
├── package.json
├── tsconfig.json
├── README.md
└── DESIGN.md                   # 本文档
```

### 核心类型

```typescript
// types/index.ts

/** 数据表元数据 */
interface TableMeta {
  name: string;
  rowCount: number;
  columns: ColumnMeta[];
  createdAt: number;
  updatedAt: number;
}

/** 列元数据 */
interface ColumnMeta {
  name: string;
  type: 'number' | 'string' | 'date' | 'boolean';
  nullable: boolean;
  sampleValues: any[];
}

/** 查询结果 */
interface QueryResult {
  sql: string;           // 生成的 SQL
  columns: string[];     // 列名
  rows: any[][];         // 数据行
  rowCount: number;
  executionTime: number; // 执行时间 ms
}

/** 洞察结果 */
interface Insight {
  type: 'trend' | 'anomaly' | 'correlation' | 'distribution';
  title: string;
  description: string;
  significance: 'high' | 'medium' | 'low';
  data?: any;
}

/** 配置 */
interface Config {
  llm: {
    provider: 'openai' | 'bailian' | 'zhipu' | 'ollama';
    model: string;
    apiKey?: string;
    baseUrl?: string;
  };
  storage: {
    dataDir: string;
    duckdbPath: string;
    lancedbPath: string;
  };
}
```

---

## Prompt 设计

### SQL 生成 Prompt

```
你是一个 SQL 专家，负责将自然语言问题转换为 SQL 查询。

## 数据库 Schema

表名: {table_name}
列:
{columns_schema}

## 用户问题
{question}

## 要求
1. 生成标准 SQL (DuckDB 兼容)
2. 使用适当的聚合函数和分组
3. 添加 ORDER BY 和 LIMIT (如适用)
4. 不要使用不存在的列
5. 返回纯 SQL，不要解释

## 输出格式
```sql
SELECT ...
```

### 洞察生成 Prompt

```
你是一个数据分析专家，负责从数据中发现有价值的洞察。

## 数据概览
{data_summary}

## 统计信息
{statistics}

## 要求
1. 发现 3-5 个有价值的洞察
2. 洞察类型: 趋势、异常、关联、分布
3. 每个洞察包含: 标题、描述、重要性
4. 使用业务语言，避免技术术语

## 输出格式 (JSON)
{
  "insights": [
    {
      "type": "trend|anomaly|correlation|distribution",
      "title": "洞察标题",
      "description": "详细描述",
      "significance": "high|medium|low"
    }
  ]
}
```

---

## 开发计划

### Week 1: 基础能力

| Day | 任务 | 产出 |
|-----|------|------|
| 1 | 项目初始化 + 依赖安装 | 可运行的 CLI 框架 |
| 2 | DuckDB 集成 + 数据导入 | `datamind import` 可用 |
| 3 | 数据列表 + Schema 推断 | `datamind list` 可用 |
| 4 | LLM 集成 + SQL 生成 | `datamind ask` 基础版 |
| 5 | 结果格式化 + 表格输出 | 完整的查询体验 |

### Week 2: 增强功能

| Day | 任务 | 产出 |
|-----|------|------|
| 1 | 图表生成 (ECharts) | 查询结果可视化 |
| 2 | LanceDB 集成 + 表 Schema 向量化 | 智能表推荐 |
| 3 | 自动洞察引擎 | `datamind analyze` 可用 |
| 4 | 报告生成 + 导出 | `datamind export` 可用 |
| 5 | Web UI 基础版 | `datamind ui` 可用 |

---

## 开源策略

### 发布渠道

| 渠道 | 内容 | 时机 |
|------|------|------|
| GitHub | 源码 + 文档 | Phase 1 完成 |
| npm | CLI 包 | Phase 1 完成 |
| Docker Hub | 镜像 | Phase 2 |
| Product Hunt | 产品发布 | Phase 3 |

### 文档结构

```
docs/
├── README.md           # 快速开始
├── INSTALLATION.md     # 安装指南
├── QUICK_START.md      # 5 分钟教程
├── CLI_REFERENCE.md    # 命令参考
├── EXAMPLES.md         # 使用示例
├── ARCHITECTURE.md     # 架构设计
└── CONTRIBUTING.md     # 贡献指南
```

---

## 商业化路径

### 开源版 vs 商业版

| 功能 | 开源版 | 商业版 |
|------|--------|--------|
| 数据导入 | ✅ | ✅ |
| 自然语言查询 | ✅ | ✅ |
| 自动洞察 | ✅ | ✅ |
| 本地部署 | ✅ | ✅ |
| 团队协作 | ❌ | ✅ |
| 云端同步 | ❌ | ✅ |
| 高级图表 | ❌ | ✅ |
| API 访问 | ❌ | ✅ |
| 技术支持 | 社区 | 专属 |

### 定价 (Phase 4)

| 版本 | 价格 | 目标用户 |
|------|------|----------|
| 开源版 | 免费 | 个人开发者 |
| Pro | ¥99/月 | 个人专业用户 |
| Team | ¥499/月 | 小团队 |
| Enterprise | 按需 | 企业 |

---

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| LLM 生成的 SQL 不准确 | 执行前校验 + 预览模式 |
| 竞品压力 (ChatGPT) | 强调本地部署、数据安全 |
| 性能瓶颈 | DuckDB 已优化，限制数据量 |
| 用户学习成本 | 提供示例、教程、模板 |

---

## 成功指标

### Phase 1 (MVP)
- [ ] 完成所有 CLI 命令
- [ ] 支持至少 3 种数据格式
- [ ] SQL 生成准确率 > 80%

### Phase 2 (开源)
- [ ] GitHub Star > 1,000
- [ ] npm 周下载量 > 500
- [ ] 收到 10+ 用户反馈

### Phase 3 (Web UI)
- [ ] 注册用户 > 5,000
- [ ] 月活用户 > 1,000
- [ ] 用户留存率 > 30%

### Phase 4 (商业化)
- [ ] 付费用户 > 100
- [ ] MRR > ¥10,000
- [ ] 续费率 > 70%