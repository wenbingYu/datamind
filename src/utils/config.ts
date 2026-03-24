import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { Config } from '../types';
import { ConfigError } from './errors';

// 支持自定义数据目录，默认 ~/.datamind
const DEFAULT_DATA_DIR = process.env.DATAMIND_HOME || path.join(os.homedir(), '.datamind');
const CONFIG_FILE = path.join(DEFAULT_DATA_DIR, 'config.json');

/**
 * 从配置文件加载配置
 */
function loadConfigFile(): Partial<Config> | null {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    // 配置文件读取失败，忽略
  }
  return null;
}

export function getConfig(): Config {
  // 优先级：环境变量 > 配置文件 > 默认值
  const envApiKey = process.env.DATAMIND_API_KEY || process.env.ZHIPU_API_KEY || '';
  const fileConfig = loadConfigFile();

  return {
    llm: {
      provider: fileConfig?.llm?.provider || 'bailian',
      model: fileConfig?.llm?.model || 'qwen-plus',
      apiKey: envApiKey || fileConfig?.llm?.apiKey || '',
      baseUrl: fileConfig?.llm?.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    },
    storage: {
      dataDir: fileConfig?.storage?.dataDir || DEFAULT_DATA_DIR,
      duckdbPath: fileConfig?.storage?.duckdbPath || path.join(DEFAULT_DATA_DIR, 'duckdb', 'datamind.db'),
      lancedbPath: fileConfig?.storage?.lancedbPath || path.join(DEFAULT_DATA_DIR, 'lancedb')
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