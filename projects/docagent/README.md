# DocAgent CLI

将在线文档转化为可问答知识库的命令行工具。

## 功能特性

- 📄 **文档索引**: 爬取在线文档，自动提取内容并生成向量索引
- 🔍 **语义检索**: 基于 TF-IDF 的本地向量搜索（无需 API Key）
- 🤖 **智能问答**: 结合 LLM 生成准确答案，附带来源引用
- 🔄 **增量更新**: 支持更新已索引的文档
- 📊 **混合检索**: 向量检索 + 关键词检索，提高准确率
- 🕸️ **递归爬取**: 支持 BFS 深度爬取，自动发现关联页面
- 🌐 **Web UI**: 内置 Web 界面，支持浏览器操作

## 安装

```bash
cd ~/.openclaw/workspace/projects/docagent
npm install
npm run build
npm link  # 全局安装 docagent 命令
```

## 配置

设置 API Key（阿里云百炼，用于问答功能）：

```bash
export DOCAGENT_API_KEY=your_api_key
# 或复用 OpenClaw 配置中的环境变量
export ZHIPU_API_KEY=your_api_key
```

> **注意**: 索引和搜索功能使用本地 TF-IDF 向量化，无需 API Key。API Key 仅用于 LLM 问答生成。

## 使用方法

### 添加文档

```bash
# 爬取单个页面
docagent add https://docs.example.com/guide

# 递归爬取（深度 2）
docagent add https://docs.example.com/guide -d 2
```

选项：
- `-d, --depth <number>`: 爬取深度（默认 1，仅爬取单个页面）

爬取逻辑：
- 使用 BFS 算法递归爬取同域名链接
- 自动过滤非内容页面（PDF、图片、登录页等）
- 同域名链接自动发现并索引

### 问答

```bash
docagent ask "如何配置数据库连接？"
```

选项：
- `-k, --top-k <number>`: 检索的相关块数量（默认 5）
- `-v, --verbose`: 显示来源和置信度

### 列出文档

```bash
docagent list
```

### 更新文档

```bash
# 更新所有文档
docagent update

# 更新指定文档
docagent update https://docs.example.com/guide
```

### 删除文档

```bash
docagent delete https://docs.example.com/guide
```

### Web UI

启动 Web 界面：

```bash
docagent ui

# 指定端口
docagent ui -p 8080
```

访问 http://localhost:3000 使用图形界面：
- **Ask**: 在浏览器中提问
- **Add Document**: 通过界面添加文档
- **Documents**: 查看和删除已索引文档

## 目录结构

```
~/.docagent/
├── config.json       # 配置文件
├── db.sqlite         # 向量数据库
├── vocabulary.json   # TF-IDF 词汇表（持久化）
└── cache/            # 缓存目录
```

## 配置选项

可在 `~/.docagent/config.json` 中自定义：

```json
{
  "apiKey": "your_api_key",
  "baseUrl": "https://coding.dashscope.aliyuncs.com/v1",
  "llmModel": "glm-5",
  "embeddingModel": "text-embedding-v3",
  "chunkSize": 500,
  "chunkOverlap": 50,
  "topK": 5,
  "similarityThreshold": 0.7
}
```

## 技术栈

- **运行时**: Node.js + TypeScript
- **爬虫**: node-fetch + cheerio
- **向量存储**: sql.js（纯 JavaScript SQLite + Blob 向量）
- **向量化**: 本地 TF-IDF（无需外部 API）
- **LLM**: 阿里云百炼（GLM-5 / Qwen）
- **Web UI**: Express + 原生 HTML/CSS/JS

## 工作原理

### 索引流程

1. **爬取**: BFS 递归爬取网页内容，提取正文和链接
2. **转换**: HTML 转 Markdown 格式
3. **分块**: 语义分块（支持重叠）
4. **向量化**: 本地 TF-IDF 生成向量
5. **存储**: 文档、向量和词汇表存储到本地

### 问答流程

1. **向量化**: 问题文本生成 TF-IDF 向量
2. **检索**: 混合检索（向量相似度 + 关键词匹配）
3. **排序**: 取 Top-K 相关块
4. **生成**: LLM 基于上下文生成答案
5. **引用**: 返回答案 + 来源 URL

### 词汇表持久化

为解决搜索时词汇表不一致导致的 NaN 问题，词汇表会持久化到 `~/.docagent/vocabulary.json`：
- 索引时：构建词汇表并保存
- 搜索时：加载已保存的词汇表
- 保证向量空间一致性

## API 端点

Web UI 提供以下 API：

- `GET /api/documents` - 列出所有文档
- `POST /api/add` - 添加文档（body: `{ url, depth }`）
- `POST /api/ask` - 问答（body: `{ question, topK }`）
- `DELETE /api/documents/:url` - 删除文档

## 开发

```bash
# 开发模式
npm run dev

# 构建
npm run build

# 运行
npm start
```

## License

MIT