/**
 * 关联分析模块
 * Association Analysis Module
 * 
 * 实现功能:
 * - Apriori 算法实现
 * - 关联规则挖掘
 * - 支持度、置信度、提升度计算
 * - 输出关联规则列表
 */

// ==================== 类型定义 ====================

export type Item = string;
export type ItemSet = Set<Item>;
export type Transaction = ItemSet;

export interface AssociationRule {
  antecedent: Item[];      // 前项（如果...）
  consequent: Item[];      // 后项（那么...）
  support: number;         // 支持度
  confidence: number;      // 置信度
  lift: number;            // 提升度
  conviction?: number;     // 确信度
  leverage?: number;       // 杠杆率
}

export interface AssociationResult {
  rules: AssociationRule[];
  frequentItemsets: {
    items: Item[];
    support: number;
    count: number;
  }[];
  statistics: {
    transactionCount: number;
    uniqueItems: number;
    ruleCount: number;
    avgSupport: number;
    avgConfidence: number;
    avgLift: number;
  };
  summary: string;
}

export interface AssociationOptions {
  minSupport?: number;      // 最小支持度 (默认 0.1)
  minConfidence?: number;   // 最小置信度 (默认 0.5)
  minLift?: number;         // 最小提升度 (默认 1.0)
  maxItemsetSize?: number;  // 最大项集大小 (默认无限制)
}

// ==================== 辅助函数 ====================

function itemSetToString(items: ItemSet): string {
  return Array.from(items).sort().join(',');
}

function getItemSetSupport(
  itemset: ItemSet,
  transactions: Transaction[]
): number {
  let count = 0;
  for (const transaction of transactions) {
    let contains = true;
    for (const item of itemset) {
      if (!transaction.has(item)) {
        contains = false;
        break;
      }
    }
    if (contains) count++;
  }
  return count / transactions.length;
}

function getItemSetCount(
  itemset: ItemSet,
  transactions: Transaction[]
): number {
  let count = 0;
  for (const transaction of transactions) {
    let contains = true;
    for (const item of itemset) {
      if (!transaction.has(item)) {
        contains = false;
        break;
      }
    }
    if (contains) count++;
  }
  return count;
}

function getSubsetCombinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (arr.length < size) return [];
  if (arr.length === size) return [arr];
  
  const result: T[][] = [];
  
  for (let i = 0; i <= arr.length - size; i++) {
    const head = arr[i];
    const tailCombos = getSubsetCombinations(arr.slice(i + 1), size - 1);
    for (const combo of tailCombos) {
      result.push([head, ...combo]);
    }
  }
  
  return result;
}

function getAllNonEmptySubsets<T>(arr: T[]): T[][] {
  const result: T[][] = [];
  for (let size = 1; size < arr.length; size++) {
    result.push(...getSubsetCombinations(arr, size));
  }
  return result;
}

// ==================== Apriori 算法 ====================

/**
 * 生成候选项集 Ck 从频繁项集 Lk-1
 */
function generateCandidates(prevFrequent: ItemSet[], k: number): ItemSet[] {
  const candidates: ItemSet[] = [];
  const prevItems = prevFrequent.map(s => Array.from(s).sort());
  
  // 连接步骤
  for (let i = 0; i < prevItems.length; i++) {
    for (let j = i + 1; j < prevItems.length; j++) {
      const items1 = prevItems[i];
      const items2 = prevItems[j];
      
      // 检查前 k-2 项是否相同
      let canJoin = true;
      for (let l = 0; l < k - 2; l++) {
        if (items1[l] !== items2[l]) {
          canJoin = false;
          break;
        }
      }
      
      if (canJoin && items1[k - 2] < items2[k - 2]) {
        const newItemSet = new Set([...items1, items2[k - 2]]);
        candidates.push(newItemSet);
      }
    }
  }
  
  // 剪枝步骤：移除包含非频繁子集的候选项
  const prunedCandidates: ItemSet[] = [];
  const prevFrequentSet = new Set(prevItems.map(items => items.join(',')));
  
  for (const candidate of candidates) {
    const items = Array.from(candidate).sort();
    const subsets = getSubsetCombinations(items, k - 1);
    
    let allSubsetsFrequent = true;
    for (const subset of subsets) {
      const subsetKey = subset.sort().join(',');
      if (!prevFrequentSet.has(subsetKey)) {
        allSubsetsFrequent = false;
        break;
      }
    }
    
    if (allSubsetsFrequent) {
      prunedCandidates.push(candidate);
    }
  }
  
  return prunedCandidates;
}

/**
 * Apriori 算法主函数
 */
export function apriori(
  transactions: Transaction[],
  minSupport: number = 0.1
): { frequentItemsets: Map<string, { items: ItemSet; support: number; count: number }>; levels: ItemSet[][] } {
  if (transactions.length === 0) {
    return { frequentItemsets: new Map(), levels: [] };
  }
  
  // 获取所有唯一项
  const allItems = new Set<Item>();
  for (const transaction of transactions) {
    for (const item of transaction) {
      allItems.add(item);
    }
  }
  
  // 生成 1-项集
  let currentLevel: ItemSet[] = Array.from(allItems).map(item => new Set([item]));
  
  // 过滤支持度
  currentLevel = currentLevel.filter(itemset => 
    getItemSetSupport(itemset, transactions) >= minSupport
  );
  
  const frequentItemsets = new Map<string, { items: ItemSet; support: number; count: number }>();
  const levels: ItemSet[][] = [];
  
  // 存储频繁 1-项集
  for (const itemset of currentLevel) {
    const key = itemSetToString(itemset);
    frequentItemsets.set(key, {
      items: itemset,
      support: getItemSetSupport(itemset, transactions),
      count: getItemSetCount(itemset, transactions)
    });
  }
  
  levels.push([...currentLevel]);
  
  // 迭代生成 k-项集
  let k = 2;
  while (currentLevel.length > 0) {
    // 生成候选
    const candidates = generateCandidates(currentLevel, k);
    
    // 过滤支持度
    const newFrequent: ItemSet[] = [];
    for (const candidate of candidates) {
      const support = getItemSetSupport(candidate, transactions);
      if (support >= minSupport) {
        newFrequent.push(candidate);
        const key = itemSetToString(candidate);
        frequentItemsets.set(key, {
          items: candidate,
          support,
          count: getItemSetCount(candidate, transactions)
        });
      }
    }
    
    if (newFrequent.length === 0) break;
    
    levels.push([...newFrequent]);
    currentLevel = newFrequent;
    k++;
  }
  
  return { frequentItemsets, levels };
}

// ==================== 关联规则生成 ====================

export function generateRules(
  frequentItemsets: Map<string, { items: ItemSet; support: number; count: number }>,
  transactions: Transaction[],
  minConfidence: number = 0.5,
  minLift: number = 1.0
): AssociationRule[] {
  const rules: AssociationRule[] = [];
  const n = transactions.length;
  
  // 对每个频繁项集（大小 >= 2）生成规则
  for (const [, data] of frequentItemsets) {
    const items = Array.from(data.items);
    
    if (items.length < 2) continue;
    
    // 生成所有非空子集作为前项
    const subsets = getAllNonEmptySubsets(items);
    
    for (const antecedentItems of subsets) {
      const consequentItems = items.filter(item => !antecedentItems.includes(item));
      
      if (consequentItems.length === 0) continue;
      
      // 计算置信度: support(A∪B) / support(A)
      const antecedent = new Set(antecedentItems);
      const antecedentSupport = getItemSetSupport(antecedent, transactions);
      
      const confidence = data.support / antecedentSupport;
      
      if (confidence < minConfidence) continue;
      
      // 计算提升度: confidence / support(B)
      const consequent = new Set(consequentItems);
      const consequentSupport = getItemSetSupport(consequent, transactions);
      
      const lift = confidence / consequentSupport;
      
      if (lift < minLift) continue;
      
      // 计算确信度: (1 - support(B)) / (1 - confidence)
      const conviction = (1 - consequentSupport) / (1 - confidence);
      
      // 计算杠杆率: support(A∪B) - support(A) × support(B)
      const leverage = data.support - antecedentSupport * consequentSupport;
      
      rules.push({
        antecedent: antecedentItems.sort(),
        consequent: consequentItems.sort(),
        support: data.support,
        confidence,
        lift,
        conviction: isFinite(conviction) ? conviction : undefined,
        leverage
      });
    }
  }
  
  // 按提升度排序
  rules.sort((a, b) => b.lift - a.lift);
  
  return rules;
}

// ==================== 综合关联分析 ====================

export function analyzeAssociation(
  transactions: Transaction[],
  options: AssociationOptions = {}
): AssociationResult {
  const minSupport = options.minSupport ?? 0.1;
  const minConfidence = options.minConfidence ?? 0.5;
  const minLift = options.minLift ?? 1.0;
  
  // 运行 Apriori 算法
  const { frequentItemsets } = apriori(transactions, minSupport);
  
  // 生成关联规则
  const rules = generateRules(frequentItemsets, transactions, minConfidence, minLift);
  
  // 统计信息
  const allItems = new Set<Item>();
  for (const transaction of transactions) {
    for (const item of transaction) {
      allItems.add(item);
    }
  }
  
  const avgSupport = rules.length > 0 
    ? rules.reduce((sum, r) => sum + r.support, 0) / rules.length 
    : 0;
  const avgConfidence = rules.length > 0 
    ? rules.reduce((sum, r) => sum + r.confidence, 0) / rules.length 
    : 0;
  const avgLift = rules.length > 0 
    ? rules.reduce((sum, r) => sum + r.lift, 0) / rules.length 
    : 0;
  
  // 生成摘要
  const summary = generateAssociationSummary(transactions.length, rules.length, avgSupport, avgConfidence, avgLift);
  
  return {
    rules,
    frequentItemsets: Array.from(frequentItemsets.values()).map(f => ({
      items: Array.from(f.items).sort(),
      support: f.support,
      count: f.count
    })),
    statistics: {
      transactionCount: transactions.length,
      uniqueItems: allItems.size,
      ruleCount: rules.length,
      avgSupport,
      avgConfidence,
      avgLift
    },
    summary
  };
}

/**
 * 从二维数组创建事务数据
 */
export function createTransactions(data: Item[][]): Transaction[] {
  return data.map(row => new Set(row));
}

/**
 * 从数值数据创建事务数据（基于分箱）
 */
export function binToTransactions(
  data: { [column: string]: number }[],
  bins: { [column: string]: number } = {}
): Transaction[] {
  return data.map(row => {
    const transaction = new Set<Item>();
    
    for (const [column, value] of Object.entries(row)) {
      const numBins = bins[column] || 5;
      const binIndex = Math.floor(value * numBins); // 假设值在 0-1 范围
      transaction.add(`${column}_bin${binIndex}`);
    }
    
    return transaction;
  });
}

function generateAssociationSummary(
  transactionCount: number,
  ruleCount: number,
  avgSupport: number,
  avgConfidence: number,
  avgLift: number
): string {
  if (ruleCount === 0) {
    return `在 ${transactionCount} 条事务中未发现满足条件的关联规则，建议降低最小支持度或最小置信度`;
  }
  
  const strengthDesc = avgLift > 2 ? '强' : avgLift > 1.5 ? '中等' : '弱';
  
  return `在 ${transactionCount} 条事务中发现 ${ruleCount} 条关联规则，平均支持度 ${(avgSupport * 100).toFixed(1)}%，平均置信度 ${(avgConfidence * 100).toFixed(1)}%，平均提升度 ${avgLift.toFixed(2)}（${strengthDesc}关联）`;
}

// ==================== 输出格式化 ====================

export interface AssociationReport {
  summary: string;
  statistics: {
    transactionCount: number;
    uniqueItems: number;
    ruleCount: number;
    avgSupport: string;
    avgConfidence: string;
    avgLift: string;
  };
  topRules: {
    rule: string;
    antecedent: string[];
    consequent: string[];
    support: string;
    confidence: string;
    lift: string;
    interpretation: string;
  }[];
  frequentItemsets: {
    items: string[];
    support: string;
    count: number;
  }[];
  insights: string[];
}

export function formatAssociationReport(
  result: AssociationResult,
  topN: number = 10
): AssociationReport {
  const insights: string[] = [];
  
  // 强规则洞察
  const strongRules = result.rules.filter(r => r.lift > 2);
  if (strongRules.length > 0) {
    insights.push(`🔗 发现 ${strongRules.length} 条强关联规则（提升度 > 2）`);
  }
  
  // 高置信度规则洞察
  const highConfRules = result.rules.filter(r => r.confidence > 0.8);
  if (highConfRules.length > 0) {
    insights.push(`✅ ${highConfRules.length} 条规则的置信度超过 80%`);
  }
  
  // 最常见项集洞察
  if (result.frequentItemsets.length > 0) {
    const topItemsets = result.frequentItemsets
      .filter(f => f.items.length >= 2)
      .sort((a, b) => b.support - a.support)
      .slice(0, 3);
    
    if (topItemsets.length > 0) {
      const itemsStr = topItemsets.map(f => `{${f.items.join(', ')}}`).join(', ');
      insights.push(`📦 最常见项集: ${itemsStr}`);
    }
  }
  
  // 格式化规则解释
  const formatInterpretation = (rule: AssociationRule): string => {
    const antStr = rule.antecedent.join(' + ');
    const conStr = rule.consequent.join(' + ');
    
    if (rule.lift > 2) {
      return `购买 ${antStr} 的顾客有很大概率（${(rule.confidence * 100).toFixed(0)}%）也会购买 ${conStr}`;
    } else if (rule.lift > 1) {
      return `${antStr} 和 ${conStr} 经常一起出现`;
    } else {
      return `${antStr} 和 ${conStr} 的关联可能是偶然的`;
    }
  };
  
  return {
    summary: result.summary,
    statistics: {
      transactionCount: result.statistics.transactionCount,
      uniqueItems: result.statistics.uniqueItems,
      ruleCount: result.statistics.ruleCount,
      avgSupport: `${(result.statistics.avgSupport * 100).toFixed(2)}%`,
      avgConfidence: `${(result.statistics.avgConfidence * 100).toFixed(2)}%`,
      avgLift: result.statistics.avgLift.toFixed(2)
    },
    topRules: result.rules.slice(0, topN).map(rule => ({
      rule: `{${rule.antecedent.join(', ')}} => {${rule.consequent.join(', ')}}`,
      antecedent: rule.antecedent,
      consequent: rule.consequent,
      support: `${(rule.support * 100).toFixed(2)}%`,
      confidence: `${(rule.confidence * 100).toFixed(2)}%`,
      lift: rule.lift.toFixed(2),
      interpretation: formatInterpretation(rule)
    })),
    frequentItemsets: result.frequentItemsets.slice(0, 20).map(f => ({
      items: f.items,
      support: `${(f.support * 100).toFixed(2)}%`,
      count: f.count
    })),
    insights
  };
}