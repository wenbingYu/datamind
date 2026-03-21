import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { Config } from '../types';

const DEFAULT_DATA_DIR = path.join(os.homedir(), '.datamind');

export function getConfig(): Config {
  const apiKey = process.env.DATAMIND_API_KEY || process.env.ZHIPU_API_KEY || '';
  
  return {
    llm: {
      provider: 'bailian',
      model: 'glm-5',
      apiKey: apiKey,
      baseUrl: 'https://coding.dashscope.aliyuncs.com/v1'
    },
    storage: {
      dataDir: DEFAULT_DATA_DIR,
      duckdbPath: path.join(DEFAULT_DATA_DIR, 'duckdb', 'datamind.db'),
      lancedbPath: path.join(DEFAULT_DATA_DIR, 'lancedb')
    }
  };
}

export function ensureDataDir(): void {
  const config = getConfig();
  const dirs = [
    config.storage.dataDir,
    path.dirname(config.storage.duckdbPath),
    config.storage.lancedbPath
  ];
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}