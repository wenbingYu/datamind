// 全局测试配置
process.env.DATAMIND_API_KEY = 'test-api-key';
process.env.NODE_ENV = 'test';

// 增加超时时间（DuckDB 操作可能较慢）
jest.setTimeout(30000);
