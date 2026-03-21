/**
 * API Key 管理 CLI 命令
 */

import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import {
  createAPIKey,
  listAPIKeys,
  revokeAPIKey,
  deleteAPIKey,
  getAPIKeyInfo,
  PlanType,
  PLAN_QUOTAS
} from '../../ui/apikeys';

// Key 命令
const keyCommand = new Command('key')
  .description('管理 API Keys');

// datamind key generate
keyCommand
  .command('generate')
  .description('生成新的 API Key')
  .option('-n, --name <name>', 'API Key 名称')
  .option('-p, --plan <plan>', '计划类型 (free/pro/team)', 'free')
  .action(async (options: { name?: string; plan: string }) => {
    try {
      // 如果没有提供名称，使用默认名称
      const name = options.name || `API Key ${new Date().toISOString().split('T')[0]}`;
      
      // 验证计划类型
      if (!['free', 'pro', 'team'].includes(options.plan)) {
        console.error(chalk.red('错误: 无效的计划类型'));
        console.log(chalk.dim('支持的计划: free, pro, team'));
        process.exit(1);
      }
      
      const keyInfo = createAPIKey({
        name,
        plan: options.plan as PlanType
      });
      
      console.log();
      console.log(chalk.green.bold('✓ API Key 已创建'));
      console.log();
      console.log(chalk.white('  名称: ') + chalk.cyan(keyInfo.name));
      console.log(chalk.white('  计划: ') + chalk.cyan(keyInfo.plan));
      console.log(chalk.white('  Key:  ') + chalk.yellow(keyInfo.key));
      console.log();
      console.log(chalk.dim('  配额:'));
      console.log(chalk.dim(`    每分钟: ${PLAN_QUOTAS[keyInfo.plan].requestsPerMinute} 次`));
      console.log(chalk.dim(`    每天: ${PLAN_QUOTAS[keyInfo.plan].requestsPerDay} 次`));
      console.log();
      console.log(chalk.yellow('  ⚠️  请妥善保管此 Key，它只会显示一次！'));
      console.log();
    } catch (error) {
      console.error(chalk.red('创建失败:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// datamind key list
keyCommand
  .command('list')
  .description('列出所有 API Keys')
  .option('--revoked', '显示已撤销的 Keys')
  .action(async (options: { revoked?: boolean }) => {
    try {
      const keys = listAPIKeys(options.revoked);
      
      if (keys.length === 0) {
        console.log();
        console.log(chalk.dim('  暂无 API Keys'));
        console.log(chalk.dim('  使用 datamind key generate 创建'));
        console.log();
        return;
      }
      
      const table = new Table({
        head: [
          chalk.cyan('名称'),
          chalk.cyan('Key'),
          chalk.cyan('计划'),
          chalk.cyan('配额(分/天)'),
          chalk.cyan('请求次数'),
          chalk.cyan('状态')
        ],
        style: {
          head: [],
          border: ['dim']
        }
      });
      
      for (const key of keys) {
        const quota = `${PLAN_QUOTAS[key.plan].requestsPerMinute}/${PLAN_QUOTAS[key.plan].requestsPerDay}`;
        const status = key.revoked 
          ? chalk.red('已撤销')
          : chalk.green('正常');
        const displayKey = key.key.slice(0, 12) + '...' + key.key.slice(-4);
        
        table.push([
          key.name,
          displayKey,
          key.plan,
          quota,
          key.requestCount.toString(),
          status
        ]);
      }
      
      console.log();
      console.log(table.toString());
      console.log(chalk.dim(`  共 ${keys.length} 个 API Keys`));
      console.log();
    } catch (error) {
      console.error(chalk.red('查询失败:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// datamind key revoke
keyCommand
  .command('revoke <key>')
  .description('撤销 API Key')
  .action(async (key: string) => {
    try {
      const success = revokeAPIKey(key);
      
      if (!success) {
        console.error(chalk.red('错误: API Key 不存在'));
        process.exit(1);
      }
      
      console.log();
      console.log(chalk.green.bold('✓ API Key 已撤销'));
      console.log(chalk.dim(`  Key: ${key}`));
      console.log();
    } catch (error) {
      console.error(chalk.red('撤销失败:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// datamind key delete
keyCommand
  .command('delete <key>')
  .description('删除 API Key')
  .action(async (key: string) => {
    try {
      const success = deleteAPIKey(key);
      
      if (!success) {
        console.error(chalk.red('错误: API Key 不存在'));
        process.exit(1);
      }
      
      console.log();
      console.log(chalk.green.bold('✓ API Key 已删除'));
      console.log(chalk.dim(`  Key: ${key}`));
      console.log();
    } catch (error) {
      console.error(chalk.red('删除失败:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// datamind key info
keyCommand
  .command('info <key>')
  .description('查看 API Key 详情')
  .action(async (key: string) => {
    try {
      const keyInfo = getAPIKeyInfo(key);
      
      if (!keyInfo) {
        console.error(chalk.red('错误: API Key 不存在'));
        process.exit(1);
      }
      
      console.log();
      console.log(chalk.cyan.bold('  API Key 详情'));
      console.log();
      console.log(chalk.white('  名称: ') + chalk.cyan(keyInfo.name));
      console.log(chalk.white('  Key:  ') + chalk.yellow(keyInfo.key));
      console.log(chalk.white('  计划: ') + chalk.cyan(keyInfo.plan));
      console.log(chalk.white('  状态: ') + (keyInfo.revoked ? chalk.red('已撤销') : chalk.green('正常')));
      console.log();
      console.log(chalk.dim('  配额:'));
      console.log(chalk.dim(`    每分钟: ${PLAN_QUOTAS[keyInfo.plan].requestsPerMinute} 次`));
      console.log(chalk.dim(`    每天: ${PLAN_QUOTAS[keyInfo.plan].requestsPerDay} 次`));
      console.log();
      console.log(chalk.dim('  统计:'));
      console.log(chalk.dim(`    创建时间: ${new Date(keyInfo.createdAt).toLocaleString('zh-CN')}`));
      console.log(chalk.dim(`    请求次数: ${keyInfo.requestCount}`));
      if (keyInfo.lastUsedAt) {
        console.log(chalk.dim(`    最后使用: ${new Date(keyInfo.lastUsedAt).toLocaleString('zh-CN')}`));
      }
      if (keyInfo.revokedAt) {
        console.log(chalk.dim(`    撤销时间: ${new Date(keyInfo.revokedAt).toLocaleString('zh-CN')}`));
      }
      console.log();
    } catch (error) {
      console.error(chalk.red('查询失败:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

export default keyCommand;