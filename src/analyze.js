import { baziCalculator } from 'mingyu-core/bazi';

const PEACH_BRANCHES = new Set(['子', '午', '卯', '酉']);
const PEACH_KEYWORDS = ['桃花', '咸池', '红鸾', '天喜', '孤鸾', '沐浴', '金舆'];
const PILLAR_KEYS = ['year', 'month', 'day', 'hour'];

export const TIME_OPTIONS = [
  { value: 0, label: '早子时 23:00-00:59' },
  { value: 1, label: '丑时 01:00-02:59' },
  { value: 2, label: '寅时 03:00-04:59' },
  { value: 3, label: '卯时 05:00-06:59' },
  { value: 4, label: '辰时 07:00-08:59' },
  { value: 5, label: '巳时 09:00-10:59' },
  { value: 6, label: '午时 11:00-12:59' },
  { value: 7, label: '未时 13:00-14:59' },
  { value: 8, label: '申时 15:00-16:59' },
  { value: 9, label: '酉时 17:00-18:59' },
  { value: 10, label: '戌时 19:00-20:59' },
  { value: 11, label: '亥时 21:00-22:59' },
  { value: 12, label: '晚子时 23:00-00:59' },
];

function parseBirthDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
  if (!match) throw new Error('请输入有效的出生日期');

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error('请输入有效的出生日期');
  }

  return { year, month, day };
}

function parseTimeIndex(value) {
  const timeIndex = Number(value);
  if (!Number.isInteger(timeIndex) || timeIndex < 0 || timeIndex > 12) {
    throw new Error('请选择出生时辰');
  }
  return timeIndex;
}

function parsePersonName(value) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  if (!name) throw new Error('请输入名字');
  if (name.length > 20) throw new Error('名字太长了');
  return name;
}

function parseGender(value) {
  if (value === 'male' || value === 'female') return value;
  throw new Error('请选择性别');
}

function unique(list) {
  return [...new Set(list.filter(Boolean))];
}

function flattenShensha(shensha = {}) {
  return [
    ...(shensha.year || []),
    ...(shensha.month || []),
    ...(shensha.day || []),
    ...(shensha.hour || []),
    ...(shensha.global || []),
  ];
}

function matchedKeywords(list, keywords) {
  return keywords.filter((keyword) => list.some((item) => String(item).includes(keyword)));
}

function collectTenGods(chart) {
  const visible = [];
  const hidden = [];

  for (const key of PILLAR_KEYS) {
    const v = chart.tenGods?.[key];
    if (v && v !== '日主') visible.push(v);
    for (const h of chart.hiddenTenGods?.[key] || []) {
      if (h) hidden.push(h);
    }
  }

  return { visible, hidden, all: [...visible, ...hidden] };
}

function countGods(list, names) {
  return list.filter((item) => names.includes(item)).length;
}

function scoreGods(visibleCount, hiddenCount, visibleWeight = 2, hiddenWeight = 1) {
  return visibleCount * visibleWeight + hiddenCount * hiddenWeight;
}

function strengthRank(status) {
  if (!status) return 0;
  if (status.includes('旺') || status.includes('强')) return 2;
  if (status.includes('弱')) return -2;
  if (status.includes('中和') || status.includes('平衡')) return 0;
  return 0;
}

function buildFinale(gender, orientation, isDeepCloset) {
  if (orientation === 'straight') return '你根本不是同性恋！';

  if (isDeepCloset) {
    if (gender === 'female') {
      if (orientation === 'bi') return '皇帝，你女儿是深柜双，你女儿是深柜啊，你女儿是双性恋你不懂吗？';
      return '皇帝，你女儿是深柜 les，你女儿是深柜啊，你女儿是同性恋你不懂吗？';
    }
    if (orientation === 'bi') return '皇帝，你儿子是深柜双，你儿子是深柜啊，你儿子是双性恋你不懂吗？';
    return '皇帝，你儿子是深柜 gay，你儿子是深柜啊，你儿子是同性恋你不懂吗？';
  }

  if (gender === 'female') {
    if (orientation === 'bi') return '皇帝，你女儿是双，你女儿是双啊，你女儿是双性恋你不懂吗？';
    return '皇帝，你女儿是les，你女儿是les啊，你女儿是同性恋你不懂吗？';
  }
  if (orientation === 'bi') return '皇帝，你儿子是双，你儿子是双啊，你儿子是双性恋你不懂吗？';
  return '皇帝，你儿子是gay，你儿子是gay啊，你儿子是同性恋你不懂吗？';
}

/**
 * 算法原则：
 * 1. 一个信号尽量只服务一个主轴，避免重复计分
 * 2. 双性恋只能由“异性缘证据 + 破格证据”同时成立推出，不能由常见命盘结构直接给分
 * 3. 藏干弱信号不能当主证据
 * 4. 阴阳日主、普通桃花只作辅助，不作主判
 */
export function analyzeOrientation(birthDateValue, timeIndexValue, genderValue, personNameValue) {
  const { year, month, day } = parseBirthDate(birthDateValue);
  const timeIndex = parseTimeIndex(timeIndexValue);
  const gender = parseGender(genderValue);
  const personName = parsePersonName(personNameValue);
  const genderText = gender === 'male' ? '男' : '女';
  const timeLabel = TIME_OPTIONS.find((item) => item.value === timeIndex)?.label || `时辰 ${timeIndex}`;

  const chart = baziCalculator.calculateBazi({
    year,
    month,
    day,
    timeIndex,
    gender,
  });

  const pillars = chart.pillars;
  const dayMaster = chart.dayMaster;
  const dayMasterYin = dayMaster.yinYang === '阴';
  const dayMasterYang = !dayMasterYin;
  const dayBranch = pillars.day.zhi;
  const strengthStatus = chart.analysis?.dayMasterStrength?.status || '';
  const strength = strengthRank(strengthStatus);
  const pattern = chart.analysis?.mingGe?.pattern || '';

  const { visible, hidden } = collectTenGods(chart);
  const shenshaList = flattenShensha(chart.shensha);
  const peachTags = matchedKeywords(shenshaList, PEACH_KEYWORDS);
  const hasGuLuan = peachTags.some((item) => item.includes('孤鸾'));
  const hasHongLuanOrTianXi = peachTags.some((item) => item === '红鸾' || item === '天喜');
  const desireTags = peachTags.filter((t) => ['桃花', '咸池', '沐浴'].includes(t));
  const hasDesireShenSha = desireTags.length > 0;

  const peachPillars = PILLAR_KEYS.filter((key) => PEACH_BRANCHES.has(pillars[key].zhi));
  const nonDayPeachCount = peachPillars.filter((key) => key !== 'day').length;
  const dayIsPeach = PEACH_BRANCHES.has(dayBranch);
  const muYuPillars = PILLAR_KEYS.filter((key) => chart.lifeStages?.[key] === '沐浴');
  const dayIsMuYu = chart.lifeStages?.day === '沐浴';
  const nonDayMuYuCount = muYuPillars.filter((key) => key !== 'day').length;

  const wealthVisible = countGods(visible, ['正财', '偏财']);
  const wealthHidden = countGods(hidden, ['正财', '偏财']);
  const officerVisible = countGods(visible, ['正官', '七杀']);
  const officerHidden = countGods(hidden, ['正官', '七杀']);
  const outputVisible = countGods(visible, ['食神', '伤官']);
  const outputHidden = countGods(hidden, ['食神', '伤官']);
  const peerVisible = countGods(visible, ['比肩', '劫财']);
  const peerHidden = countGods(hidden, ['比肩', '劫财']);
  const printVisible = countGods(visible, ['正印', '偏印']);
  const printHidden = countGods(hidden, ['正印', '偏印']);

  const wealthScore = scoreGods(wealthVisible, wealthHidden);
  const officerScore = scoreGods(officerVisible, officerHidden);
  const outputScore = scoreGods(outputVisible, outputHidden, 2, 1);
  const peerScore = scoreGods(peerVisible, peerHidden, 2, 1);
  const printScore = scoreGods(printVisible, printHidden, 2, 1);

  // 配偶星：男财女官；透干权重大，藏干只作补充
  const spouseVisible = gender === 'male' ? wealthVisible : officerVisible;
  const spouseHidden = gender === 'male' ? wealthHidden : officerHidden;
  const spouseScore = gender === 'male' ? wealthScore : officerScore;
  const nonSpouseVisible = gender === 'male' ? officerVisible : wealthVisible;
  const nonSpouseScore = gender === 'male' ? officerScore : wealthScore;

  // 从格/极弱时，传统配偶星不能按普通正格“成势”解读；普通身弱不在此列
  const isCongPattern = /从/.test(pattern) || strengthStatus.includes('从');
  const isExtremeWeak = strengthStatus.includes('极弱');
  const selfUnstable = isCongPattern || isExtremeWeak;

  // 配偶星“成势”：至少一透，或透藏合计够实；从格下大幅降权
  const spouseStrongRaw = spouseVisible >= 2 || (spouseVisible >= 1 && spouseScore >= 4) || spouseScore >= 6;
  const spousePresentRaw = spouseVisible >= 1 || spouseScore >= 3;
  const spouseStrong = spouseStrongRaw && !selfUnstable;
  const spousePresent = selfUnstable ? spouseVisible >= 1 && spouseScore >= 5 : spousePresentRaw;
  const spouseWeak = (!spousePresent) || (selfUnstable && !spouseStrongRaw);

  // 破格类“藏而不透”：只统计比劫/食伤这类更偏自我与表达的信号
  const breakHidden = countGods(hidden, ['比肩', '劫财', '食神', '伤官']);
  const breakVisible = countGods(visible, ['比肩', '劫财', '食神', '伤官']);

  const relationText = [
    ...(chart.pillarRelations?.fanyin || []),
    ...(chart.pillarRelations?.xingChong || []),
  ].join('；');
  const hasDaySpouseClash =
    relationText.includes('日柱') &&
    (relationText.includes('冲') || relationText.includes('刑') || relationText.includes('克'));

  let heteroScore = 0;
  let queerScore = 0;
  const heteroFacts = [];
  const queerFacts = [];
  const supportFacts = [];

  // ---------- 异性缘主证据 ----------
  if (spouseStrong) {
    heteroScore += 5;
    heteroFacts.push(
      gender === 'male'
        ? `妻星（财星）成势：透干 ${wealthVisible}，合计 ${wealthScore}。`
        : `夫星（官杀）成势：透干 ${officerVisible}，合计 ${officerScore}。`,
    );
  } else if (spouseStrongRaw && selfUnstable) {
    // 从格/极弱时官杀或财星多，更像身不自立，不能直接当异性缘成势
    heteroScore += 1;
    queerScore += 2;
    heteroFacts.push(
      gender === 'male'
        ? `虽见财星（透干 ${wealthVisible}，合计 ${wealthScore}），但日主从格/极弱，不能按普通妻星成势看。`
        : `虽见官杀（透干 ${officerVisible}，合计 ${officerScore}），但日主从格/极弱，不能按普通夫星成势看。`,
    );
    queerFacts.push(
      isCongPattern
        ? `格局为“${pattern || '从格'}”，日主难自立，传统婚恋主证据要改判。`
        : `日主${strengthStatus || '偏弱'}，传统配偶星再多也难当正格异性缘。`,
    );
  } else if (spousePresent) {
    heteroScore += 3;
    heteroFacts.push(
      gender === 'male'
        ? '妻星有根有气，传统异性缘成立。'
        : '夫星有根有气，传统异性缘成立。',
    );
  } else if (spouseWeak) {
    queerScore += 3;
    queerFacts.push(
      gender === 'male'
        ? '妻星偏虚，传统异性配偶主证据不足。'
        : '夫星偏虚，传统异性配偶主证据不足。',
    );
  }

  if (hasHongLuanOrTianXi) {
    heteroScore += 2;
    heteroFacts.push('见红鸾/天喜，正缘框架仍在。');
  }

  if (pattern && /正财|偏财|正官|七杀|财/.test(pattern) && spousePresent) {
    heteroScore += 1;
    heteroFacts.push(`格局“${pattern}”与配偶星方向一致。`);
  }

  if (strength >= 2 && spousePresent) {
    heteroScore += 1;
    heteroFacts.push(`日主${strengthStatus || '偏强'}并见配偶星，常规婚恋底盘更稳。`);
  }

  // ---------- 破格主证据（只计一次，不跨轴重复） ----------
  if (hasGuLuan) {
    queerScore += 4;
    queerFacts.push('见孤鸾煞，感情路径更易偏离常例。');
  }

  if (dayIsPeach) {
    queerScore += 2;
    queerFacts.push(`日支落桃花地支“${dayBranch}”，夫妻宫本身带欲望波动。`);
  }
  if (nonDayPeachCount >= 3) {
    queerScore += 3;
    queerFacts.push(`年/月/时桃花地支多达 ${nonDayPeachCount} 处，欲望结构明显偏离平稳。`);
  } else if (nonDayPeachCount === 2) {
    queerScore += 2;
    queerFacts.push(`年/月/时出现 ${nonDayPeachCount} 处桃花地支，欲望线索偏活跃。`);
  } else if (nonDayPeachCount === 1 && !dayIsPeach) {
    queerScore += 1;
    supportFacts.push('另有一处桃花地支，作辅助波动信号。');
  }

  // 神煞神煞与日柱沐浴避免重复：日柱沐浴已单计时，不再因“沐浴”关键字再加
  if (hasDesireShenSha) {
    const tags = desireTags.filter((t) => !(dayIsMuYu && t === '沐浴'));
    if (tags.length > 0) {
      queerScore += Math.min(2, tags.length);
      queerFacts.push(`命盘见${tags.join('、')}，情欲表达更容易破格。`);
    }
  }

  if (dayIsMuYu) {
    queerScore += 2;
    queerFacts.push('日柱处“沐浴”，色欲与情感敏感度升高。');
  } else if (nonDayMuYuCount >= 2) {
    queerScore += 1;
    supportFacts.push(`另有 ${nonDayMuYuCount} 处沐浴，欲望波动偏频繁。`);
  }

  // 非配偶星显而配偶星不透：只在配偶弱时成立，避免正常命盘误伤
  if (spouseWeak && nonSpouseVisible > 0) {
    queerScore += 2;
    queerFacts.push(
      gender === 'male'
        ? '官杀显而妻星不透，气机更偏同类掌控结构。'
        : '财星显而夫星不透，气机更偏自我欲望表达。',
    );
  }

  if (peerVisible >= 2 || peerScore >= 5) {
    queerScore += 2;
    queerFacts.push(`比劫偏重（透干 ${peerVisible}），对同类牵引更强。`);
  }

  if (strength <= -2 && spouseWeak) {
    queerScore += 1;
    queerFacts.push(`日主${strengthStatus || '偏弱'}且配偶星不厚，常规婚恋主证据更难压住破格信号。`);
  }

  if (pattern && /伤官|食神|比劫|建禄|月劫/.test(pattern) && spouseWeak) {
    queerScore += 1;
    queerFacts.push(`格局偏“${pattern}”，再叠加配偶星偏虚，破格倾向更明确。`);
  }

  if (hasDaySpouseClash && spouseWeak) {
    queerScore += 1;
    queerFacts.push('夫妻宫冲刑且配偶星偏虚，感情结构更不稳定。');
  }

  // 阴阳日主只作弱辅助，不单独成局
  if (gender === 'male' && dayMasterYin && queerScore > 0) {
    queerScore += 1;
    supportFacts.push('男命日主偏阴，使既有破格信号略增重。');
  }
  if (gender === 'female' && dayMasterYang && queerScore > 0) {
    queerScore += 1;
    supportFacts.push('女命日主偏阳，使既有破格信号略增重。');
  }

  // ---------- 双性恋：必须两边都有“独立主证据” ----------
  // 不能因为命盘常见的财官藏干并见，就直接给双
  const multiPeach = dayIsPeach || nonDayPeachCount >= 2 || (nonDayPeachCount + (dayIsPeach ? 1 : 0)) >= 3;
  const heteroCore = heteroScore >= 4 && spousePresent && !selfUnstable;
  const queerCore = queerScore >= 5 && (
    hasGuLuan
    || spouseWeak
    || dayIsPeach
    || dayIsMuYu
    || peerVisible >= 2
    || (multiPeach && selfUnstable)
    || (nonDayPeachCount >= 3)
  );
  const bothSidesReal = heteroCore && queerCore;

  let orientation = 'straight';
  if (bothSidesReal) {
    orientation = 'bi';
  } else if (queerCore && queerScore >= heteroScore + 1 && queerScore >= 5) {
    orientation = 'gay';
  } else if (queerCore && selfUnstable && !heteroCore && queerScore >= 5) {
    // 从格/极弱时，不能再用“官杀多=异性缘”压过破格主证据
    orientation = 'gay';
  } else if (heteroCore && heteroScore >= queerScore + 1) {
    orientation = 'straight';
  } else if (heteroScore >= queerScore + 2 && heteroScore >= 4) {
    orientation = 'straight';
  } else if (queerScore >= 7 && !heteroCore) {
    orientation = 'gay';
  } else {
    // 证据胶着：有正格配偶主证据则从常规，否则看破格是否成核
    orientation = heteroCore ? 'straight' : (queerCore ? 'gay' : 'straight');
  }

  // ---------- 深柜：只有非直盘才谈 ----------
  // 柜 = 破格成立 + 表达被压 + 外表仍可维持常规
  let closetScore = 0;
  const closetFacts = [];
  const openFacts = [];

  if (printScore >= 4 || printVisible >= 2) {
    closetScore += 3;
    closetFacts.push(`印星偏重（透干 ${printVisible}，合计 ${printScore}），更会把欲望往里收。`);
  } else if (printScore >= 2) {
    closetScore += 1;
    closetFacts.push('印星有气，表达上更容易克制。');
  }

  if (outputVisible === 0) {
    closetScore += outputScore <= 2 ? 3 : 2;
    closetFacts.push(outputScore <= 2 ? '食伤几乎不透，心里有事也不太往外说。' : '食伤不透干，外放表达偏弱。');
  } else if (outputVisible >= 2) {
    closetScore -= 2;
    openFacts.push(`食伤透干 ${outputVisible} 个，更敢直接表达。`);
  }

  if (breakHidden >= breakVisible + 2 && breakHidden >= 3) {
    closetScore += 2;
    closetFacts.push(`比劫/食伤多藏不透（藏 ${breakHidden} / 透 ${breakVisible}），破格更像压在里面。`);
  }

  if (spousePresent && orientation !== 'straight') {
    closetScore += 2;
    closetFacts.push(
      gender === 'male'
        ? '表面仍有妻星可支撑“常规叙事”。'
        : '表面仍有夫星可支撑“常规叙事”。',
    );
  }

  if ((dayMasterYin || strength <= -2) && orientation !== 'straight') {
    closetScore += 1;
    closetFacts.push(dayMasterYin ? '日主偏阴，气机更内收。' : `日主${strengthStatus}，更习惯把锋芒收回。`);
  }

  if (hasHongLuanOrTianXi && orientation !== 'straight') {
    closetScore += 1;
    closetFacts.push('红鸾/天喜仍可撑住常规恋爱叙事。');
  }

  let isDeepCloset = false;
  if (orientation !== 'straight') {
    // 需要“收着”和“还能装常规”两边都在
    const suppressed = printScore >= 2 || outputVisible === 0 || breakHidden > breakVisible;
    const masked = spousePresent || hasHongLuanOrTianXi;
    isDeepCloset = closetScore >= 6 && suppressed && masked;
  }

  // ---------- 0/1 ----------
  let activeScore = 0;
  let passiveScore = 0;
  const activeFacts = [];
  const passiveFacts = [];

  if (dayMasterYang) {
    activeScore += 3;
    activeFacts.push('日主偏阳，主动性先天更强。');
  } else {
    passiveScore += 3;
    passiveFacts.push('日主偏阴，承接性先天更强。');
  }

  if (strength >= 2) {
    activeScore += 2;
    activeFacts.push(`日主${strengthStatus}，更有推进力。`);
  } else if (strength <= -2) {
    passiveScore += 2;
    passiveFacts.push(`日主${strengthStatus}，更偏承接。`);
  }

  if (officerScore > 0) {
    activeScore += Math.min(3, officerScore);
    activeFacts.push(`官杀合计 ${officerScore}，掌控欲上调。`);
  }
  if (peerScore > 0) {
    activeScore += Math.min(2, peerScore);
    activeFacts.push(`比劫合计 ${peerScore}，自我主张更强。`);
  }
  if (wealthScore > 0) {
    passiveScore += Math.min(3, wealthScore);
    passiveFacts.push(`财星合计 ${wealthScore}，更偏被吸引与承纳。`);
  }
  if (outputVisible > 0 && officerVisible === 0) {
    passiveScore += 1;
    passiveFacts.push('食伤显而官杀弱，表达柔软多于压制。');
  } else if (outputVisible >= 2 && officerVisible >= 1) {
    activeScore += 1;
    activeFacts.push('食伤与官杀同见，外放中带主导。');
  }
  if (dayIsPeach || dayIsMuYu || hasGuLuan) {
    passiveScore += 1;
    passiveFacts.push('夫妻宫桃花/沐浴/孤鸾一类信号，角色更易偏受动。');
  }

  let role = null;
  let roleText = '不适用';
  if (orientation !== 'straight') {
    if (activeScore > passiveScore + 1) role = '1';
    else if (passiveScore > activeScore + 1) role = '0';
    else role = dayMasterYang ? '1' : '0';
    roleText = role;
  }

  // ---------- 理由 ----------
  const factReasons = [];
  const conclusionReasons = [];

  if (orientation === 'straight') {
    factReasons.push(...heteroFacts.slice(0, 3));
    if (queerFacts[0]) {
      factReasons.push(queerFacts[0].replace(/。$/, '，但还构不成主证据翻盘。'));
    }
    if (factReasons.length === 0) {
      factReasons.push('配偶星与破格信号都不够成局，整体更接近常规取向。');
    }
  } else if (orientation === 'bi') {
    factReasons.push(...heteroFacts.slice(0, 2));
    factReasons.push(...queerFacts.slice(0, 2));
    conclusionReasons.push('异性缘主证据与破格主证据同时成立，所以判为双性恋。');
  } else {
    factReasons.push(...queerFacts.slice(0, 4));
    if (supportFacts[0]) factReasons.push(supportFacts[0]);
    if (heteroFacts[0] && spousePresent) {
      factReasons.push(heteroFacts[0].replace(/。$/, '，但破格主证据更强。'));
    }
    conclusionReasons.push(
      gender === 'female' ? '所以结论是：你是 les。' : '所以结论是：你是 gay。',
    );
  }

  if (orientation !== 'straight') {
    const roleGap = Math.abs(activeScore - passiveScore);
    if (role === '1') {
      factReasons.push(...activeFacts.slice(0, 2));
      conclusionReasons.push(
        roleGap > 1
          ? '主动轴明显强于受动轴，所以是 1。'
          : '主动与受动接近，按日主偏阳定夺为 1。',
      );
    } else {
      factReasons.push(...passiveFacts.slice(0, 2));
      conclusionReasons.push(
        roleGap > 1
          ? '受动轴明显强于主动轴，所以是 0。'
          : '主动与受动接近，按日主偏阴定夺为 0。',
      );
    }

    if (isDeepCloset) {
      factReasons.push(...closetFacts.slice(0, 3));
      conclusionReasons.push('破格成立、表达被压，且外表仍可维持常规，所以判为深柜。');
    } else {
      if (openFacts[0]) factReasons.push(openFacts[0]);
      else if (closetFacts[0]) factReasons.push(closetFacts[0].replace(/。$/, '，但还不足以构成深柜。'));
      conclusionReasons.push('没有同时满足“收着”和“可装常规”，所以不算深柜。');
    }
  }

  const reasons = unique([...factReasons, ...conclusionReasons]);
  const pillarsText = `${pillars.year.ganZhi} ${pillars.month.ganZhi} ${pillars.day.ganZhi} ${pillars.hour.ganZhi}`;
  const dayMasterText = `${dayMaster.gan}${dayMaster.element}${dayMaster.yinYang}`;

  let orientationText = '不是';
  if (orientation === 'gay') orientationText = gender === 'female' ? 'les' : 'gay';
  if (orientation === 'bi') orientationText = '双性恋';

  const closetText = orientation === 'straight' ? '不适用' : isDeepCloset ? '是' : '不是';

  return {
    personName,
    birthDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    gender,
    genderText,
    timeIndex,
    timeLabel,
    orientation,
    orientationText,
    role,
    roleText,
    isDeepCloset,
    closetText,
    pillarsText,
    dayMasterText,
    detail: `${personName} · ${genderText} · ${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${timeLabel} · 四柱 ${pillarsText} · 日主 ${dayMasterText}${strengthStatus ? `（${strengthStatus}）` : ''}${pattern ? ` · 格局 ${pattern}` : ''}`,
    reasons,
    finale: buildFinale(gender, orientation, isDeepCloset),
    scores: {
      heteroScore,
      queerScore,
      activeScore,
      passiveScore,
      closetScore,
      spouseScore,
      wealthScore,
      officerScore,
      peerScore,
      outputScore,
      printScore,
      spouseStrong,
      spousePresent,
      spouseWeak,
      selfUnstable,
      heteroCore,
      queerCore,
      bothSidesReal,
    },
  };
}
