/**
 * 首次启动向导
 * 帮助不懂 API Key 的用户完成配置
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';

// 配置路径
const CONFIG_DIR = process.env.DATAMIND_HOME || path.join(os.homedir(), '.datamind');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// 服务商配置
const PROVIDERS: Record<string, {
  name: string;
  url: string;
  models: string[];
  baseUrl: string;
  noApiKey?: boolean;
}> = {
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
  }
};

/**
 * 检查是否需要设置
 */
export function needSetup(): boolean {
  // 如果有环境变量，不需要设置
  if (process.env.DATAMIND_API_KEY || process.env.ZHIPU_API_KEY) {
    return false;
  }
  // 检查配置文件
  return !fs.existsSync(CONFIG_FILE);
}

/**
 * 获取用户输入（简单的 readline 实现）
 */
async function prompt(text: string, hidden: boolean = false): Promise<string> {
  return new Promise((resolve) => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    if (hidden) {
      // 隐藏输入
      process.stdout.write(text);
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      
      let input = '';
      process.stdin.on('data', (char: string) => {
        if (char === '\n' || char === '\r' || char === '\u0004') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write('\n');
          rl.close();
          resolve(input);
        } else if (char === '\u0003') {
          process.exit();
        } else if (char === '\u007f') {
          // Backspace
          input = input.slice(0, -1);
        } else {
          input += char;
          process.stdout.write('*');
        }
      });
    } else {
      rl.question(text, (answer: string) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

/**
 * 打印选择菜单
 */
function printMenu(options: { key: string; label: string; desc?: string }[]): void {
  console.log();
  options.forEach((opt, i) => {
    const num = chalk.cyan(`  ${i + 1}.`);
    const label = opt.label;
    const desc = opt.desc ? chalk.dim(` - ${opt.desc}`) : '';
    console.log(`${num} ${label}${desc}`);
  });
  console.log();
}

/**
 * 清屏并显示欢迎信息
 */
function showWelcome(): void {
  console.clear();
  console.log();
  console.log(chalk.cyan.bold('  ╭────────────────────────────────────────╮'));
  console.log(chalk.cyan.bold('  │') + '  🚀 欢迎使用 DataMind!                  ' + chalk.cyan.bold('│'));
  console.log(chalk.cyan.bold('  ╰────────────────────────────────────────╯'));
  console.log();
  console.log('  让每个人都能用自然语言分析数据');
  console.log();
}

/**
 * 显示进度条
 */
function showStep(step: number, total: number, title: string): void {
  console.log();
  console.log(chalk.dim(`  [步骤 ${step}/${total}]`), chalk.bold(title));
  console.log(chalk.dim('  ' + '─'.repeat(40)));
  console.log();
}

/**
 * 保存配置
 */
function saveConfig(config: any): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/**
 * 首次启动向导主流程
 */
export async function setupCommand(): Promise<void> {
  const totalSteps = 2;
  
  showWelcome();
  console.log('  检测到这是首次运行，需要配置 AI 服务。');
  console.log(chalk.dim('  （如果已配置环境变量 DATAMIND_API_KEY，可跳过此步骤）'));
  console.log();
  
  // ===== 步骤 1: 选择服务商 =====
  showStep(1, totalSteps, '选择 AI 服务商');
  
  const providerOptions = [
    { key: 'bailian', label: '阿里云百炼', desc: '推荐，国内访问快' },
    { key: 'zhipu', label: '智谱 AI', desc: '国内访问快' },
    { key: 'deepseek', label: 'DeepSeek', desc: '性价比高' },
    { key: 'openai', label: 'OpenAI', desc: '国际版' }
  ];
  
  printMenu(providerOptions);
  
  const providerChoice = await prompt(chalk.bold('  请选择 [1-4]: '));
  const providerIndex = parseInt(providerChoice) - 1;
  
  if (providerIndex < 0 || providerIndex >= providerOptions.length) {
    console.log(chalk.red('  ❌ 无效选择，使用默认：阿里云百炼'));
  }
  
  const providerKey = providerOptions[Math.max(0, Math.min(providerIndex, providerOptions.length - 1))]?.key || 'bailian';
  const provider = PROVIDERS[providerKey];
  
  console.log();
  console.log(chalk.green(`  ✓ 已选择: ${provider.name}`));
  
  // ===== 步骤 2: 输入 API Key =====
  showStep(2, totalSteps, '配置 API Key');
  
  console.log(chalk.yellow('  📝 获取 API Key 步骤：'));
  console.log();
  console.log(`    1. 访问 ${chalk.cyan(provider.url)}`);
  console.log('    2. 登录/注册账号');
  console.log('    3. 创建应用，复制 API Key');
  console.log();
  
  const apiKey = await prompt(chalk.bold('  粘贴你的 API Key: '), true);
  
  if (!apiKey || apiKey.length < 10) {
    console.log();
    console.log(chalk.red('  ❌ API Key 格式不正确'));
    console.log(chalk.dim('  请重新运行 datamind setup 进行配置'));
    process.exit(1);
  }
  
  // 选择模型
  console.log();
  console.log(chalk.bold('  选择模型：'));
  provider.models.forEach((model, i) => {
    const mark = i === 0 ? chalk.green(' (推荐)') : '';
    console.log(`    ${i + 1}. ${model}${mark}`);
  });
  console.log();
  
  const modelChoice = await prompt(chalk.bold('  请选择 [1-3]: '));
  const modelIndex = parseInt(modelChoice) - 1;
  const model = provider.models[Math.max(0, Math.min(modelIndex, provider.models.length - 1))] || provider.models[0];
  
  console.log();
  console.log(chalk.green(`  ✓ 已选择模型: ${model}`));
  
  // ===== 保存配置 =====
  const config = {
    llm: {
      provider: providerKey,
      apiKey: apiKey,
      baseUrl: provider.baseUrl,
      model: model
    },
    storage: {
      dataDir: CONFIG_DIR,
      duckdbPath: path.join(CONFIG_DIR, 'duckdb', 'datamind.db'),
      lancedbPath: path.join(CONFIG_DIR, 'lancedb')
    },
    createdAt: new Date().toISOString()
  };
  
  saveConfig(config);
  
  // ===== 完成 =====
  console.log();
  console.log(chalk.green.bold('  ✅ 配置成功！'));
  console.log();
  console.log(chalk.dim(`  📁 配置已保存到: ${CONFIG_FILE}`));
  console.log();
  console.log(chalk.cyan('  ────────────────────────────────────────'));
  console.log();
  console.log('  现在你可以开始使用了：');
  console.log();
  console.log(chalk.cyan('    # 导入数据'));
  console.log(chalk.dim('    datamind import your_data.csv'));
  console.log();
  console.log(chalk.cyan('    # 用自然语言查询'));
  console.log(chalk.dim('    datamind ask "销售额最高的产品是哪个？"'));
  console.log();
  console.log(chalk.cyan('    # 启动 Web 界面'));
  console.log(chalk.dim('    datamind ui'));
  console.log();
  console.log(chalk.cyan('  ────────────────────────────────────────'));
  console.log();
  console.log(chalk.dim('  💡 数据安全提示：'));
  console.log(chalk.dim('  • API Key 保存在本地，不会上传到云端'));
  console.log(chalk.dim('  • 所有数据处理都在本地完成'));
  console.log(chalk.dim('  • 如需修改配置，运行 datamind setup'));
  console.log();
}

/**
 * 重新配置
 */
export async function reconfigureCommand(): Promise<void> {
  console.log();
  console.log(chalk.cyan.bold('  ⚙️  重新配置 DataMind'));
  console.log();
  
  if (fs.existsSync(CONFIG_FILE)) {
    console.log(chalk.dim('  当前配置将被覆盖...'));
    fs.unlinkSync(CONFIG_FILE);
  }
  
  await setupCommand();
}

/**
 * 查看当前配置
 */
export function showConfig(): void {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.log();
    console.log(chalk.yellow('  ⚠️  尚未配置'));
    console.log();
    console.log('  运行以下命令进行配置：');
    console.log(chalk.cyan('    datamind setup'));
    console.log();
    return;
  }
  
  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  
  console.log();
  console.log(chalk.cyan.bold('  📋 当前配置'));
  console.log();
  console.log(chalk.dim('  ─────────────────────────────────────'));
  console.log();
  console.log(`  服务商: ${chalk.green(config.llm?.provider || '未设置')}`);
  console.log(`  模型:   ${chalk.green(config.llm?.model || '未设置')}`);
  console.log(`  API Key: ${chalk.dim('••••••••' + (config.llm?.apiKey?.slice(-4) || ''))}`);
  console.log(`  数据目录: ${chalk.dim(config.storage?.dataDir || '未设置')}`);
  console.log();
  console.log(chalk.dim('  ─────────────────────────────────────'));
  console.log();
  console.log('  修改配置: ' + chalk.cyan('datamind setup'));
  console.log();
}