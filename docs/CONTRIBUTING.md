# 贡献指南

感谢你对 DataMind 的关注！本文档介绍如何参与项目开发。

## 目录

- [行为准则](#行为准则)
- [开发环境设置](#开发环境设置)
- [项目结构](#项目结构)
- [代码风格](#代码风格)
- [提交规范](#提交规范)
- [PR 流程](#pr-流程)
- [测试要求](#测试要求)
- [问题反馈](#问题反馈)

---

## 行为准则

### 我们的承诺

为了营造一个开放和友好的环境，我们承诺：

- 使用包容性语言
- 尊重不同的观点和经验
- 优雅地接受建设性批评
- 关注对社区最有利的事情
- 对其他社区成员表示同理心

### 不可接受的行为

- 使用性化的语言或图像
- 捣乱、侮辱/贬损评论
- 公开或私下的骚扰
- 未经许可发布他人私人信息
- 其他不道德或不专业的行为

---

## 开发环境设置

### 系统要求

- Node.js 18.0.0+
- npm 8.0.0+
- Git

### 克隆仓库

```bash
# 克隆仓库
git clone https://github.com/wenbingYu/datamind.git

# 进入项目目录
cd datamind

# 安装依赖
npm install
```

### 构建项目

```bash
# 编译 TypeScript
npm run build

# 开发模式（监听文件变化）
npm run dev
```

### 运行测试

```bash
# 运行所有测试
npm test

# 监听模式
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

### 本地运行

```bash
# 方式一：使用 npm link
npm link
datamind --help

# 方式二：直接运行
npm start -- --help

# 方式三：开发模式
npm run dev -- --help
```

### IDE 配置

推荐使用 VS Code，安装以下扩展：

- ESLint
- Prettier
- TypeScript Hero

VS Code 配置（`.vscode/settings.json`）：

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

---

## 项目结构

```
datamind/
├── src/                      # 源代码
│   ├── cli/                  # CLI 相关
│   │   ├── index.ts          # 入口文件
│   │   └── commands/         # 命令实现
│   │       ├── import.ts     # datamind import
│   │       ├── list.ts       # datamind list
│   │       ├── ask.ts        # datamind ask
│   │       ├── analyze.ts    # datamind analyze
│   │       ├── export.ts     # datamind export
│   │       └── ui.ts         # datamind ui
│   │
│   ├── core/                 # 核心功能
│   │   ├── engine/           # 存储引擎
│   │   │   ├── duckdb.ts     # DuckDB 封装
│   │   │   └── lancedb.ts    # LanceDB 封装
│   │   │
│   │   ├── llm/              # LLM 集成
│   │   │   ├── client.ts     # LLM 客户端
│   │   │   └── sql-builder.ts# SQL 生成器
│   │   │
│   │   ├── analyzer/         # 数据分析
│   │   │   └── insights.ts   # 洞察生成
│   │   │
│   │   └── importer/         # 数据导入
│   │       └── csv.ts        # CSV 解析
│   │
│   ├── ui/                   # Web UI
│   │   ├── server.ts         # Express 服务
│   │   └── public/           # 静态文件
│   │
│   └── utils/                # 工具函数
│       ├── config.ts         # 配置管理
│       ├── output.ts         # 输出格式化
│       ├── charts.ts         # 图表生成
│       └── errors.ts         # 错误定义
│
├── tests/                    # 测试文件
│   ├── setup.ts              # 测试设置
│   ├── __mocks__/            # Mock 文件
│   ├── unit/                 # 单元测试
│   └── integration/          # 集成测试
│
├── docs/                     # 文档
│   ├── INSTALLATION.md
│   ├── QUICK_START.md
│   ├── CLI_REFERENCE.md
│   ├── EXAMPLES.md
│   ├── ARCHITECTURE.md
│   └── CONTRIBUTING.md
│
├── examples/                 # 示例数据
│   └── sales.csv
│
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

---

## 代码风格

### TypeScript 规范

```typescript
// ✅ 推荐：使用 interface 定义类型
interface User {
  id: string;
  name: string;
}

// ✅ 推荐：使用 async/await
async function getData(): Promise<User[]> {
  const result = await fetchData();
  return result;
}

// ❌ 避免：使用 any 类型
function process(data: any) { ... }

// ✅ 推荐：使用泛型
function process<T>(data: T): T { ... }
```

### 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 文件名 | kebab-case | `sql-builder.ts` |
| 类名 | PascalCase | `SQLBuilder` |
| 函数名 | camelCase | `generateSQL` |
| 常量 | UPPER_SNAKE_CASE | `MAX_ROWS` |
| 接口 | PascalCase | `QueryResult` |

### 导入顺序

```typescript
// 1. Node.js 内置模块
import * as fs from 'fs';
import * as path from 'path';

// 2. 第三方模块
import { Command } from 'commander';
import chalk from 'chalk';

// 3. 项目内部模块
import { getConfig } from './config';
import { QueryError } from './errors';
```

### 错误处理

```typescript
// ✅ 推荐：自定义错误类
export class QueryError extends DataMindError {
  constructor(message: string) {
    super(message, 'QueryError', 5);
  }
}

// ✅ 推荐：抛出具体错误
if (!fs.existsSync(file)) {
  throw new FileError(`文件不存在: ${file}`);
}

// ❌ 避免：抛出通用错误
throw new Error('出错了');
```

### 注释规范

```typescript
/**
 * 分析表并生成洞察
 * @param tableName - 要分析的表名
 * @returns 分析结果，包含概览、统计和洞察
 * @throws {QueryError} 当表不存在时抛出
 * 
 * @example
 * ```ts
 * const result = await analyzeTable('sales');
 * console.log(result.insights);
 * ```
 */
export async function analyzeTable(tableName: string): Promise<AnalysisResult> {
  // 实现...
}
```

### 格式化

使用 Prettier 自动格式化：

```bash
# 格式化所有文件
npx prettier --write "src/**/*.ts"

# 检查格式
npx prettier --check "src/**/*.ts"
```

---

## 提交规范

### Commit Message 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | feat(import): 添加 Excel 支持 |
| `fix` | Bug 修复 | fix(ask): 修复 SQL 生成错误 |
| `docs` | 文档更新 | docs: 更新安装指南 |
| `style` | 代码格式 | style: 格式化代码 |
| `refactor` | 重构 | refactor(core): 重构 SQL Builder |
| `test` | 测试 | test: 添加单元测试 |
| `chore` | 构建/工具 | chore: 更新依赖版本 |

### Scope 范围

- `cli` - CLI 相关
- `core` - 核心功能
- `ui` - Web UI
- `docs` - 文档
- `test` - 测试

### 示例

```bash
# 简单提交
git commit -m "feat(import): 添加 Excel 格式支持"

# 详细提交
git commit -m "feat(import): 添加 Excel 格式支持

- 支持 .xlsx 和 .xls 文件
- 自动检测工作表
- 推断列类型

Closes #123"
```

---

## PR 流程

### 创建 PR

1. **Fork 仓库**

```bash
# 在 GitHub 上 Fork 仓库
# 然后克隆你的 Fork
git clone https://github.com/YOUR_USERNAME/datamind.git
```

2. **创建分支**

```bash
# 创建功能分支
git checkout -b feature/excel-support

# 或修复分支
git checkout -b fix/sql-generation
```

3. **开发并测试**

```bash
# 编写代码
# ...

# 运行测试
npm test

# 构建项目
npm run build
```

4. **提交更改**

```bash
git add .
git commit -m "feat(import): 添加 Excel 格式支持"
git push origin feature/excel-support
```

5. **创建 Pull Request**

- 访问 GitHub 仓库
- 点击 "New Pull Request"
- 填写 PR 描述

### PR 描述模板

```markdown
## 变更类型
- [ ] 新功能
- [ ] Bug 修复
- [ ] 文档更新
- [ ] 重构

## 变更说明
<!-- 描述你的变更 -->

## 测试
<!-- 描述你如何测试这些变更 -->

## 检查清单
- [ ] 代码遵循项目风格
- [ ] 已添加/更新测试
- [ ] 文档已更新
- [ ] 所有测试通过
```

### Code Review

PR 需要通过以下检查：

1. **自动化测试** - GitHub Actions 自动运行
2. **代码审查** - 至少一位维护者审核
3. **冲突解决** - 确保与主分支无冲突

### 合并规则

- 所有测试必须通过
- 至少一位维护者批准
- 无合并冲突
- 符合代码风格

---

## 测试要求

### 测试覆盖率

项目要求测试覆盖率不低于 70%：

| 类型 | 覆盖率要求 |
|------|-----------|
| 语句覆盖 | ≥ 70% |
| 分支覆盖 | ≥ 65% |
| 函数覆盖 | ≥ 70% |
| 行覆盖 | ≥ 70% |

### 单元测试

```typescript
// tests/unit/core/llm/sql-builder.test.ts
import { SQLBuilder } from '../../../../src/core/llm/sql-builder';
import { MockLLMClient } from '../../../__mocks__/llm-client';

describe('SQLBuilder', () => {
  let builder: SQLBuilder;

  beforeEach(() => {
    const client = new MockLLMClient();
    builder = new SQLBuilder(client);
  });

  describe('generateSQL', () => {
    it('should generate correct SQL for simple query', async () => {
      const sql = await builder.generateSQL('查询所有数据', mockTables);
      expect(sql).toContain('SELECT');
    });

    it('should handle aggregation queries', async () => {
      const sql = await builder.generateSQL('统计总数', mockTables);
      expect(sql).toContain('COUNT');
    });
  });
});
```

### 集成测试

```typescript
// tests/integration/commands/ask.test.ts
import { execSync } from 'child_process';

describe('datamind ask', () => {
  beforeAll(() => {
    // 准备测试数据
    execSync('datamind import tests/fixtures/test.csv');
  });

  afterAll(() => {
    // 清理测试数据
  });

  it('should return results for valid query', () => {
    const output = execSync('datamind ask "查询所有数据"').toString();
    expect(output).toContain('查询完成');
  });
});
```

### Mock 文件

```typescript
// tests/__mocks__/ora.ts
export const ora = jest.fn(() => ({
  start: jest.fn().mockReturnThis(),
  succeed: jest.fn().mockReturnThis(),
  fail: jest.fn().mockReturnThis(),
  text: '',
}));
```

### 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- sql-builder.test.ts

# 监听模式
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

---

## 问题反馈

### 提交 Issue

1. 访问 [GitHub Issues](https://github.com/wenbingYu/datamind/issues)
2. 点击 "New Issue"
3. 选择问题类型（Bug 报告 / 功能请求）
4. 填写问题描述

### Bug 报告模板

```markdown
## Bug 描述
<!-- 清晰描述遇到的问题 -->

## 复现步骤
1. 执行命令 `datamind import xxx.csv`
2. 运行查询 `datamind ask "..."`
3. 看到错误...

## 期望结果
<!-- 描述期望的正确行为 -->

## 实际结果
<!-- 描述实际发生的情况 -->

## 环境
- OS: macOS 12.0
- Node.js: v20.10.0
- DataMind: v1.0.0

## 截图
<!-- 如果适用，添加截图 -->

## 其他信息
<!-- 任何其他相关信息 -->
```

### 功能请求模板

```markdown
## 功能描述
<!-- 清晰描述你希望添加的功能 -->

## 使用场景
<!-- 描述这个功能解决什么问题 -->

## 建议方案
<!-- 如果有想法，描述可能的实现方式 -->

## 其他信息
<!-- 任何其他相关信息 -->
```

---

## 获取帮助

- **GitHub Issues**: https://github.com/wenbingYu/datamind/issues
- **GitHub Discussions**: https://github.com/wenbingYu/datamind/discussions

---

## 许可证

通过贡献代码，你同意你的代码将按照 MIT 许可证授权。

---

感谢你的贡献！🎉