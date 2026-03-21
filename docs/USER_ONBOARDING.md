# DataMind 用户引导设计

## 目标用户分析

| 用户类型 | 技术能力 | 痛点 |
|---------|---------|------|
| 运营 | 低 | 不懂 API Key、环境变量 |
| 产品 | 中 | 能配置但觉得麻烦 |
| 数据分析师 | 高 | 没问题 |

## 解决方案

### 方案 A：首次启动向导（推荐立即实现）

**CLI 交互流程**：

```
$ datamind

╭──────────────────────────────────────────────╮
│  🚀 欢迎使用 DataMind！                       │
│                                              │
│  检测到这是首次运行，需要配置 AI 服务。       │
│                                              │
│  请选择 AI 服务商：                           │
│    1. 阿里云百炼（推荐，国内快）              │
│    2. 智谱 AI                                │
│    3. DeepSeek                              │
│    4. OpenAI                                │
│    5. 本地模型 Ollama（完全离线）            │
│                                              │
│  选择 [1-5]: _                               │
╰──────────────────────────────────────────────╯

选择 1 后：

╭──────────────────────────────────────────────╮
│  📝 获取阿里云百炼 API Key                     │
│                                              │
│  步骤：                                       │
│  1. 访问 https://bailian.console.aliyun.com  │
│  2. 登录/注册阿里云账号                       │
│  3. 创建应用，获取 API Key                    │
│                                              │
│  粘贴你的 API Key（输入时隐藏）: ****         │
╰──────────────────────────────────────────────╯

✅ 配置成功！

现在可以使用：
  datamind import sales.csv
  datamind ask "销售额最高的产品"
```

### 方案 B：Web UI 配置页面

```
┌─────────────────────────────────────────────────┐
│  DataMind - 设置                                │
├─────────────────────────────────────────────────┤
│                                                 │
│  🤖 AI 服务配置                                 │
│                                                 │
│  服务商: [阿里云百炼 ▼]                         │
│                                                 │
│  API Key: [••••••••••••••••]  [显示] [测试]    │
│                                                 │
│  模型: [qwen-max ▼]                            │
│                                                 │
│  ✅ 连接测试成功                                │
│                                                 │
│  [保存配置]                                     │
│                                                 │
├─────────────────────────────────────────────────┤
│  💡 提示                                        │
│  • API Key 保存在本地，不会上传到云端           │
│  • 推荐使用阿里云百炼，国内访问速度快           │
│  • 企业用户建议使用自己的 API Key               │
└─────────────────────────────────────────────────┘
```

### 方案 C：内置免费额度（需要后端支持）

```
┌─────────────────────────────────────────────────┐
│  DataMind - 欢迎使用                            │
├─────────────────────────────────────────────────┤
│                                                 │
│  🎁 新用户福利：100次免费查询                   │
│                                                 │
│  当前剩余：100 次                               │
│                                                 │
│  [开始使用]                                     │
│                                                 │
├─────────────────────────────────────────────────┤
│  ⚠️ 数据安全提示                                │
│                                                 │
│  免费额度期间，数据会经过 DataMind 服务器       │
│  处理您的自然语言查询。                         │
│                                                 │
│  如需完全本地处理，请配置自己的 API Key。       │
│                                                 │
│  [配置自己的API Key] [继续使用免费额度]         │
└─────────────────────────────────────────────────┘
```

## 数据安全分级

| 模式 | 数据流向 | 安全级别 | 适用场景 |
|------|---------|---------|---------|
| 免费额度 | 用户→DataMind→LLM | 中 | 个人学习、测试 |
| 自己的Key | 用户→本地→LLM | 高 | 企业、敏感数据 |
| 本地模型 | 用户→本地→本地 | 最高 | 金融、医疗、政府 |

## 推荐实施顺序

1. **立即**：首次启动向导（CLI 交互）
2. **短期**：Web UI 配置页面
3. **中期**：支持 Ollama 本地模型
4. **长期**：内置免费额度（需要后端）

## 代码实现

### src/cli/commands/setup.ts

```typescript
import inquirer from 'inquirer';
import chalk from 'chalk';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const CONFIG_DIR = process.env.DATAMIND_HOME || join(os.homedir(), '.datamind');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

interface LLMConfig {
  provider: 'bailian' | 'zhipu' | 'deepseek' | 'openai' | 'ollama';
  apiKey?: string;
  baseUrl?: string;
  model: string;
}

const PROVIDERS = {
  bailian: {
    name: '阿里云百炼',
    url: 'https://bailian.console.aliyun.com',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  },
  zhipu: {
    name: '智谱 AI',
    url: 'https://open.bigmodel.cn',
    models: ['glm-4', 'glm-4-flash', 'glm-3-turbo'],
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4'
  },
  deepseek: {
    name: 'DeepSeek',
    url: 'https://platform.deepseek.com',
    models: ['deepseek-chat', 'deepseek-coder'],
    baseUrl: 'https://api.deepseek.com/v1'
  },
  openai: {
    name: 'OpenAI',
    url: 'https://platform.openai.com',
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    baseUrl: 'https://api.openai.com/v1'
  },
  ollama: {
    name: 'Ollama（本地）',
    url: 'http://localhost:11434',
    models: [], // 动态获取
    baseUrl: 'http://localhost:11434/v1',
    noApiKey: true
  }
};

export async function setupCommand() {
  console.log();
  console.log(chalk.cyan.bold('  🚀 欢迎使用 DataMind！'));
  console.log();
  console.log('  检测到这是首次运行，需要配置 AI 服务。');
  console.log();

  // 选择服务商
  const { provider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: '请选择 AI 服务商：',
      choices: Object.entries(PROVIDERS).map(([key, value]) => ({
        name: `${value.name}${key === 'bailian' ? '（推荐，国内快）' : key === 'ollama' ? '（完全离线）' : ''}`,
        value: key
      }))
    }
  ]);

  const providerConfig = PROVIDERS[provider as keyof typeof PROVIDERS];
  
  let apiKey = '';
  let model = '';

  if (!providerConfig.noApiKey) {
    // 显示获取指南
    console.log();
    console.log(chalk.yellow('  📝 获取 API Key 步骤：'));
    console.log(`  1. 访问 ${chalk.cyan(providerConfig.url)}`);
    console.log('  2. 登录/注册账号');
    console.log('  3. 创建应用，获取 API Key');
    console.log();

    // 输入 API Key
    const { key } = await inquirer.prompt([
      {
        type: 'password',
        name: 'key',
        message: '粘贴你的 API Key：',
        mask: '*'
      }
    ]);
    apiKey = key;

    // 选择模型
    const { selectedModel } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedModel',
        message: '选择模型：',
        choices: providerConfig.models,
        default: providerConfig.models[0]
      }
    ]);
    model = selectedModel;
  } else {
    // Ollama 本地模型
    model = 'qwen2.5:7b';
    console.log();
    console.log(chalk.green('  ✅ 检测到本地模型配置'));
    console.log(`  使用模型: ${model}`);
  }

  // 保存配置
  const config = {
    llm: {
      provider,
      apiKey,
      baseUrl: providerConfig.baseUrl,
      model
    },
    storage: {
      dataDir: CONFIG_DIR,
      duckdbPath: join(CONFIG_DIR, 'duckdb', 'datamind.db'),
      lancedbPath: join(CONFIG_DIR, 'lancedb')
    }
  };

  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

  console.log();
  console.log(chalk.green('  ✅ 配置成功！'));
  console.log(chalk.dim(`  配置已保存到 ${CONFIG_FILE}`));
  console.log();
  console.log('  现在你可以开始使用了：');
  console.log(chalk.cyan('    datamind import your_data.csv'));
  console.log(chalk.cyan('    datamind ask "你的问题"'));
  console.log();
}

// 检查是否需要设置
export function needSetup(): boolean {
  return !existsSync(CONFIG_FILE);
}
```

