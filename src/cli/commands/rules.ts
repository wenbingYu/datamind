/**
 * datamind rules — NLP 规则管理命令
 *
 * 子命令:
 *   datamind rules                           查看规则摘要
 *   datamind rules list <category>           列出某类规则
 *   datamind rules add <category> <key> <value>  添加规则
 *   datamind rules remove <category> <key>   删除规则
 *   datamind rules path                      显示规则文件路径
 *   datamind rules export                    导出完整规则文件
 *   datamind rules reset                     重置为空（仅清除用户规则）
 */

import { Command } from 'commander';
import chalk from 'chalk';
import {
  addRule,
  removeRule,
  listRules,
  getRulesSummary,
  getRulesFilePath,
  saveUserRules,
  loadUserRules,
  RuleCategory,
} from '../../core/nlp/rules-config';
import { reloadRules, lemmatize } from '../../core/nlp/lemmatizer';

const VALID_CATEGORIES: RuleCategory[] = [
  'abbreviations',
  'irregular_verbs',
  'irregular_nouns',
  'irregular_adjectives',
  'no_strip',
];

function isCategoryValid(cat: string): cat is RuleCategory {
  return VALID_CATEGORIES.includes(cat as RuleCategory);
}

function printCategoryHelp(): void {
  console.log(chalk.dim('  可用类别 (category):'));
  console.log(chalk.dim('    abbreviations         缩写归一 (e.g. AI = artificial intelligence)'));
  console.log(chalk.dim('    irregular_verbs        不规则动词 (e.g. went → go)'));
  console.log(chalk.dim('    irregular_nouns        不规则名词 (e.g. children → child)'));
  console.log(chalk.dim('    irregular_adjectives   不规则形容词 (e.g. better → good)'));
  console.log(chalk.dim('    no_strip              保护词 (不做后缀剥离)'));
}

const rulesCommand = new Command('rules')
  .description('管理 NLP 词形归一化规则');

// datamind rules (默认: 显示摘要)
rulesCommand
  .action(() => {
    const summary = getRulesSummary();
    const filePath = getRulesFilePath();

    console.log();
    console.log(chalk.cyan.bold('  NLP 规则配置'));
    console.log(chalk.dim(`  规则文件: ${filePath}`));
    console.log();

    const hasAny = summary.some(s => s.count > 0);
    if (!hasAny) {
      console.log(chalk.yellow('  尚未添加任何用户自定义规则。'));
      console.log(chalk.dim('  系统内置规则仍然生效。'));
      console.log();
      console.log(chalk.dim('  添加规则示例:'));
      console.log(chalk.dim('    datamind rules add abbreviations wifi "wireless fidelity"'));
      console.log(chalk.dim('    datamind rules add irregular_verbs went go'));
      console.log(chalk.dim('    datamind rules add no_strip weather'));
      console.log();
    } else {
      console.log('  用户自定义规则统计:');
      console.log();
      for (const s of summary) {
        const bar = s.count > 0 ? chalk.green(`${s.count} 条`) : chalk.dim('0 条');
        console.log(`    ${s.label}:  ${bar}`);
      }
      console.log();
      console.log(chalk.dim('  使用 datamind rules list <category> 查看详情'));
      console.log();
    }

    printCategoryHelp();
    console.log();
  });

// datamind rules list <category>
rulesCommand
  .command('list <category>')
  .description('列出某类用户自定义规则')
  .action((category: string) => {
    if (!isCategoryValid(category)) {
      console.error(chalk.red(`无效的类别: ${category}`));
      console.log();
      printCategoryHelp();
      return;
    }

    const rules = listRules(category);
    console.log();

    if (category === 'no_strip') {
      const arr = rules as string[];
      if (arr.length === 0) {
        console.log(chalk.yellow(`  保护词列表为空 (用户自定义)`));
      } else {
        console.log(chalk.cyan(`  保护词 (${arr.length} 条):`));
        console.log(`    ${arr.join(', ')}`);
      }
    } else {
      const dict = rules as Record<string, string>;
      const entries = Object.entries(dict);
      if (entries.length === 0) {
        console.log(chalk.yellow(`  ${category} 规则为空 (用户自定义)`));
      } else {
        console.log(chalk.cyan(`  ${category} (${entries.length} 条):`));
        for (const [k, v] of entries) {
          console.log(`    ${k} → ${v}`);
        }
      }
    }
    console.log();
  });

// datamind rules add <category> <key> [value]
rulesCommand
  .command('add <category> <key> [value]')
  .description('添加一条规则')
  .action((category: string, key: string, value?: string) => {
    if (!isCategoryValid(category)) {
      console.error(chalk.red(`无效的类别: ${category}`));
      console.log();
      printCategoryHelp();
      return;
    }

    if (category === 'no_strip') {
      addRule('no_strip', key, '');
      reloadRules();
      console.log(chalk.green(`✔ 已添加保护词: ${key}`));
    } else if (!value) {
      console.error(chalk.red(`缺少 value 参数`));
      console.log(chalk.dim(`  示例: datamind rules add ${category} <variant> <base_form>`));
      return;
    } else {
      addRule(category, key, value);
      reloadRules();
      console.log(chalk.green(`✔ 已添加规则: ${key} → ${value} (${category})`));

      // 验证效果
      const result = lemmatize(key);
      console.log(chalk.dim(`  验证: lemmatize("${key}") = "${result}"`));
    }
  });

// datamind rules remove <category> <key>
rulesCommand
  .command('remove <category> <key>')
  .description('删除一条用户规则')
  .action((category: string, key: string) => {
    if (!isCategoryValid(category)) {
      console.error(chalk.red(`无效的类别: ${category}`));
      return;
    }

    const removed = removeRule(category, key);
    if (removed) {
      reloadRules();
      console.log(chalk.green(`✔ 已删除规则: ${key} (${category})`));
    } else {
      console.log(chalk.yellow(`未找到规则: ${key} (${category})`));
    }
  });

// datamind rules path
rulesCommand
  .command('path')
  .description('显示规则文件路径')
  .action(() => {
    console.log(getRulesFilePath());
  });

// datamind rules export
rulesCommand
  .command('export')
  .description('导出当前用户规则 (JSON)')
  .action(() => {
    const rules = loadUserRules();
    console.log(JSON.stringify(rules, null, 2));
  });

// datamind rules reset
rulesCommand
  .command('reset')
  .description('重置用户规则为空 (内置规则不受影响)')
  .action(() => {
    saveUserRules({});
    reloadRules();
    console.log(chalk.green('✔ 用户自定义规则已重置'));
    console.log(chalk.dim('  内置规则仍然生效'));
  });

// datamind rules test <word>
rulesCommand
  .command('test <word>')
  .description('测试单词的词形归一化结果')
  .action((word: string) => {
    reloadRules();
    const result = lemmatize(word);
    console.log();
    console.log(`  输入: ${chalk.cyan(word)}`);
    console.log(`  Lemma: ${chalk.green(result)}`);
    if (result !== word.toLowerCase()) {
      console.log(chalk.dim(`  (${word} → ${result})`));
    } else {
      console.log(chalk.dim('  (未变化 — 已是原形或无匹配规则)'));
    }
    console.log();
  });

export default rulesCommand;
