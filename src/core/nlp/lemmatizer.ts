/**
 * 英文词形还原器 (Lemmatizer)
 *
 * 规则：
 *   1. 动词变体 → 原形（过去式、第三人称单数、现在分词、过去分词）
 *   2. 名词变体 → 原形（复数、所有格）
 *   3. 形容词变体 → 原形（比较级、最高级）
 *   4. 缩写归一（AI → artificial intelligence 等）
 *
 * 采用"不规则表 + 规则后缀剥离"的两级策略，不依赖外部 NLP 库。
 * 内置规则 + 用户自定义规则（~/.datamind/nlp-rules.json）合并，用户规则优先。
 */

import { loadUserRules } from './rules-config';

// ==================== 不规则动词（内置默认） ====================

const BUILTIN_IRREGULAR_VERBS: Record<string, string> = {
  // be
  am: 'be', is: 'be', are: 'be', was: 'be', were: 'be', been: 'be', being: 'be',
  // have
  has: 'have', had: 'have', having: 'have',
  // do
  does: 'do', did: 'do', done: 'do', doing: 'do',
  // go
  goes: 'go', went: 'go', gone: 'go', going: 'go',
  // say
  said: 'say', says: 'say', saying: 'say',
  // get
  got: 'get', gotten: 'get', gets: 'get', getting: 'get',
  // make
  made: 'make', makes: 'make', making: 'make',
  // know
  knew: 'know', known: 'know', knows: 'know', knowing: 'know',
  // think
  thought: 'think', thinks: 'think', thinking: 'think',
  // take
  took: 'take', taken: 'take', takes: 'take', taking: 'take',
  // see
  saw: 'see', seen: 'see', sees: 'see', seeing: 'see',
  // come
  came: 'come', comes: 'come', coming: 'come',
  // give
  gave: 'give', given: 'give', gives: 'give', giving: 'give',
  // find
  found: 'find', finds: 'find', finding: 'find',
  // tell
  told: 'tell', tells: 'tell', telling: 'tell',
  // become
  became: 'become', becomes: 'become', becoming: 'become',
  // leave
  left: 'leave', leaves: 'leave', leaving: 'leave',
  // feel
  felt: 'feel', feels: 'feel', feeling: 'feel',
  // put
  puts: 'put', putting: 'put',
  // bring
  brought: 'bring', brings: 'bring', bringing: 'bring',
  // begin
  began: 'begin', begun: 'begin', begins: 'begin', beginning: 'begin',
  // keep
  kept: 'keep', keeps: 'keep', keeping: 'keep',
  // hold
  held: 'hold', holds: 'hold', holding: 'hold',
  // write
  wrote: 'write', written: 'write', writes: 'write', writing: 'write',
  // stand
  stood: 'stand', stands: 'stand', standing: 'stand',
  // hear
  heard: 'hear', hears: 'hear', hearing: 'hear',
  // let
  lets: 'let', letting: 'let',
  // mean
  meant: 'mean', means: 'mean', meaning: 'mean',
  // set
  sets: 'set', setting: 'set',
  // meet
  met: 'meet', meets: 'meet', meeting: 'meet',
  // run
  ran: 'run', runs: 'run', running: 'run',
  // pay
  paid: 'pay', pays: 'pay', paying: 'pay',
  // sit
  sat: 'sit', sits: 'sit', sitting: 'sit',
  // speak
  spoke: 'speak', spoken: 'speak', speaks: 'speak', speaking: 'speak',
  // lie
  lay: 'lie', lain: 'lie', lies: 'lie', lying: 'lie',
  // lead
  led: 'lead', leads: 'lead', leading: 'lead',
  // read
  reads: 'read', reading: 'read',
  // grow
  grew: 'grow', grown: 'grow', grows: 'grow', growing: 'grow',
  // lose
  lost: 'lose', loses: 'lose', losing: 'lose',
  // fall
  fell: 'fall', fallen: 'fall', falls: 'fall', falling: 'fall',
  // send
  sent: 'send', sends: 'send', sending: 'send',
  // build
  built: 'build', builds: 'build', building: 'build',
  // understand
  understood: 'understand', understands: 'understand', understanding: 'understand',
  // draw
  drew: 'draw', drawn: 'draw', draws: 'draw', drawing: 'draw',
  // break
  broke: 'break', broken: 'break', breaks: 'break', breaking: 'break',
  // spend
  spent: 'spend', spends: 'spend', spending: 'spend',
  // cut
  cuts: 'cut', cutting: 'cut',
  // catch
  caught: 'catch', catches: 'catch', catching: 'catch',
  // drive
  drove: 'drive', driven: 'drive', drives: 'drive', driving: 'drive',
  // buy
  bought: 'buy', buys: 'buy', buying: 'buy',
  // wear
  wore: 'wear', worn: 'wear', wears: 'wear', wearing: 'wear',
  // choose
  chose: 'choose', chosen: 'choose', chooses: 'choose', choosing: 'choose',
  // seek
  sought: 'seek', seeks: 'seek', seeking: 'seek',
  // throw
  threw: 'throw', thrown: 'throw', throws: 'throw', throwing: 'throw',
  // teach
  taught: 'teach', teaches: 'teach', teaching: 'teach',
  // deal
  dealt: 'deal', deals: 'deal', dealing: 'deal',
  // show
  showed: 'show', shown: 'show', shows: 'show', showing: 'show',
  // rise
  rose: 'rise', risen: 'rise', rises: 'rise', rising: 'rise',
  // fight
  fought: 'fight', fights: 'fight', fighting: 'fight',
  // hit
  hits: 'hit', hitting: 'hit',
  // sing
  sang: 'sing', sung: 'sing', sings: 'sing', singing: 'sing',
  // swim
  swam: 'swim', swum: 'swim', swims: 'swim', swimming: 'swim',
  // fly
  flew: 'fly', flown: 'fly', flies: 'fly', flying: 'fly',
  // eat
  ate: 'eat', eaten: 'eat', eats: 'eat', eating: 'eat',
  // drink
  drank: 'drink', drunk: 'drink', drinks: 'drink', drinking: 'drink',
  // sleep
  slept: 'sleep', sleeps: 'sleep', sleeping: 'sleep',
  // wake
  woke: 'wake', woken: 'wake', wakes: 'wake', waking: 'wake',
  // sell
  sold: 'sell', sells: 'sell', selling: 'sell',
  // win
  won: 'win', wins: 'win', winning: 'win',
  // ride
  rode: 'ride', ridden: 'ride', rides: 'ride', riding: 'ride',
  // shake
  shook: 'shake', shaken: 'shake', shakes: 'shake', shaking: 'shake',
  // forget
  forgot: 'forget', forgotten: 'forget', forgets: 'forget', forgetting: 'forget',
  // blow
  blew: 'blow', blown: 'blow', blows: 'blow', blowing: 'blow',
  // hang
  hung: 'hang', hangs: 'hang', hanging: 'hang',
  // steal
  stole: 'steal', stolen: 'steal', steals: 'steal', stealing: 'steal',
  // hide
  hid: 'hide', hidden: 'hide', hides: 'hide', hiding: 'hide',
  // bite
  bit: 'bite', bitten: 'bite', bites: 'bite', biting: 'bite',
  // tear
  tore: 'tear', torn: 'tear', tears: 'tear', tearing: 'tear',
  // feed
  fed: 'feed', feeds: 'feed', feeding: 'feed',
  // dig
  dug: 'dig', digs: 'dig', digging: 'dig',
  // spread: regular (spread/spread/spread)
  spreads: 'spread', spreading: 'spread',
  // shut
  shuts: 'shut', shutting: 'shut',
  // cost: regular (cost/cost/cost)
  costs: 'cost', costing: 'cost',
  // quit
  quits: 'quit', quitting: 'quit',
  // hurt
  hurts: 'hurt', hurting: 'hurt',
  // lay (to place)
  laid: 'lay', lays: 'lay', laying: 'lay',
  // light
  lit: 'light', lights: 'light', lighting: 'light',
  // shoot
  shot: 'shoot', shoots: 'shoot', shooting: 'shoot',
  // freeze
  froze: 'freeze', frozen: 'freeze', freezes: 'freeze', freezing: 'freeze',
  // forbid
  forbade: 'forbid', forbidden: 'forbid', forbids: 'forbid', forbidding: 'forbid',
  // forgive
  forgave: 'forgive', forgiven: 'forgive', forgives: 'forgive', forgiving: 'forgive',
  // swear
  swore: 'swear', sworn: 'swear', swears: 'swear', swearing: 'swear',
  // overcome
  overcame: 'overcome', overcomes: 'overcome', overcoming: 'overcome',
  // undertake
  undertook: 'undertake', undertaken: 'undertake', undertakes: 'undertake',
  // withdraw
  withdrew: 'withdraw', withdrawn: 'withdraw', withdraws: 'withdraw',
  // use (短词，规则剥离无法处理)
  used: 'use', uses: 'use', using: 'use',
};

// ==================== 不规则名词复数（内置默认） ====================

const BUILTIN_IRREGULAR_NOUNS: Record<string, string> = {
  men: 'man', women: 'woman', children: 'child', teeth: 'tooth',
  feet: 'foot', mice: 'mouse', geese: 'goose', oxen: 'ox',
  people: 'person', dice: 'die', lives: 'life', wives: 'wife',
  knives: 'knife', halves: 'half', selves: 'self', shelves: 'shelf',
  wolves: 'wolf', thieves: 'thief', loaves: 'loaf', leaves: 'leaf',
  calves: 'calf', scarves: 'scarf',
  // 不规则名词的所有格形式（apostrophe 被 cleanWord 去除后产生的形式）
  // children's → childrens, women's → womens, men's → mens 等
  childrens: 'child', womens: 'woman', mens: 'man', teeths: 'tooth',
  feets: 'foot', mices: 'mouse', geeses: 'goose', oxens: 'ox',
  peoples: 'person',
  phenomena: 'phenomenon', criteria: 'criterion', analyses: 'analysis',
  bases: 'basis', crises: 'crisis', theses: 'thesis',
  hypotheses: 'hypothesis', diagnoses: 'diagnosis', oases: 'oasis',
  parentheses: 'parenthesis', syntheses: 'synthesis',
  alumni: 'alumnus', fungi: 'fungus', cacti: 'cactus',
  nuclei: 'nucleus', syllabi: 'syllabus', stimuli: 'stimulus',
  data: 'datum', media: 'medium', bacteria: 'bacterium',
  curricula: 'curriculum', memoranda: 'memorandum',
  indices: 'index', appendices: 'appendix', matrices: 'matrix',
  vertices: 'vertex', axes: 'axis',
};

// ==================== 不规则形容词比较级 / 最高级（内置默认） ====================

const BUILTIN_IRREGULAR_ADJECTIVES: Record<string, string> = {
  better: 'good', best: 'good',
  worse: 'bad', worst: 'bad',
  more: 'many', most: 'many',
  less: 'little', least: 'little',
  further: 'far', furthest: 'far',
  farther: 'far', farthest: 'far',
  elder: 'old', eldest: 'old',
  older: 'old', oldest: 'old',
};

// ==================== 缩写归一（内置默认） ====================

/**
 * 缩写 → 全称 映射
 * key 为小写缩写，value 为小写全称（多个单词用空格分隔）
 */
const BUILTIN_ABBREVIATIONS: Record<string, string> = {
  ad: 'advertisement',
  ai: 'artificial intelligence',
  app: 'application',
  bike: 'bicycle',
  exam: 'examination',
  fridge: 'refrigerator',
  gym: 'gymnasium',
  kilo: 'kilogram',
  lab: 'laboratory',
  maths: 'mathematics',
  pe: 'physical education',
  photo: 'photograph',
  tv: 'television',
  pc: 'personal computer',
  uk: 'united kingdom',
  us: 'united states',
  usa: 'united states',
  diy: 'do it yourself',
  vip: 'very important person',
  id: 'identification',
  iq: 'intelligence quotient',
  ok: 'okay',
  asap: 'as soon as possible',
  etc: 'et cetera',
  vs: 'versus',
  dna: 'deoxyribonucleic acid',
  gps: 'global positioning system',
  wifi: 'wireless fidelity',
  atm: 'automated teller machine',
  ceo: 'chief executive officer',
  fyi: 'for your information',
  ufo: 'unidentified flying object',
};

/**
 * 全称 → 缩写 反向映射（多词短语 → 缩写）
 * key 为小写全称，value 为小写缩写
 */
let PHRASE_TO_ABBR: Record<string, string> = {};

/**
 * 单词全称 → 缩写 反向映射（单个单词，如 television → tv）
 */
let SINGLE_WORD_TO_ABBR: Record<string, string> = {};

/**
 * 全称中包含的所有多词短语（按长度降序排列以支持最长匹配）
 * 每个元素为 [短语单词数组, 缩写]
 */
let MULTI_WORD_PHRASES: [string[], string][] = [];

// ==================== 英美拼写变体（内置默认） ====================

/**
 * 英美拼写变体映射：variant → primary
 * 两个拼写形式都映射到同一个主形式（取 cleanWord 后的第一个为主形式）
 *
 * 常见模式:
 *   -ise / -ize:  apologise ↔ apologize
 *   -our / -or:   colour ↔ color
 *   -re / -er:    centre ↔ center
 *   -logue / -log: dialogue ↔ dialog
 *   -ence / -ense: defence ↔ defense
 *   -yse / -yze:  analyse ↔ analyze
 *   -isation / -ization: organisation ↔ organization
 *   grey / gray 等不规则
 */
const BUILTIN_SPELLING_VARIANTS: Record<string, string> = {
  // -ise / -ize (British primary)
  apologize: 'apologise', apologizes: 'apologise', apologized: 'apologise', apologizing: 'apologise',
  criticize: 'criticise', criticizes: 'criticise', criticized: 'criticise', criticizing: 'criticise',
  organize: 'organise', organizes: 'organise', organized: 'organise', organizing: 'organise',
  recognize: 'recognise', recognizes: 'recognise', recognized: 'recognise', recognizing: 'recognise',
  realize: 'realise', realizes: 'realise', realized: 'realise', realizing: 'realise',
  practise: 'practice', practises: 'practice', practised: 'practice', practising: 'practice',
  // -our / -or
  color: 'colour', colors: 'colour', colored: 'colour', coloring: 'colour',
  favor: 'favour', favors: 'favour', favored: 'favour', favoring: 'favour',
  favorite: 'favourite', favorites: 'favourite',
  flavor: 'flavour', flavors: 'flavour', flavored: 'flavour', flavoring: 'flavour',
  honor: 'honour', honors: 'honour', honored: 'honour', honoring: 'honour',
  humor: 'humour', humors: 'humour', humored: 'humour', humoring: 'humour',
  labor: 'labour', labors: 'labour', labored: 'labour', laboring: 'labour',
  neighbor: 'neighbour', neighbors: 'neighbour', neighborhood: 'neighbourhood',
  // -re / -er
  center: 'centre', centers: 'centre', centered: 'centre', centering: 'centre',
  meter: 'metre', meters: 'metre',
  theater: 'theatre', theaters: 'theatre',
  kilometer: 'kilometre', kilometers: 'kilometre',
  centimeter: 'centimetre', centimeters: 'centimetre',
  millimeter: 'millimetre', millimeters: 'millimetre',
  // -logue / -log
  dialog: 'dialogue', dialogs: 'dialogue',
  // -isation / -ization
  civilization: 'civilisation', civilizations: 'civilisation',
  organization: 'organisation', organizations: 'organisation',
  // -yse / -yze
  analyze: 'analyse', analyzes: 'analyse', analyzed: 'analyse', analyzing: 'analyse',
  // -gram / -gramme
  gram: 'gramme', grams: 'gramme',
  program: 'programme', programs: 'programme',
  // irregular
  gray: 'grey',
  disk: 'disc', disks: 'disc',
  toward: 'towards',
  percent: 'per cent',
  till: 'until',
  // math/maths: 美式 math → 英式 maths
  math: 'maths',
};

/**
 * 运行时拼写变体表（内置 + 用户自定义合并）
 */
let SPELLING_VARIANTS: Record<string, string> = {};

// ==================== 复合名词短语（内置默认） ====================

/**
 * 复合名词短语：多个单词组成一个词义单元
 * key 为短语（空格分隔），value 为归一后的连写形式（lemma）
 *
 * 例如: "mobile phone" → "mobile phone" (保留原始短语作为 lemma)
 * 这些短语在 detectPhrases() 中被识别，所有组成词归一到同一个 lemma
 */
const BUILTIN_COMPOUND_NOUNS: Record<string, string> = {
  'mobile phone': 'mobile phone',
  'ice cream': 'ice cream',
  'kung fu': 'kung fu',
  'due to': 'due to',
  'ought to': 'ought to',
  'high school': 'high school',
  'primary school': 'primary school',
  'middle school': 'middle school',
  'living room': 'living room',
  'dining room': 'dining room',
  'post office': 'post office',
  'bus stop': 'bus stop',
  'credit card': 'credit card',
  'first aid': 'first aid',
  'traffic light': 'traffic light',
  'solar system': 'solar system',
  'global warming': 'global warming',
  'social media': 'social media',
  'climate change': 'climate change',
  'human being': 'human being',
  'remote control': 'remote control',
  'text message': 'text message',
  'roller coaster': 'roller coaster',
  'science fiction': 'science fiction',
  'blood pressure': 'blood pressure',
  'junk food': 'junk food',
  'fast food': 'fast food',
  'theme park': 'theme park',
  'car park': 'car park',
  'parking lot': 'parking lot',
  'department store': 'department store',
  'shopping mall': 'shopping mall',
  'swimming pool': 'swimming pool',
  'washing machine': 'washing machine',
  'air conditioning': 'air conditioning',
  'traffic jam': 'traffic jam',
  'rush hour': 'rush hour',
  'good morning': 'good morning',
  'good afternoon': 'good afternoon',
  'good evening': 'good evening',
  'good night': 'good night',
};

/**
 * 运行时复合名词表（内置 + 用户自定义合并）
 */
let COMPOUND_NOUNS: Record<string, string> = {};

// ==================== 运行时合并表（内置 + 用户） ====================

let IRREGULAR_VERBS: Record<string, string> = {};
let IRREGULAR_NOUNS: Record<string, string> = {};
let IRREGULAR_ADJECTIVES: Record<string, string> = {};
let ABBREVIATIONS: Record<string, string> = {};
let NO_STRIP: Set<string> = new Set();

/**
 * 根据 ABBREVIATIONS 和 COMPOUND_NOUNS 表重建多词短语映射
 */
function rebuildPhraseMappings(): void {
  PHRASE_TO_ABBR = {};
  SINGLE_WORD_TO_ABBR = {};
  MULTI_WORD_PHRASES = [];

  // 缩写的反向映射
  for (const [abbr, fullForm] of Object.entries(ABBREVIATIONS)) {
    const words = fullForm.toLowerCase().split(/\s+/);
    if (words.length >= 2) {
      PHRASE_TO_ABBR[fullForm.toLowerCase()] = abbr;
      MULTI_WORD_PHRASES.push([words, abbr]);
    } else if (words.length === 1) {
      SINGLE_WORD_TO_ABBR[words[0]] = abbr;
    }
  }

  // 复合名词短语
  for (const [phrase, lemma] of Object.entries(COMPOUND_NOUNS)) {
    const words = phrase.toLowerCase().split(/\s+/);
    if (words.length >= 2) {
      MULTI_WORD_PHRASES.push([words, lemma]);
    }
  }

  MULTI_WORD_PHRASES.sort((a, b) => b[0].length - a[0].length);
}

/**
 * 加载并合并规则：内置默认 + 用户自定义（用户规则优先）
 * 在模块首次加载时自动调用，也可在用户修改规则后手动调用以刷新。
 */
export function reloadRules(): void {
  const userRules = loadUserRules();

  // 合并（用户规则覆盖内置规则）
  IRREGULAR_VERBS = { ...BUILTIN_IRREGULAR_VERBS, ...(userRules.irregular_verbs || {}) };
  IRREGULAR_NOUNS = { ...BUILTIN_IRREGULAR_NOUNS, ...(userRules.irregular_nouns || {}) };
  IRREGULAR_ADJECTIVES = { ...BUILTIN_IRREGULAR_ADJECTIVES, ...(userRules.irregular_adjectives || {}) };
  ABBREVIATIONS = { ...BUILTIN_ABBREVIATIONS, ...(userRules.abbreviations || {}) };

  // 拼写变体: 内置 + 用户自定义
  SPELLING_VARIANTS = { ...BUILTIN_SPELLING_VARIANTS, ...(userRules.spelling_variants || {}) };

  // 复合名词: 内置 + 用户自定义
  COMPOUND_NOUNS = { ...BUILTIN_COMPOUND_NOUNS, ...(userRules.compound_nouns || {}) };

  // NO_STRIP: 内置列表 + 用户列表合并
  NO_STRIP = new Set([...BUILTIN_NO_STRIP, ...(userRules.no_strip || [])]);

  // 重建多词短语映射（缩写 + 复合名词）
  rebuildPhraseMappings();
}

// 注意：reloadRules() 必须在所有 BUILTIN_* 定义之后调用，见文件末尾的初始化块

/**
 * 解析词汇表中的缩写条目，如 "AI (=artificial intelligence)" → "ai"
 * 返回缩写（小写），如果不是缩写格式则返回 null
 */
export function parseVocabAbbreviation(vocabWord: string): string | null {
  // 匹配 "XXX (=yyy zzz)" 或 "XXX(=yyy zzz)" 格式
  const match = vocabWord.match(/^([a-zA-Z]+)\s*\(?=\s*(.+?)\)?\s*$/);
  if (match) {
    return match[1].toLowerCase();
  }
  return null;
}

/**
 * 解析词汇表中的拼写变体条目，如 "apologise (apologize)*" → "apologise"
 * 返回主形式（小写），如果不是变体格式则返回 null
 *
 * 格式: "primary (variant)" 或 "primary (variant1, variant2)"
 * 与缩写格式的区别：缩写用 "=" 前缀，变体不用
 */
export function parseVocabVariant(vocabWord: string): { primary: string; variants: string[] } | null {
  // 匹配 "word (variant)" 格式，排除缩写 "word (=xxx)" 格式
  const match = vocabWord.match(/^([a-zA-Z]+(?:\s+[a-zA-Z]+)*)\s*\(([^=][^)]*)\)\s*\**\s*$/);
  if (!match) return null;

  const primary = cleanWord(match[1]);
  const variantPart = match[2];
  const variants = variantPart.split(/[,，]\s*/).map(v => cleanWord(v)).filter(v => v.length > 0 && v !== primary);

  if (variants.length === 0) return null;

  return { primary, variants };
}

/**
 * 在单词序列中检测多词短语并替换 lemma
 *
 * 输入：已 tokenize 的单词列表（小写）
 * 输出：每个单词的 lemma（多词短语中的每个词 lemma 都设为缩写）
 *
 * 例如: ["artificial", "intelligence", "is", "great"]
 *   → lemma: ["ai", "ai", "is", "great"]
 *   第一个词标记为短语头，后续词标记为短语续
 */
export function detectPhrases(
  words: string[]
): { lemma: string; phraseSkip: boolean }[] {
  const result: { lemma: string; phraseSkip: boolean }[] =
    words.map(w => ({ lemma: w, phraseSkip: false }));

  let i = 0;
  while (i < words.length) {
    let matched = false;
    // 尝试每个多词短语（已按长度降序）
    for (const [phraseWords, abbr] of MULTI_WORD_PHRASES) {
      if (i + phraseWords.length > words.length) continue;

      let isMatch = true;
      for (let j = 0; j < phraseWords.length; j++) {
        if (words[i + j] !== phraseWords[j]) {
          isMatch = false;
          break;
        }
      }

      if (isMatch) {
        // 短语首词的 lemma 设为缩写，其余标记为 phraseSkip
        result[i].lemma = abbr;
        result[i].phraseSkip = false;
        for (let j = 1; j < phraseWords.length; j++) {
          result[i + j].lemma = abbr;
          result[i + j].phraseSkip = true;  // 跳过：不单独计数
        }
        i += phraseWords.length;
        matched = true;
        break;
      }
    }
    if (!matched) i++;
  }

  return result;
}

// ==================== 规则后缀剥离 ====================

/**
 * 辅音字母集合
 */
const CONSONANTS = new Set('bcdfghjklmnpqrstvwxyz'.split(''));

function isConsonant(ch: string): boolean {
  return CONSONANTS.has(ch);
}

function isVowel(ch: string): boolean {
  return 'aeiou'.includes(ch);
}

/**
 * 最小词干长度：规则剥离后词干不得短于此值，否则不剥离
 */
const MIN_STEM = 3;

// 以 -ie 结尾的常见词（复数加 -s 变 -ies，而非 consonant+y→ies 模式）
// cookie→cookies, brownie→brownies, calorie→calories 等
const IE_ENDING_WORDS = new Set([
  'cookie', 'brownie', 'calorie', 'collie', 'zombie',
  'birdie', 'pixie', 'magpie', 'sortie', 'prairie',
  'boogie', 'movie', 'smoothie', 'beanie', 'genie',
  'goalie', 'hoodie', 'junkie', 'pinkie', 'rookie',
  'selfie', 'veggie', 'caddie', 'dearie', 'eerie',
  'foodie', 'groupie', 'hippie', 'lassie', 'meanie',
  'mountie', 'nappie', 'oldie', 'pie', 'reverie',
  'roomie', 'sweetie', 'techie', 'yuppie', 'auntie',
  'brie', 'collie', 'die', 'lie', 'tie', 'vie',
]);

/**
 * 不应被后缀剥离的常见单词（看起来像有后缀，但实际就是原形）
 */
const BUILTIN_NO_STRIP = new Set([
  // -ing 不可剥离
  'thing', 'nothing', 'something', 'anything', 'everything',
  'king', 'ring', 'sing', 'wing', 'bring', 'string', 'spring', 'swing', 'sting', 'cling', 'fling', 'sling', 'wring',
  'morning', 'evening', 'during', 'ceiling', 'feeling',
  'being', 'seeing',
  'offering', 'suffering', 'engineering',
  // -er 不可剥离（是名词本身而非比较级）
  'water', 'weather', 'whether', 'other', 'another', 'mother', 'father', 'brother', 'sister',
  'after', 'under', 'over', 'never', 'ever', 'together', 'however', 'whatever', 'whenever', 'wherever', 'whoever',
  'power', 'flower', 'tower', 'shower', 'cover', 'discover', 'recover',
  'number', 'member', 'remember', 'november', 'december', 'september', 'october',
  'computer', 'center', 'letter', 'matter', 'dinner', 'summer', 'winter', 'inner', 'manner',
  'order', 'border', 'corner', 'finger', 'danger', 'anger', 'hunger', 'wonder', 'thunder',
  'paper', 'proper', 'super', 'silver', 'river', 'liver', 'fever', 'clever',
  'offer', 'differ', 'suffer', 'butter', 'litter', 'bitter', 'trigger', 'consider',
  'answer', 'master', 'monster', 'chapter', 'character', 'minister', 'disaster',
  'teacher', 'worker', 'player', 'leader', 'reader', 'speaker', 'writer', 'driver', 'singer',
  'manager', 'officer', 'soldier', 'stranger', 'passenger', 'customer', 'volunteer',
  'producer', 'consumer', 'researcher', 'designer', 'engineer', 'pioneer', 'traveler',
  'newcomer', 'performer', 'reporter', 'observer', 'employer', 'container',
  'beer', 'deer', 'career', 'pioneer', 'volunteer', 'steer',
  'tiger', 'ginger', 'gender', 'tender', 'render', 'slender',
  'enter', 'counter', 'encounter', 'foster', 'poster', 'register',
  'either', 'neither', 'rather', 'gather', 'feather', 'leather', 'heather',
  // -ed 不可剥离
  'bed', 'red', 'fed', 'led', 'shed', 'sled', 'wed',
  'need', 'seed', 'feed', 'speed', 'indeed', 'proceed',
  'hundred', 'sacred', 'wicked', 'naked', 'hatred',
  // -es 不可剥离
  'yes', 'series', 'species',
  // -est 不可剥离
  'test', 'rest', 'best', 'west', 'nest', 'quest', 'forest', 'interest', 'suggest', 'protest', 'request', 'harvest', 'honest', 'modest',
  // -er 形容词本身
  'bitter', 'proper', 'super', 'other', 'utter', 'inner', 'upper', 'outer',
  // 短词保护
  'her', 'his', 'its', 'per', 'the', 'are', 'were', 'ore',
]);

// ==================== 模块初始化 ====================
// 所有 BUILTIN_* 常量已定义完毕，现在可以安全地合并用户规则
reloadRules();

/**
 * 双写辅音还原：stopped → stop (去掉 -ped 后为 stopp，再去掉重复辅音)
 */
function dedup(stem: string): string {
  if (stem.length >= 3) {
    const last = stem[stem.length - 1];
    const secondLast = stem[stem.length - 2];
    if (last === secondLast && isConsonant(last)) {
      return stem.slice(0, -1);
    }
  }
  return stem;
}

/**
 * 安全的 -ing 剥离
 */
function stripIng(word: string): string | null {
  if (!word.endsWith('ing') || word.length <= 5) return null;
  const stem = word.slice(0, -3);
  if (stem.length < MIN_STEM) return null;

  // 双写还原 running→run
  // 但保留固有双写: missing→miss, blessing→bless
  const dedupStem = dedup(stem);
  if (dedupStem !== stem && dedupStem.length >= MIN_STEM) {
    const lastChar = stem[stem.length - 1];
    if ('slfz'.includes(lastChar)) {
      return stem;  // miss, bless 保留双字母
    }
    return dedupStem;
  }

  // 以辅音结尾 → 可能需要加 e
  if (isConsonant(stem[stem.length - 1])) {
    // 不加 e 的情况：双辅音结尾（talking→talk）、-y结尾（playing→play）、
    // -n结尾（abandoning→abandon）、-r结尾（entering→enter）
    // -w结尾（following→follow）
    const last = stem[stem.length - 1];
    if (isConsonant(stem[stem.length - 2]) || 'ynrwl'.includes(last)) {
      return stem;
    }
    // 单元音+辅音结尾 → 加 e: making→make, driving→drive, hoping→hope
    if (isVowel(stem[stem.length - 2])) {
      return stem + 'e';
    }
  }

  // 元音结尾：playing→play
  return stem;
}

/**
 * 安全的 -ed 剥离
 */
function stripEd(word: string): string | null {
  if (!word.endsWith('ed') || word.length <= 3) return null;

  // -ied → -y: carried→carry
  if (word.endsWith('ied') && word.length > 5) {
    const stem = word.slice(0, -3) + 'y';
    return stem.length >= MIN_STEM ? stem : null;
  }

  const stem = word.slice(0, -2);
  if (stem.length < MIN_STEM) return null;

  // 双写: stopped→stop, planned→plan
  // 但保留固有双写: missed→miss, dressed→dress, blessed→bless
  const dedupStem = dedup(stem);
  if (dedupStem !== stem && dedupStem.length >= MIN_STEM) {
    const lastChar = stem[stem.length - 1];
    // ss, ll, ff, zz 通常是固有双写，不剥离
    if ('slfz'.includes(lastChar)) {
      return stem;  // miss, dress, bless 保留双字母
    }
    return dedupStem;
  }

  // 辅音+辅音结尾: walked→walk, helped→help
  // 但某些辅音+辅音组合需要加 e: danced→dance (n+c), forced→force (r+c)
  if (isConsonant(stem[stem.length - 1]) && isConsonant(stem[stem.length - 2])) {
    const last = stem[stem.length - 1];
    // 这些辅音对通常后面有 silent e: -nce, -rce, -lse, -nge, -rge, -nse, -rse
    if (last === 'c' || last === 'g' || (last === 's' && 'nrl'.includes(stem[stem.length - 2]))) {
      return stem + 'e';
    }
    return stem;
  }

  // 辅音结尾，前面是元音
  if (isConsonant(stem[stem.length - 1]) && isVowel(stem[stem.length - 2])) {
    const last = stem[stem.length - 1];
    // 这些辅音结尾通常不需要加 e:
    // -n: abandoned→abandon, opened→open, happened→happen
    // -r: entered→enter, offered→offer, covered→cover
    // -l: traveled→travel, canceled→cancel
    // -w: followed→follow, showed→show
    // -y: played→play, stayed→stay
    // -x: relaxed→relax, boxed→box
    if ('nrlwyx'.includes(last)) {
      return stem;
    }
    // 这些辅音结尾通常需要加 e:
    // -c: danced→dance, noticed→notice
    // -s: used→use, closed→close
    // -t: created→create, hated→hate
    // -k: liked→like, baked→bake
    // -p: hoped→hope, shaped→shape
    // -v: loved→love, moved→move
    // -z: amazed→amaze, realized→realize
    // -d: decided→decide, guided→guide
    // -g: changed→change (但 -ged 如 begged 已被双写规则处理)
    // -m: named→name, blamed→blame
    return stem + 'e';
  }

  // 元音结尾: played→play, 直接去掉 -ed
  return stem;
}

/**
 * 安全的 -s / -es 剥离（第三人称 / 名词复数）
 */
function stripPlural(word: string): string | null {
  if (word.length <= 3) return null;

  // -ies → -y: carries→carry, stories→story
  // 但排除以 -ie 结尾的词: cookies→cookie, brownies→brownie, calories→calorie
  if (word.endsWith('ies') && word.length > 5) {
    const stemIe = word.slice(0, -1);  // cookies → cookie (去 s)
    // 已知以 -ie 结尾的常见词，复数只加 -s 而非 -ies→-y
    if (IE_ENDING_WORDS.has(stemIe)) {
      return stemIe;
    }
    return word.slice(0, -3) + 'y';
  }

  // -ves → -fe / -f: knives→knife (不规则表已处理大部分)
  if (word.endsWith('ves') && word.length > 5) {
    return word.slice(0, -3) + 'fe';
  }

  // -shes, -ches, -xes, -zes, -sses → 去 -es
  if (/(?:sh|ch|x|z|ss)es$/.test(word) && word.length > 4) {
    const stem = word.slice(0, -2);
    return stem.length >= MIN_STEM ? stem : null;
  }

  // -oes → -o: heroes→hero
  if (word.endsWith('oes') && word.length > 5) {
    return word.slice(0, -2);
  }

  // 一般 -es
  if (word.endsWith('es') && word.length > 4) {
    // 保留 e: cases→case
    return word.slice(0, -1);
  }

  // 一般 -s (不处理 -ss: miss, dress, access, business 等固有双 s)
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) {
    const stem = word.slice(0, -1);
    return stem.length >= MIN_STEM ? stem : null;
  }

  return null;
}

/**
 * 安全的 -er 剥离（形容词比较级）
 * 只在明确是比较级时剥离（double consonant pattern）
 */
function stripEr(word: string): string | null {
  if (!word.endsWith('er') || word.length <= 4) return null;

  // -ier → -y: happier→happy
  if (word.endsWith('ier') && word.length > 5) {
    return word.slice(0, -3) + 'y';
  }

  const stem = word.slice(0, -2);
  if (stem.length < MIN_STEM) return null;

  // 双写还原: bigger→big
  const dedupStem = dedup(stem);
  if (dedupStem !== stem && dedupStem.length >= MIN_STEM) return dedupStem;

  // 仅当模式明确（短词 + 双写辅音）才剥离，否则返回 null（保守策略）
  return null;
}

/**
 * 安全的 -est 剥离（形容词最高级）
 */
function stripEst(word: string): string | null {
  if (!word.endsWith('est') || word.length <= 5) return null;

  // -iest → -y: happiest→happy
  if (word.endsWith('iest') && word.length > 6) {
    return word.slice(0, -4) + 'y';
  }

  const stem = word.slice(0, -3);
  if (stem.length < MIN_STEM) return null;

  // 双写还原: biggest→big
  const dedupStem = dedup(stem);
  if (dedupStem !== stem && dedupStem.length >= MIN_STEM) return dedupStem;

  // 仅当模式明确才剥离
  return null;
}

// ==================== 文本清洗 ====================

/**
 * 清洗单词：去除所有非字母字符，转小写
 * 例如: "abandon**" → "abandon", "a.m." → "am", "don't" → "dont"
 */
export function cleanWord(word: string): string {
  return word.replace(/[^a-zA-Z]/g, '').toLowerCase();
}

/**
 * 清洗词汇表条目，提取所有独立单词原形
 *
 * 处理规则:
 *   - "abandon**"          → ["abandon"]
 *   - "a.m."               → ["am"]
 *   - "actor/actress"      → ["actor", "actress"]
 *   - "a/an"               → ["a", "an"]
 *   - "AI (=artificial...)" → 由 parseVocabAbbreviation 处理
 *   - "ice-cream"          → ["icecream", "ice", "cream"]
 *
 * @returns 去重后的清洗单词数组（小写纯字母）
 */
export function cleanVocabEntry(vocabWord: string): string[] {
  // 先检查是否为缩写条目
  const abbrLemma = parseVocabAbbreviation(vocabWord);
  if (abbrLemma) return [abbrLemma];

  // 检查是否为拼写变体条目: "apologise (apologize)*" → 返回主形式
  const variant = parseVocabVariant(vocabWord);
  if (variant) return [variant.primary];

  // 去掉括号中的注释部分和星号
  let stripped = vocabWord.replace(/\s*\(.*?\)\s*/g, '').replace(/\*+/g, '').trim();

  // 检查是否为复合名词短语: "mobile phone" → ["mobile phone"]
  const phraseKey = stripped.toLowerCase();
  if (COMPOUND_NOUNS[phraseKey]) {
    return [COMPOUND_NOUNS[phraseKey]];
  }

  const results = new Set<string>();

  // 按 / 分割可选形式: actor/actress → actor, actress
  const alternatives = stripped.split('/');
  for (const alt of alternatives) {
    const cleaned = cleanWord(alt);
    if (cleaned.length > 0) {
      results.add(cleaned);
    }
  }

  return [...results];
}

// ==================== 主入口 ====================

/**
 * 将英文单词还原为原形 (lemma)
 *
 * 策略：不规则表 → 保护词表 → 保守规则剥离
 * 宁可不剥离，也不误剥离。
 *
 * @param word  小写英文单词
 * @returns     lemma（小写）
 */
export function lemmatize(word: string): string {
  if (!word) return word;

  // 0. 清洗：去除标点、符号，统一小写（大小写、标点全部忽略）
  const w = word.replace(/[^a-zA-Z]/g, '').toLowerCase();
  if (w.length <= 2) return w;

  // 1. 缩写直查（AI → ai, TV → tv）—— 缩写本身就是 lemma
  if (ABBREVIATIONS[w]) return w;

  // 1.5 单词全称反向查（television → tv, bicycle → bike）
  if (SINGLE_WORD_TO_ABBR[w]) return SINGLE_WORD_TO_ABBR[w];

  // 1.6 英美拼写变体直查（color → colour, center → centre）
  if (SPELLING_VARIANTS[w]) return SPELLING_VARIANTS[w];

  // 2. 不规则表直查（优先级最高）
  if (IRREGULAR_VERBS[w]) return IRREGULAR_VERBS[w];
  if (IRREGULAR_NOUNS[w]) return IRREGULAR_NOUNS[w];
  if (IRREGULAR_ADJECTIVES[w]) return IRREGULAR_ADJECTIVES[w];

  // 2. 保护词不剥离
  if (NO_STRIP.has(w)) return w;

  // 3. 按优先级尝试规则剥离（取第一个成功的）
  const result =
    stripIng(w) ??
    stripEd(w) ??
    stripPlural(w) ??
    stripEr(w) ??
    stripEst(w);

  const lemma = result ?? w;

  // 4. 后处理：剥离后的结果再查一次缩写反向映射和拼写变体
  //    例如 advertisements → advertisement → ad
  //    例如 colors → color → colour
  if (SINGLE_WORD_TO_ABBR[lemma]) return SINGLE_WORD_TO_ABBR[lemma];
  if (SPELLING_VARIANTS[lemma]) return SPELLING_VARIANTS[lemma];

  return lemma;
}

/**
 * 展开缩写（如果是缩写则返回全称，否则返回 null）
 */
export function expandAbbreviation(word: string): string | null {
  const w = word.toLowerCase().trim();
  return ABBREVIATIONS[w] || null;
}

/**
 * 获取单词的所有归一化形式（lemma + 可能的缩写展开）
 * 返回一个去重数组，至少包含 lemma。
 */
export function normalize(word: string): string[] {
  const w = word.toLowerCase().trim();
  const results = new Set<string>();

  // lemma
  results.add(lemmatize(w));

  // 缩写展开 — 将全称中的每个单词也加入
  const expanded = expandAbbreviation(w);
  if (expanded) {
    results.add(expanded);
  }

  return [...results];
}
