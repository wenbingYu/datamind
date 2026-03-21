# CLI 命令参考

本文档详细介绍 DataMind 的所有 CLI 命令，包括参数、选项和使用示例。

## 目录

- [datamind](#datamind)
- [datamind import](#datamind-import)
- [datamind list](#datamind-list)
- [datamind ask](#datamind-ask)
- [datamind analyze](#datamind-analyze)
- [datamind export](#datamind-export)
- [datamind ui](#datamind-ui)

---

## datamind

显示帮助信息和版本号。

### 用法

```bash
datamind [options]
datamind [command]
```

### 选项

| 选项 | 说明 |
|------|------|
| `-V, --version` | 显示版本号 |
| `-h, --help` | 显示帮助信息 |

### 示例

```bash
# 显示版本
datamind --version
# 输出: 1.0.0

# 显示帮助
datamind --help

# 无参数运行（显示欢迎信息）
datamind
```

**欢迎界面**：

```
  DataMind - 智能数据分析助手

  上传数据，用自然语言分析，无需 SQL/Python

  快速开始:
    datamind import sales.csv    导入数据
    datamind list                查看数据表
    datamind ask "销售额最高的产品"  查询数据
    datamind analyze sales       分析数据
    datamind export report.md    导出报告
    datamind ui                  启动 Web 界面
```

---

## datamind import

导入数据文件到 DataMind。支持 CSV 格式。

### 用法

```bash
datamind import <file>
```

### 参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `<file>` | 是 | 要导入的数据文件路径 |

### 支持的格式

| 格式 | 扩展名 | 说明 |
|------|--------|------|
| CSV | `.csv` | 逗号分隔值文件 |

> 🚧 Excel (.xlsx) 和 Parquet 格式即将支持

### 示例

```bash
# 导入 CSV 文件
datamind import sales.csv

# 使用相对路径
datamind import ./data/users.csv

# 使用绝对路径
datamind import /path/to/data.csv
```

**输出示例**：

```
✔ 导入成功!

  表名: sales
  行数: 1,234
  列数: 8

使用 'datamind ask "问题"' 查询数据
```

### 表名规则

- 表名从文件名自动提取（不含扩展名）
- 示例：`sales.csv` → 表名 `sales`
- 特殊字符会被替换为下划线

### 错误处理

| 错误 | 原因 | 解决方案 |
|------|------|---------|
| `文件不存在: xxx` | 文件路径错误 | 检查文件路径是否正确 |
| `不支持的文件格式: .xxx` | 文件格式不支持 | 使用 CSV 格式 |

---

## datamind list

列出所有已导入的数据表。

### 用法

```bash
datamind list
```

### 输出格式

```
┌──────────┬────────┬──────────────────────────────────────┐
│ 表名     │ 行数   │ 列                                   │
├──────────┼────────┼──────────────────────────────────────┤
│ sales    │ 1,234  │ date, product, region, amount, ...   │
│ users    │ 5,678  │ id, name, signup_date, ...           │
└──────────┴────────┴──────────────────────────────────────┘

共 2 个表
```

### 示例

```bash
# 列出所有表
datamind list

# 输出示例（无数据时）
# ┌──────────┬────────┬──────────────────────────────┐
# │ 表名     │ 行数   │ 列                           │
# ├──────────┼────────┼──────────────────────────────┤
# └──────────┴────────┴──────────────────────────────┘
#
# 暂无数据表，请先使用 datamind import <file> 导入数据
```

---

## datamind ask

使用自然语言查询数据。DataMind 会自动将问题转换为 SQL 并执行。

### 用法

```bash
datamind ask <question> [options]
```

### 参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `<question>` | 是 | 自然语言查询问题 |

### 选项

| 选项 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--table <name>` | `-t` | 指定查询的表名 | 自动推断 |
| `--chart <type>` | `-c` | 生成图表类型 | 无 |
| `--output <file>` | `-o` | 输出文件路径 | 无 |

### 图表类型

| 类型 | 说明 | 适用场景 |
|------|------|---------|
| `bar` | 柱状图 | 分类对比、排名 |
| `line` | 折线图 | 趋势分析、时序数据 |
| `pie` | 饼图 | 占比分析 |
| `scatter` | 散点图 | 相关性分析、分布 |

### 示例

#### 基本查询

```bash
# 简单查询
datamind ask "销售额最高的产品"

# 排序查询
datamind ask "销量前10的产品"

# 条件筛选
datamind ask "北京地区的销售记录"

# 汇总统计
datamind ask "各地区的销售总额"
```

#### 指定表名

```bash
# 当有多个表时，指定要查询的表
datamind ask "销售额最高的产品" -t sales
datamind ask "注册用户数量" --table users
```

#### 生成图表

```bash
# 在终端显示 ASCII 图表
datamind ask "各产品销售额" -c bar

# 生成饼图
datamind ask "各地区销售占比" -c pie

# 生成折线图
datamind ask "销售趋势" -c line
```

#### 保存图表

```bash
# 保存为 HTML 文件
datamind ask "销售排行" -c bar -o chart.html

# 保存为 JSON 配置
datamind ask "销售占比" -c pie -o config.json
```

### 查询语法技巧

#### 推荐的查询方式

```bash
# ✅ 明确的查询意图
datamind ask "销售额最高的前5个产品"
datamind ask "2024年1月的销售记录"
datamind ask "各地区销售额和数量的汇总"

# ✅ 使用聚合词汇
datamind ask "平均单价是多少"
datamind ask "总销售额"
datamind ask "最高销量"

# ✅ 指定排序和限制
datamind ask "销量最多的前10名产品"
datamind ask "销售额从高到低排序"
```

#### 避免的查询方式

```bash
# ❌ 模糊不清
datamind ask "数据怎么样"

# ❌ 过于复杂
datamind ask "帮我分析一下这个数据集的所有特征并给出建议"

# ❌ 不相关
datamind ask "今天天气怎么样"
```

### 输出格式

**表格输出**：

```
✔ 查询完成

┌────────────────┬──────────────┬────────┐
│ product        │ total_amount │ count  │
├────────────────┼──────────────┼────────┤
│ iPhone 15      │ ¥1,234,567   │ 156    │
│ MacBook Air    │ ¥987,654     │ 89     │
│ iPad Pro       │ ¥756,432     │ 67     │
└────────────────┴──────────────┴────────┘
(显示前 50 行，共 156 行)
```

**ASCII 图表输出**：

```
📊 图表预览

销售额
  │
  │ ████████████████████  iPhone 15 (¥1,234,567)
  │ ████████████████      MacBook Air (¥987,654)
  │ ████████████          iPad Pro (¥756,432)
  │ ████████              AirPods Pro (¥456,789)
  └────────────────────────────────────────────
```

---

## datamind analyze

分析数据表，自动发现数据洞察。

### 用法

```bash
datamind analyze [table]
```

### 参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `[table]` | 否 | 要分析的表名，不指定则分析所有表 |

### 分析类型

| 类型 | 图标 | 说明 |
|------|------|------|
| 趋势 | 📈 | 数据随时间的变化趋势 |
| 异常 | ⚠️ | 异常值和离群点检测 |
| 关联 | 🔗 | 列之间的相关性分析 |
| 分布 | 📊 | 数据分布特征 |

### 示例

```bash
# 分析指定表
datamind analyze sales

# 分析所有表
datamind analyze
```

**输出示例**：

```
📊 sales 数据分析报告
══════════════════════════════════════════════════

📋 数据概览
──────────────────────────────
  行数: 1,234
  列数: 8
  时间范围: 2024-01-01 ~ 2024-12-31
  数值列: quantity, amount, price
  文本列: product, region, category

📈 统计信息
──────────────────────────────
  quantity:
    范围: [1.00, 500.00]
    均值: 45.32 | 中位数: 30.00
    唯一值: 234 | 缺失: 0

  amount:
    范围: [¥100.00, ¥999,999.00]
    均值: ¥12,345.67 | 中位数: ¥8,765.43
    唯一值: 1,123 | 缺失: 0

💡 洞察发现
──────────────────────────────

  📈 销售额上升趋势 [high]
     列 "amount" 显示出明显的上升趋势，后半段数据比前半段高 23.5%。

  ⚠️ 高缺失率列 [high]
     以下列有超过 30% 的缺失值: notes, feedback。

  🔗 数量与金额强相关 [medium]
     列 "quantity" 和 "amount" 存在强相关性 (r = 0.89)。

  📊 小数据量 [low]
     该表仅有 1,234 行数据。

══════════════════════════════════════════════════
```

### 洞察重要性

| 级别 | 图标 | 说明 |
|------|------|------|
| 高 | 🔴 | 需要立即关注的重要发现 |
| 中 | 🟡 | 有价值的分析结果 |
| 低 | ⚪ | 参考性信息 |

---

## datamind export

导出分析报告。支持 Markdown、HTML 和 JSON 格式。

### 用法

```bash
datamind export <file> [options]
```

### 参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `<file>` | 是 | 输出文件路径 |

### 选项

| 选项 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--title <title>` | `-t` | 报告标题 | "DataMind 数据分析报告" |
| `--table <name>` | | 指定导出的表 | 所有表 |
| `--template <name>` | | 报告模板 | default |

### 支持的格式

| 格式 | 扩展名 | 说明 |
|------|--------|------|
| Markdown | `.md`, `.markdown` | 纯文本格式，适合文档 |
| HTML | `.html`, `.htm` | 网页格式，支持图表 |
| JSON | `.json` | 数据格式，适合程序处理 |

### 示例

```bash
# 导出 Markdown 报告
datamind export report.md

# 导出带标题的 HTML 报告
datamind export analysis.html --title "2024年度销售分析"

# 导出指定表的数据
datamind export sales_report.md --table sales

# 导出 JSON 数据（用于程序处理）
datamind export data.json
```

**输出示例**：

```
✔ 报告已导出到: report.md
  表数量: 2
  洞察数量: 8
```

### Markdown 报告示例

```markdown
# DataMind 数据分析报告

> 生成时间: 2024/3/21 18:30:00

## 📑 目录

- [sales](#sales)
- [users](#users)

---

## 📊 sales

### 📋 数据概览

| 指标 | 值 |
| --- | --- |
| 行数 | 1,234 |
| 列数 | 8 |
| 时间范围 | 2024-01-01 ~ 2024-12-31 |

### 💡 洞察发现

#### 📈 销售额上升趋势

**重要性**: 🔴 高

销售额显示明显的上升趋势...

*报告由 DataMind 自动生成*
```

---

## datamind ui

启动 Web UI 界面，提供图形化的数据分析体验。

### 用法

```bash
datamind ui [options]
```

### 选项

| 选项 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--port <port>` | `-p` | 服务端口号 | 3000 |

### 示例

```bash
# 默认端口启动
datamind ui

# 指定端口
datamind ui -p 8080
datamind ui --port 3001
```

**启动输出**：

```
  🚀 DataMind UI

  本地访问: http://localhost:3000

  API 端点:
    GET  /api/tables        获取表列表
    POST /api/import        导入数据
    POST /api/ask           自然语言查询
    POST /api/query         执行 SQL
    GET  /api/analyze/:table 分析表
    GET  /api/schema/:table  获取表结构

  按 Ctrl+C 停止服务
```

### API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/tables` | GET | 获取所有数据表列表 |
| `/api/import` | POST | 上传数据文件 |
| `/api/ask` | POST | 自然语言查询 |
| `/api/query` | POST | 直接执行 SQL |
| `/api/analyze/:table` | GET | 分析指定表 |
| `/api/schema/:table` | GET | 获取表结构信息 |
| `/api/export/:table` | GET | 导出表数据为 CSV |
| `/api/tables/:table` | DELETE | 删除指定表 |

### Web UI 界面

```
┌─────────────────────────────────────────────────────────────┐
│  DataMind                              [上传数据] [帮助]    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 💬 问问数据...                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  📊 已上传数据集                          [刷新]            │
│  ┌───────────┬───────────┬─────────────────────────────┐   │
│  │ sales.csv │ 1,234 行  │ [查询][分析][导出][删除]    │   │
│  │ users.csv │ 5,678 行  │ [查询][分析][导出][删除]    │   │
│  └───────────┴───────────┴─────────────────────────────┘   │
│                                                             │
│  📈 查询结果                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  product       │ amount     │ region                │   │
│  │  iPhone 15     │ ¥1,234,567 │ 北京                  │   │
│  │  MacBook Air   │ ¥987,654   │ 上海                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [表格视图] [图表视图]                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 错误处理

| 错误 | 原因 | 解决方案 |
|------|------|---------|
| `端口 3000 已被占用` | 端口被其他程序占用 | 使用 `-p` 指定其他端口 |

---

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DATAMIND_API_KEY` | LLM API Key | - |
| `ZHIPU_API_KEY` | 智谱 API Key（备选） | - |
| `DATAMIND_LLM_PROVIDER` | LLM 提供商 | bailian |
| `DATAMIND_LLM_MODEL` | LLM 模型 | glm-5 |
| `DATAMIND_BASE_URL` | API Base URL | - |
| `DATAMIND_DATA_DIR` | 数据目录 | ~/.datamind |

---

## 退出码

| 退出码 | 说明 |
|--------|------|
| 0 | 成功 |
| 1 | 通用错误 |
| 2 | 配置错误（如未设置 API Key） |
| 3 | 文件错误（如文件不存在） |
| 4 | 导入错误（如格式不支持） |
| 5 | 查询错误（如 SQL 执行失败） |