# DataMind 测试文档

## 测试策略

### 测试层级

| 层级 | 说明 | 工具 |
|------|------|------|
| **单元测试** | 测试单个函数/模块 | Jest |
| **集成测试** | 测试模块间交互 | Jest + DuckDB 内存模式 |
| **E2E 测试** | 测试 CLI 命令 | Shell 脚本 |

### 测试覆盖目标

| 模块 | 目标覆盖率 |
|------|------------|
| `src/core/engine/` | 80% |
| `src/core/llm/` | 70% |
| `src/core/importer/` | 80% |
| `src/core/analyzer/` | 70% |
| `src/utils/` | 80% |
| **整体** | **75%** |

---

## 测试环境配置

### 安装依赖

```bash
npm install --save-dev jest @types/jest ts-jest
```

### Jest 配置 (`jest.config.js`)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/cli/index.ts',
    '!src/types/**/*.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
};
```

### Setup 文件 (`tests/setup.ts`)

```typescript
// 全局测试配置
process.env.DATAMIND_API_KEY = 'test-api-key';
process.env.NODE_ENV = 'test';

// 增加超时时间
jest.setTimeout(30000);
```

---

## 测试目录结构

```
tests/
├── setup.ts                    # 全局配置
├── unit/                       # 单元测试
│   ├── core/
│   │   ├── engine/
│   │   │   ├── duckdb.test.ts
│   │   │   └── lancedb.test.ts
│   │   ├── importer/
│   │   │   └── csv.test.ts
│   │   ├── llm/
│   │   │   ├── client.test.ts
│   │   │   └── sql-builder.test.ts
│   │   └── analyzer/
│   │       └── insights.test.ts
│   └── utils/
│       ├── config.test.ts
│       ├── output.test.ts
│       └── errors.test.ts
├── integration/                # 集成测试
│   ├── import-flow.test.ts
│   ├── ask-flow.test.ts
│   └── analyze-flow.test.ts
└── fixtures/                   # 测试数据
    ├── sample.csv
    ├── large.csv              # 大数据集
    └── expected-results/
```

---

## 单元测试规范

### 测试命名

```typescript
// ✅ 好的命名
describe('CSVImporter', () => {
  describe('parseCSV', () => {
    it('should parse valid CSV with headers', () => {});
    it('should handle quoted values', () => {});
    it('should throw error on empty file', () => {});
  });
});

// ❌ 避免的命名
it('test1', () => {});
it('works', () => {});
```

### 测试结构 (AAA 模式)

```typescript
it('should calculate average correctly', () => {
  // Arrange - 准备测试数据
  const data = [1, 2, 3, 4, 5];
  const expected = 3;
  
  // Act - 执行被测试的代码
  const result = calculateAverage(data);
  
  // Assert - 验证结果
  expect(result).toBe(expected);
});
```

### Mock 使用

```typescript
// Mock LLM Client
jest.mock('../../core/llm/client');

const mockClient = {
  chat: jest.fn().mockResolvedValue('SELECT * FROM users'),
};

(LLMClient as jest.Mock).mockImplementation(() => mockClient);
```

---

## 核心测试用例

### 1. DuckDB Engine 测试

```typescript
// tests/unit/core/engine/duckdb.test.ts
import { getDatabase, executeSQL, tableExists, getTableMeta } from '../../../../src/core/engine/duckdb';

describe('DuckDB Engine', () => {
  beforeEach(async () => {
    const db = await getDatabase();
    await db.all('DROP TABLE IF EXISTS test_table');
  });

  describe('getDatabase', () => {
    it('should create database connection', async () => {
      const db = await getDatabase();
      expect(db).toBeDefined();
    });

    it('should return same instance on multiple calls', async () => {
      const db1 = await getDatabase();
      const db2 = await getDatabase();
      expect(db1).toBe(db2);
    });
  });

  describe('executeSQL', () => {
    it('should execute SELECT query', async () => {
      const result = await executeSQL('SELECT 1 as value');
      expect(result).toEqual([{ value: 1 }]);
    });

    it('should execute CREATE TABLE', async () => {
      await executeSQL('CREATE TABLE test_table (id INTEGER)');
      const exists = await tableExists('test_table');
      expect(exists).toBe(true);
    });

    it('should throw error on invalid SQL', async () => {
      await expect(executeSQL('INVALID SQL')).rejects.toThrow();
    });
  });

  describe('tableExists', () => {
    it('should return false for non-existent table', async () => {
      const exists = await tableExists('non_existent');
      expect(exists).toBe(false);
    });

    it('should return true for existing table', async () => {
      await executeSQL('CREATE TABLE test_table (id INTEGER)');
      const exists = await tableExists('test_table');
      expect(exists).toBe(true);
    });
  });

  describe('getTableMeta', () => {
    it('should return null for non-existent table', async () => {
      const meta = await getTableMeta('non_existent');
      expect(meta).toBeNull();
    });

    it('should return correct metadata', async () => {
      await executeSQL('CREATE TABLE test_table (id INTEGER, name VARCHAR)');
      await executeSQL("INSERT INTO test_table VALUES (1, 'test')");
      
      const meta = await getTableMeta('test_table');
      expect(meta).toMatchObject({
        name: 'test_table',
        rowCount: 1,
        columns: expect.arrayContaining([
          expect.objectContaining({ name: 'id', type: 'number' }),
          expect.objectContaining({ name: 'name', type: 'string' })
        ])
      });
    });
  });
});
```

### 2. CSV Importer 测试

```typescript
// tests/unit/core/importer/csv.test.ts
import * as fs from 'fs';
import * as path from 'path';
import { parseCSV, importCSV, validateTableName } from '../../../../src/core/importer/csv';

describe('CSV Importer', () => {
  const fixturesDir = path.join(__dirname, '../../../fixtures');

  describe('validateTableName', () => {
    it('should allow valid table names', () => {
      expect(validateTableName('users')).toBe('users');
      expect(validateTableName('user_data')).toBe('user_data');
      expect(validateTableName('table123')).toBe('table123');
    });

    it('should sanitize invalid characters', () => {
      expect(validateTableName('user-data')).toBe('user_data');
      expect(validateTableName('user data')).toBe('user_data');
      expect(validateTableName('Users')).toBe('users');
    });

    it('should throw on empty result', () => {
      expect(() => validateTableName('!!!')).toThrow('无效的表名');
    });
  });

  describe('parseCSV', () => {
    it('should parse simple CSV', async () => {
      const result = await parseCSV(path.join(fixturesDir, 'sample.csv'));
      
      expect(result.headers).toEqual(['id', 'name', 'value']);
      expect(result.rows).toHaveLength(3);
      expect(result.columnTypes.get('id')).toBe('number');
    });

    it('should handle quoted values', async () => {
      const csvPath = path.join(fixturesDir, 'quoted.csv');
      fs.writeFileSync(csvPath, 'id,name\n1,"John, Doe"\n2,"Quoted ""value"""');
      
      const result = await parseCSV(csvPath);
      expect(result.rows[0][1]).toBe('John, Doe');
      expect(result.rows[1][1]).toBe('Quoted "value"');
      
      fs.unlinkSync(csvPath);
    });

    it('should throw on empty file', async () => {
      const csvPath = path.join(fixturesDir, 'empty.csv');
      fs.writeFileSync(csvPath, '');
      
      await expect(parseCSV(csvPath)).rejects.toThrow('CSV 文件为空');
      
      fs.unlinkSync(csvPath);
    });

    it('should infer column types correctly', async () => {
      const csvPath = path.join(fixturesDir, 'types.csv');
      fs.writeFileSync(csvPath, 'num,str,date,bool\n123,hello,2024-01-01,true\n456,world,2024-01-02,false');
      
      const result = await parseCSV(csvPath);
      expect(result.columnTypes.get('num')).toBe('number');
      expect(result.columnTypes.get('str')).toBe('string');
      expect(result.columnTypes.get('date')).toBe('date');
      expect(result.columnTypes.get('bool')).toBe('boolean');
      
      fs.unlinkSync(csvPath);
    });
  });

  describe('importCSV', () => {
    it('should import CSV to database', async () => {
      const meta = await importCSV(path.join(fixturesDir, 'sample.csv'), 'test_import');
      
      expect(meta.name).toBe('test_import');
      expect(meta.rowCount).toBe(3);
      expect(meta.columns).toHaveLength(3);
    });
  });
});
```

### 3. SQL Builder 测试

```typescript
// tests/unit/core/llm/sql-builder.test.ts
import { SQLBuilder } from '../../../../src/core/llm/sql-builder';
import { LLMClient } from '../../../../src/core/llm/client';
import { TableMeta } from '../../../../src/types';

jest.mock('../../../../src/core/llm/client');

describe('SQLBuilder', () => {
  let builder: SQLBuilder;
  let mockClient: jest.Mocked<LLMClient>;

  const mockTables: TableMeta[] = [{
    name: 'sales',
    rowCount: 100,
    columns: [
      { name: 'id', type: 'number', nullable: false, sampleValues: [1, 2, 3] },
      { name: 'product', type: 'string', nullable: false, sampleValues: ['iPhone', 'Mac'] },
      { name: 'amount', type: 'number', nullable: false, sampleValues: [1000, 2000] }
    ],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }];

  beforeEach(() => {
    mockClient = {
      chat: jest.fn(),
      chatWithJSON: jest.fn()
    } as any;
    
    builder = new SQLBuilder(mockClient);
  });

  describe('generateSQL', () => {
    it('should generate SQL from natural language', async () => {
      mockClient.chat.mockResolvedValue('SELECT * FROM sales LIMIT 10');
      
      const sql = await builder.generateSQL('显示前10条销售记录', mockTables);
      
      expect(sql).toBe('SELECT * FROM sales LIMIT 10');
      expect(mockClient.chat).toHaveBeenCalled();
    });

    it('should reject dangerous SQL', async () => {
      mockClient.chat.mockResolvedValue('DROP TABLE sales');
      
      await expect(builder.generateSQL('删除表', mockTables))
        .rejects.toThrow('安全限制');
    });

    it('should clean markdown code blocks', async () => {
      mockClient.chat.mockResolvedValue('```sql\nSELECT * FROM sales\n```');
      
      const sql = await builder.generateSQL('查询所有数据', mockTables);
      
      expect(sql).toBe('SELECT * FROM sales');
    });
  });
});
```

### 4. Utils 测试

```typescript
// tests/unit/utils/errors.test.ts
import { DataMindError, ConfigError, QueryError, ImportError } from '../../../src/utils/errors';

describe('Errors', () => {
  describe('DataMindError', () => {
    it('should create error with code', () => {
      const error = new DataMindError('Test error', 'TEST_CODE');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('DataMindError');
    });
  });

  describe('ConfigError', () => {
    it('should create config error', () => {
      const error = new ConfigError('Missing API key');
      expect(error.code).toBe('CONFIG_ERROR');
      expect(error.exitCode).toBe(1);
    });
  });
});

// tests/unit/utils/config.test.ts
import { getConfig, validateConfig } from '../../../src/utils/config';
import { ConfigError } from '../../../src/utils/errors';

describe('Config', () => {
  describe('getConfig', () => {
    it('should return default config', () => {
      const config = getConfig();
      expect(config.llm.provider).toBe('bailian');
      expect(config.llm.model).toBe('glm-5');
    });

    it('should use DATAMIND_API_KEY if set', () => {
      process.env.DATAMIND_API_KEY = 'test-key';
      const config = getConfig();
      expect(config.llm.apiKey).toBe('test-key');
      delete process.env.DATAMIND_API_KEY;
    });
  });

  describe('validateConfig', () => {
    it('should pass with valid API key', () => {
      const config = getConfig();
      config.llm.apiKey = 'valid-key';
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should throw ConfigError without API key', () => {
      const config = getConfig();
      config.llm.apiKey = '';
      expect(() => validateConfig(config)).toThrow(ConfigError);
    });
  });
});
```

---

## 集成测试

### Import Flow 测试

```typescript
// tests/integration/import-flow.test.ts
import * as fs from 'fs';
import * as path from 'path';
import { importCSV } from '../../src/core/importer/csv';
import { getTableMeta, executeSQL } from '../../src/core/engine/duckdb';

describe('Import Flow', () => {
  const testDir = path.join(__dirname, '../fixtures/temp');

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should complete full import flow', async () => {
    // Create test CSV
    const csvPath = path.join(testDir, 'test.csv');
    fs.writeFileSync(csvPath, 'id,name,value\n1,Alice,100\n2,Bob,200');

    // Import
    const meta = await importCSV(csvPath, 'test_data');
    expect(meta.name).toBe('test_data');
    expect(meta.rowCount).toBe(2);

    // Verify data
    const dbMeta = await getTableMeta('test_data');
    expect(dbMeta).not.toBeNull();
    expect(dbMeta?.rowCount).toBe(2);

    // Query data
    const result = await executeSQL('SELECT * FROM test_data ORDER BY id');
    expect(result).toEqual([
      { id: 1, name: 'Alice', value: 100 },
      { id: 2, name: 'Bob', value: 200 }
    ]);
  });
});
```

---

## 运行测试

### 命令

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- csv.test.ts

# 运行并生成覆盖率报告
npm test -- --coverage

# 监听模式
npm test -- --watch
```

### package.json 脚本

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --reporters=default --reporters=jest-junit"
  }
}
```

---

## CI/CD 集成

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test -- --coverage
        env:
          DATAMIND_API_KEY: ${{ secrets.TEST_API_KEY }}
      
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
```

---

## 测试最佳实践

### 1. 隔离性

```typescript
// ✅ 每个测试独立
beforeEach(async () => {
  await executeSQL('DROP TABLE IF EXISTS test_table');
});

afterEach(async () => {
  await executeSQL('DROP TABLE IF EXISTS test_table');
});
```

### 2. 清理资源

```typescript
// ✅ 清理文件和数据库
afterAll(async () => {
  await closeDatabase();
  fs.rmSync(testDir, { recursive: true });
});
```

### 3. 使用 Fixtures

```typescript
// ✅ 使用固定的测试数据
const sampleCSV = path.join(fixturesDir, 'sample.csv');

// ❌ 避免在测试中动态生成
const data = Array(1000).fill({ id: 1, name: 'test' });
```

### 4. Mock 外部依赖

```typescript
// ✅ Mock LLM API
jest.mock('../../src/core/llm/client');

// ✅ Mock 文件系统（谨慎使用）
jest.mock('fs');
```

---

## 测试覆盖率报告

### 生成报告

```bash
npm test -- --coverage
```

### 查看报告

```
coverage/
├── lcov.info          # CI 集成用
├── clover.xml         # Clover 格式
└── lcov-report/
    └── index.html     # HTML 报告，浏览器打开
```

### 覆盖率目标

| 指标 | 最低 | 目标 |
|------|------|------|
| Statements | 70% | 80% |
| Branches | 60% | 75% |
| Functions | 70% | 80% |
| Lines | 70% | 80% |