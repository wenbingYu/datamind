/**
 * DataMind 统一错误处理
 */

/**
 * 基础错误类
 */
export class DataMindError extends Error {
  constructor(
    message: string,
    public code: string,
    public exitCode: number = 1
  ) {
    super(message);
    this.name = 'DataMindError';
  }
}

/**
 * 配置错误 - API Key 未配置等
 */
export class ConfigError extends DataMindError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR', 1);
    this.name = 'ConfigError';
  }
}

/**
 * 查询错误 - SQL 生成或执行失败
 */
export class QueryError extends DataMindError {
  constructor(message: string) {
    super(message, 'QUERY_ERROR', 1);
    this.name = 'QueryError';
  }
}

/**
 * 导入错误 - 数据导入失败
 */
export class ImportError extends DataMindError {
  constructor(message: string) {
    super(message, 'IMPORT_ERROR', 1);
    this.name = 'ImportError';
  }
}

/**
 * 文件错误 - 文件不存在或格式不支持
 */
export class FileError extends DataMindError {
  constructor(message: string) {
    super(message, 'FILE_ERROR', 1);
    this.name = 'FileError';
  }
}