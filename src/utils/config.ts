import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { Config } from '../types';
import { ConfigError } from './errors';

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

/**
 * 验证配置是否有效
 * 检查 API Key 是否已配置，未配置时显示友好的错误提示并退出
 */
export function validateConfig(config: Config): void {
  if (!config.llm.apiKey) {
    console.error();
    console.error(chalk.red('错误: 未配置 API Key'));
    console.log();
    console.log('请设置环境变量:');
    console.log(chalk.cyan('  export DATAMIND_API_KEY=your_api_key'));
    console.log();
    console.log('或者在 ~/.zshrc 或 ~/.bashrc 中添加:');
    console.log(chalk.cyan('  export DATAMIND_API_KEY=your_api_key'));
    console.log();
    throw new ConfigError('未配置 API Key');
  }
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