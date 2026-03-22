import fs from 'fs';
import path from 'path';
import os from 'os';
import { Config } from '../types';

const CONFIG_PATH = path.join(os.homedir(), '.docagent', 'config.json');
const DB_PATH = path.join(os.homedir(), '.docagent', 'db.sqlite');
const CACHE_PATH = path.join(os.homedir(), '.docagent', 'cache');

export const defaultConfig: Config = {
  // 阿里云百炼配置（复用 OpenClaw 配置）
  apiKey: process.env.DOCAGENT_API_KEY || process.env.ZHIPU_API_KEY || '',
  baseUrl: 'https://coding.dashscope.aliyuncs.com/v1',
  llmModel: 'glm-5',           // 或 qwen3.5-plus
  embeddingModel: 'text-embedding-v3',
  chunkSize: 500,
  chunkOverlap: 50,
  topK: 5,
  similarityThreshold: 0.7,
};

export function ensureDirectories(): void {
  const baseDir = path.join(os.homedir(), '.docagent');
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  if (!fs.existsSync(CACHE_PATH)) {
    fs.mkdirSync(CACHE_PATH, { recursive: true });
  }
}

export function loadConfig(): Config {
  ensureDirectories();
  
  if (!fs.existsSync(CONFIG_PATH)) {
    saveConfig(defaultConfig);
    return defaultConfig;
  }
  
  const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
  const config = JSON.parse(content);
  
  // Override with env var if set
  if (process.env.DOCAGENT_API_KEY) {
    config.apiKey = process.env.DOCAGENT_API_KEY;
  } else if (process.env.ZHIPU_API_KEY) {
    config.apiKey = process.env.ZHIPU_API_KEY;
  }
  
  return { ...defaultConfig, ...config };
}

export function saveConfig(config: Partial<Config>): void {
  ensureDirectories();
  const currentConfig = fs.existsSync(CONFIG_PATH) 
    ? JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
    : defaultConfig;
  const merged = { ...currentConfig, ...config };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
}

export function getDbPath(): string {
  return DB_PATH;
}

export function getCachePath(): string {
  return CACHE_PATH;
}