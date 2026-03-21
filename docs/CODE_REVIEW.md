# DataMind Code Review 文档

## Review 流程

### 1. Review 时机
- 新功能开发完成后
- 提交 Pull Request 前
- 定期代码质量检查

### 2. Review 维度

| 维度 | 检查点 | 重要性 |
|------|--------|--------|
| **功能正确性** | 代码是否实现预期功能 | 🔴 高 |
| **代码质量** | 可读性、可维护性、结构清晰 | 🟡 中 |
| **类型安全** | TypeScript 类型定义完整准确 | 🔴 高 |
| **错误处理** | 异常捕获、用户友好提示 | 🔴 高 |
| **性能** | 无明显性能瓶颈 | 🟡 中 |
| **安全性** | 无敏感信息泄露、输入验证 | 🔴 高 |
| **测试覆盖** | 关键逻辑有测试用例 | 🟡 中 |

### 3. Review 输出格式

```markdown
## Code Review Report

**文件**: `src/path/to/file.ts`
**Reviewer**: AI Agent
**日期**: YYYY-MM-DD

### 总体评分: ⭐⭐⭐⭐☆ (4/5)

### 问题列表

| 级别 | 位置 | 问题描述 | 建议修复 |
|------|------|----------|----------|
| 🔴 Critical | L23 | ... | ... |
| 🟡 Warning | L45 | ... | ... |
| 🟢 Info | L67 | ... | ... |

### 优点
- ...

### 改进建议
- ...
```

---

## Review 检查清单

### TypeScript 代码规范

- [ ] 类型定义完整，避免 `any`
- [ ] 接口/类型命名清晰（PascalCase）
- [ ] 函数参数和返回值有类型注解
- [ ] 使用 `const` 优先，必要时才用 `let`
- [ ] 异步函数正确使用 `async/await`
- [ ] 错误使用 `try/catch` 捕获

### 架构设计

- [ ] 模块职责单一
- [ ] 依赖关系清晰，无循环依赖
- [ ] 接口抽象合理
- [ ] 配置与代码分离

### 错误处理

- [ ] 用户输入验证
- [ ] API 调用错误处理
- [ ] 数据库操作错误处理
- [ ] 友好的错误提示信息

### 性能考量

- [ ] 无同步阻塞操作
- [ ] 大数据处理使用流/分页
- [ ] 避免不必要的循环嵌套
- [ ] 资源及时释放（数据库连接等）

### 安全性

- [ ] 无硬编码敏感信息
- [ ] API Key 从环境变量读取
- [ ] SQL 注入防护
- [ ] 文件路径验证

---

## 常见问题模式

### 🔴 Critical（必须修复）

```typescript
// ❌ 硬编码 API Key
const client = new OpenAI({ apiKey: 'sk-xxx' });

// ✅ 从环境变量读取
const client = new OpenAI({ apiKey: process.env.API_KEY });

// ❌ 未处理错误
const result = await db.query(sql);

// ✅ 错误处理
try {
  const result = await db.query(sql);
} catch (error) {
  console.error('Query failed:', error.message);
  throw new Error('查询失败，请检查输入');
}

// ❌ SQL 注入风险
const sql = `SELECT * FROM ${tableName} WHERE name = '${name}'`;

// ✅ 参数化查询
const sql = `SELECT * FROM ${tableName} WHERE name = ?`;
const result = await db.query(sql, [name]);
```

### 🟡 Warning（建议修复）

```typescript
// ❌ 使用 any
function parse(data: any): any {

// ✅ 明确类型
function parse(data: string): Result {

// ❌ 过长的函数
async function process() {
  // 100+ 行代码...
}

// ✅ 拆分函数
async function process() {
  const data = await fetchData();
  const parsed = parseData(data);
  return formatResult(parsed);
}

// ❌ 魔法数字
if (status === 1) {

// ✅ 常量定义
const STATUS_ACTIVE = 1;
if (status === STATUS_ACTIVE) {
```

### 🟢 Info（可选优化）

```typescript
// ❌ 可读性差
const r = d.filter(x => x.v > 0).map(x => x.n);

// ✅ 语义化命名
const activeRecords = data
  .filter(record => record.value > 0)
  .map(record => record.name);

// ❌ 重复代码
function processA() { /* 相同逻辑 */ }
function processB() { /* 相同逻辑 */ }

// ✅ 提取公共函数
function process(type: string) {
  // 公共逻辑
}
```

---

## Review 工具

### 自动化检查

```bash
# TypeScript 编译检查
npm run build

# ESLint 检查
npx eslint src/

# 类型检查
npx tsc --noEmit
```

### 手动 Review

1. 阅读代码，理解意图
2. 检查是否符合设计文档
3. 验证边界情况处理
4. 评估可维护性