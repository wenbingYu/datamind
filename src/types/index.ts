/** 数据表元数据 */
export interface TableMeta {
  name: string;
  rowCount: number;
  columns: ColumnMeta[];
  createdAt: number;
  updatedAt: number;
}

/** 列元数据 */
export interface ColumnMeta {
  name: string;
  type: 'number' | 'string' | 'date' | 'boolean';
  nullable: boolean;
  sampleValues: any[];
}

/** 查询结果 */
export interface QueryResult {
  sql: string;
  columns: string[];
  rows: any[][];
  rowCount: number;
  executionTime: number;
}

/** 洞察结果 */
export interface Insight {
  type: 'trend' | 'anomaly' | 'correlation' | 'distribution';
  title: string;
  description: string;
  significance: 'high' | 'medium' | 'low';
  data?: any;
}

/** 配置 */
export interface Config {
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