/**
 * NLP 规则配置管理器
 *
 * 规则文件路径: ~/.datamind/nlp-rules.json
 * 用户可以通过 CLI 或直接编辑文件来添加/修改规则。
 * 系统内置规则 + 用户规则合并，用户规则优先级更高。
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

// ==================== 类型定义 ====================

export interface NlpRulesConfig {
  /** 缩写映射: { "ai": "artificial intelligence", "tv": "television" } */
  abbreviations: Record<string, string>;
  /** 不规则动词: { "went": "go", "gone": "go" } */
  irregular_verbs: Record<string, string>;
  /** 不规则名词: { "children": "child", "men": "man" } */
  irregular_nouns: Record<string, string>;
  /** 不规则形容词: { "better": "good", "worst": "bad" } */
  irregular_adjectives: Record<string, string>;
  /** 保护词列表（不做后缀剥离的单词） */
  no_strip: string[];
  /** 英美拼写变体: { "color": "colour", "center": "centre" } */
  spelling_variants: Record<string, string>;
  /** 复合名词短语: { "mobile phone": "mobile phone", "ice cream": "ice cream" } */
  compound_nouns: Record<string, string>;
}

export type RuleCategory = keyof NlpRulesConfig;

// ==================== 路径常量 ====================

const DATA_DIR = process.env.DATAMIND_HOME || path.join(os.homedir(), '.datamind');
const RULES_FILE = path.join(DATA_DIR, 'nlp-rules.json');

// ==================== 文件操作 ====================

/**
 * 加载用户自定义规则文件
 * 如果文件不存在或解析失败，返回空规则集
 */
export function loadUserRules(): Partial<NlpRulesConfig> {
  try {
    if (fs.existsSync(RULES_FILE)) {
      const content = fs.readFileSync(RULES_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch {
    // 文件不存在或解析失败，忽略
  }
  return {};
}

/**
 * 保存用户自定义规则到文件
 */
export function saveUserRules(rules: Partial<NlpRulesConfig>): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2), 'utf-8');
}

/**
 * 获取规则文件路径
 */
export function getRulesFilePath(): string {
  return RULES_FILE;
}

// ==================== 规则操作 ====================

/**
 * 添加规则（合并到用户配置文件中）
 */
export function addRule(
  category: RuleCategory,
  key: string,
  value: string
): void {
  const rules = loadUserRules();

  if (category === 'no_strip') {
    if (!rules.no_strip) rules.no_strip = [];
    const word = key.toLowerCase();
    if (!rules.no_strip.includes(word)) {
      rules.no_strip.push(word);
    }
  } else {
    if (!rules[category]) {
      (rules as any)[category] = {};
    }
    (rules[category] as Record<string, string>)[key.toLowerCase()] = value.toLowerCase();
  }

  saveUserRules(rules);
}

/**
 * 批量添加缩写规则
 * 输入格式: "AI = artificial intelligence"
 * 自动展开为双向映射
 */
export function addAbbreviationRule(abbr: string, fullForm: string): void {
  addRule('abbreviations', abbr.toLowerCase(), fullForm.toLowerCase());
}

/**
 * 删除规则
 */
export function removeRule(category: RuleCategory, key: string): boolean {
  const rules = loadUserRules();

  if (category === 'no_strip') {
    if (!rules.no_strip) return false;
    const idx = rules.no_strip.indexOf(key.toLowerCase());
    if (idx >= 0) {
      rules.no_strip.splice(idx, 1);
      saveUserRules(rules);
      return true;
    }
    return false;
  } else {
    const dict = rules[category] as Record<string, string> | undefined;
    if (!dict || !(key.toLowerCase() in dict)) return false;
    delete dict[key.toLowerCase()];
    saveUserRules(rules);
    return true;
  }
}

/**
 * 列出某个类别中的用户规则
 */
export function listRules(category: RuleCategory): Record<string, string> | string[] {
  const rules = loadUserRules();
  if (category === 'no_strip') {
    return rules.no_strip || [];
  }
  return (rules[category] as Record<string, string>) || {};
}

/**
 * 列出所有用户规则的统计信息
 */
export function getRulesSummary(): { category: string; count: number; label: string }[] {
  const rules = loadUserRules();
  return [
    {
      category: 'abbreviations',
      label: '缩写归一 (Abbreviations)',
      count: Object.keys(rules.abbreviations || {}).length,
    },
    {
      category: 'irregular_verbs',
      label: '不规则动词 (Irregular Verbs)',
      count: Object.keys(rules.irregular_verbs || {}).length,
    },
    {
      category: 'irregular_nouns',
      label: '不规则名词 (Irregular Nouns)',
      count: Object.keys(rules.irregular_nouns || {}).length,
    },
    {
      category: 'irregular_adjectives',
      label: '不规则形容词 (Irregular Adjectives)',
      count: Object.keys(rules.irregular_adjectives || {}).length,
    },
    {
      category: 'no_strip',
      label: '保护词 (No-Strip Words)',
      count: (rules.no_strip || []).length,
    },
  ];
}
