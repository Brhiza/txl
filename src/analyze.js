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

  return { visible, hidden };
}

function countGods(list, names) {
  return list.filter((item) => names.includes(item)).length;
}

function scoreGods(visibleCount, hiddenCount, visibleWeight = 2, hiddenWeight = 1) {
  return visibleCount * visibleWeight + hiddenCount * hiddenWeight;
}

function strengthRank(status) {
  if (!status) return 0;
  if (status.includes('极强') || status.includes('专旺')) return 3;
  if (status.includes('旺') || status.includes('强')) return 2;
  if (status.includes('极弱')) return -3;
  if (status.includes('弱')) return -2;
  if (status.includes('中和') || status.includes('平衡') || status.includes('偏弱') || status.includes('偏强')) {
    if (status.includes('偏弱')) return -1;
    if (status.includes('偏强')) return 1;
    return 0;
  }
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
 * 证据分层：
 * - 主证据：能单独推动结论方向
 * - 辅证据：只在已有主证据时加码
 * - 双性恋：必须左右两边都有独立主证据
 * - 从格/极弱：配偶星不能按正格“成势”解读
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
  const hasStrongRoot = Boolean(chart.analysis?.dayMasterStrength?.details?.hasStrongRoot);

  const { visible, hidden } = collectTenGods(chart);
  const shenshaList = flattenShensha(chart.shensha);
  const peachTags = matchedKeywords(shenshaList, PEACH_KEYWORDS);
  const hasGuLuan = peachTags.some((item) => item.includes('孤鸾'));
  const hasHongLuanOrTianXi = peachTags.some((item) => item === '红鸾' || item === '天喜');
  const desireTags = peachTags.filter((t) => ['桃花', '咸池', '沐浴'].includes(t));

  const peachPillars = PILLAR_KEYS.filter((key) => PEACH_BRANCHES.has(pillars[key].zhi));
  const nonDayPeachCount = peachPillars.filter((key) => key !== 'day').length;
  const totalPeachCount = peachPillars.length;
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

  // 配偶星：男财女官。主证据必须看透干，藏干只补气。
  const spouseVisible = gender === 'male' ? wealthVisible : officerVisible;
  const spouseHidden = gender === 'male' ? wealthHidden : officerHidden;
  const spouseScore = gender === 'male' ? wealthScore : officerScore;
  const nonSpouseVisible = gender === 'male' ? officerVisible : wealthVisible;

  const isCongPattern = /从/.test(pattern) || strengthStatus.includes('从');
  const isExtremeWeak = strengthStatus.includes('极弱');
  const selfUnstable = isCongPattern || isExtremeWeak;

  // 正格配偶星门槛：
  // - 成势：至少一透，且总量够
  // - 有气：至少一透；或虽不透但格局本身就是配偶星格局
  // - 仅藏干：不算主证据，也不能直接当全虚
  const spousePatternAligned = gender === 'male'
    ? /正财|偏财|财/.test(pattern)
    : /正官|七杀|官|杀/.test(pattern);
  const spouseStrongRaw = spouseVisible >= 2 || (spouseVisible >= 1 && spouseScore >= 4);
  const spousePresentRaw =
    spouseVisible >= 1
    || (spousePatternAligned && spouseScore >= 2)
    || (spouseVisible === 0 && spouseScore >= 5 && spouseHidden >= 2);
  const spouseStrong = spouseStrongRaw && !selfUnstable;
  const spousePresent = selfUnstable
    ? spouseVisible >= 2 || (spouseVisible >= 1 && spouseScore >= 6)
    : spousePresentRaw;
  // 全虚：无透、无格局支撑、藏干也弱
  const spouseWeak = spouseVisible === 0 && !spousePatternAligned && spouseScore <= 2;
  const spouseHiddenOnly = spouseVisible === 0 && !spouseWeak && !spousePresent;

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
  const queerMainFlags = [];

  // ---------- 异性缘主证据 ----------
  if (spouseStrong) {
    heteroScore += 5;
    heteroFacts.push(
      gender === 'male'
        ? `妻星（财星）成势：透干 ${wealthVisible}，合计 ${wealthScore}。`
        : `夫星（官杀）成势：透干 ${officerVisible}，合计 ${officerScore}。`,
    );
  } else if (spousePresent && !selfUnstable) {
    heteroScore += 3;
    if (spouseVisible >= 1) {
      heteroFacts.push(
        gender === 'male'
          ? '妻星透干有气，传统异性缘成立。'
          : '夫星透干有气，传统异性缘成立。',
      );
    } else if (spousePatternAligned) {
      heteroFacts.push(
        gender === 'male'
          ? `格局为“${pattern}”，妻星是盘面主结构，传统异性缘成立。`
          : `格局为“${pattern}”，夫星是盘面主结构，传统异性缘成立。`,
      );
    } else {
      heteroFacts.push(
        gender === 'male'
          ? '妻星虽不透但根气足够，传统异性缘仍可成立。'
          : '夫星虽不透但根气足够，传统异性缘仍可成立。',
      );
    }
  } else if (spouseStrongRaw && selfUnstable) {
    // 从格/极弱：官杀或财星再多，也不能直接当正格配偶成势
    heteroScore += 1;
    queerScore += 2;
    queerMainFlags.push('cong-spouse-reframe');
    heteroFacts.push(
      gender === 'male'
        ? `虽见财星（透干 ${wealthVisible}，合计 ${wealthScore}），但日主从格/极弱，不能按普通妻星成势看。`
        : `虽见官杀（透干 ${officerVisible}，合计 ${officerScore}），但日主从格/极弱，不能按普通夫星成势看。`,
    );
    queerFacts.push(
      isCongPattern
        ? `格局为“${pattern || '从格'}”，日主难自立，传统婚恋主证据要改判。`
        : `日主${strengthStatus || '极弱'}，传统配偶星再多也难当正格异性缘。`,
    );
  } else if (spouseWeak) {
    queerScore += 2;
    queerMainFlags.push('spouse-weak');
    queerFacts.push(
      gender === 'male'
        ? '妻星偏虚，传统异性配偶主证据不足。'
        : '夫星偏虚，传统异性配偶主证据不足。',
    );
  } else if (spouseHiddenOnly) {
    // 有藏无透：异性缘未废，但也不算主证据
    heteroScore += 1;
    supportFacts.push(
      gender === 'male'
        ? '妻星只见藏干，异性缘有底气但未透清。'
        : '夫星只见藏干，异性缘有底气但未透清。',
    );
  }

  if (hasHongLuanOrTianXi && spousePresent && !selfUnstable) {
    heteroScore += 2;
    heteroFacts.push('见红鸾/天喜，正缘框架仍在。');
  } else if (hasHongLuanOrTianXi) {
    heteroScore += 1;
    supportFacts.push('见红鸾/天喜，作常规叙事辅助，不单独定案。');
  }

  if (pattern && /正财|偏财|正官|七杀|财/.test(pattern) && spousePresent && !selfUnstable) {
    heteroScore += 1;
    heteroFacts.push(`格局“${pattern}”与配偶星方向一致。`);
  }

  if (strength >= 2 && spousePresent && !selfUnstable) {
    heteroScore += 1;
    heteroFacts.push(`日主${strengthStatus || '偏强'}并见配偶星，常规婚恋底盘更稳。`);
  }

  // ---------- 破格主证据 ----------
  if (hasGuLuan) {
    queerScore += 4;
    queerMainFlags.push('guluan');
    queerFacts.push('见孤鸾煞，感情路径更易偏离常例。');
  }

  // 桃花：日支、总量、神煞分层，避免同一现象重复计分
  if (dayIsPeach) {
    queerScore += 2;
    queerMainFlags.push('day-peach');
    queerFacts.push(`日支落桃花地支“${dayBranch}”，夫妻宫本身带欲望波动。`);
  }
  if (totalPeachCount >= 3) {
    queerScore += 3;
    queerMainFlags.push('multi-peach');
    queerFacts.push(`四柱桃花地支多达 ${totalPeachCount} 处，欲望结构明显偏离平稳。`);
  } else if (nonDayPeachCount >= 2 && !dayIsPeach) {
    queerScore += 2;
    queerMainFlags.push('multi-peach');
    queerFacts.push(`年/月/时出现 ${nonDayPeachCount} 处桃花地支，欲望线索偏活跃。`);
  } else if (nonDayPeachCount === 1 && !dayIsPeach) {
    queerScore += 1;
    supportFacts.push('另有一处桃花地支，作辅助波动信号。');
  }

  // 神煞神煞：与日支桃花/日柱沐浴去重，避免“地支桃花 + 桃花神煞”双计
  const desireMainTags = desireTags.filter((t) => {
    if (dayIsMuYu && t === '沐浴') return false;
    if (dayIsPeach && t === '桃花') return false;
    return true;
  });
  if (desireMainTags.length > 0) {
    queerScore += Math.min(2, desireMainTags.length);
    queerMainFlags.push('desire-shensha');
    queerFacts.push(`命盘见${desireMainTags.join('、')}，情欲表达更容易破格。`);
  }

  if (dayIsMuYu) {
    queerScore += 2;
    queerMainFlags.push('day-muyu');
    queerFacts.push('日柱处“沐浴”，色欲与情感敏感度升高。');
  } else if (nonDayMuYuCount >= 2) {
    queerScore += 1;
    supportFacts.push(`另有 ${nonDayMuYuCount} 处沐浴，欲望波动偏频繁。`);
  }

  // 非配偶星压过配偶星：要求配偶几乎无透无气，且非配偶星足够显
  if (spouseWeak && !spousePatternAligned && nonSpouseVisible >= 2) {
    queerScore += 2;
    queerMainFlags.push('non-spouse-over');
    queerFacts.push(
      gender === 'male'
        ? '官杀明显透出而妻星近乎全虚，气机更偏同类掌控结构。'
        : '财星明显透出而夫星近乎全虚，气机更偏自我欲望表达。',
    );
  } else if (spouseWeak && !spousePatternAligned && nonSpouseVisible === 1) {
    supportFacts.push(
      gender === 'male'
        ? '官杀有透、妻星偏虚，作辅助结构信号。'
        : '财星有透、夫星偏虚，作辅助结构信号。',
    );
  }

  // 比劫：必须真的重，不能 1 透 + 几藏就当主证据
  const peerHeavy = peerVisible >= 2 || (peerVisible >= 1 && peerScore >= 6) || peerScore >= 8;
  if (peerHeavy) {
    queerScore += 2;
    queerMainFlags.push('peer-heavy');
    queerFacts.push(`比劫偏重（透干 ${peerVisible}，合计 ${peerScore}），对同类牵引更强。`);
  } else if (peerVisible >= 1 && spouseWeak) {
    supportFacts.push('比劫有透，但未成重局，只作辅助。');
  }

  // 身弱/格局/冲刑：只能辅助，且不能与从格改判重复叠太多
  if (!selfUnstable && strength <= -2 && spouseWeak) {
    queerScore += 1;
    supportFacts.push(`日主${strengthStatus || '偏弱'}且配偶星不厚，常规主证据更难压住破格信号。`);
  }

  if (!selfUnstable && pattern && /伤官|食神|比劫|建禄|月劫/.test(pattern) && spouseWeak) {
    queerScore += 1;
    supportFacts.push(`格局偏“${pattern}”，再叠加配偶星偏虚，破格倾向更明确。`);
  }

  if (hasDaySpouseClash && spouseWeak) {
    queerScore += 1;
    supportFacts.push('夫妻宫冲刑且配偶星偏虚，感情结构更不稳定。');
  }

  // 阴阳日主：纯辅助
  if (gender === 'male' && dayMasterYin && queerScore > 0) {
    queerScore += 1;
    supportFacts.push('男命日主偏阴，使既有破格信号略增重。');
  }
  if (gender === 'female' && dayMasterYang && queerScore > 0) {
    queerScore += 1;
    supportFacts.push('女命日主偏阳，使既有破格信号略增重。');
  }

  // ---------- 主证据核 ----------
  // 异性缘主核：正格下配偶星真正有气/成势
  const heteroCore = !selfUnstable && spousePresent && heteroScore >= 4;

  // 破格主核：
  // - 强硬核：孤鸾、从格改判、比劫成重、三桃花
  // - 中硬核：日支桃花、日柱沐浴、欲望神煞
  // 不能只靠身弱/冲刑/阴阳凑分
  const strongHardQueer =
    hasGuLuan
    || peerHeavy
    || totalPeachCount >= 3
    || (selfUnstable && (totalPeachCount >= 2 || spouseStrongRaw));
  const mediumHardQueer =
    dayIsPeach
    || dayIsMuYu
    || desireMainTags.length > 0
    || queerMainFlags.includes('non-spouse-over');
  const hasHardQueer = strongHardQueer || mediumHardQueer;

  // 强硬核：5 分可成核；仅中硬核：需要 6 分，防止“一点桃花就翻盘”
  const queerCore = hasHardQueer && (
    (strongHardQueer && queerScore >= 5)
    || (mediumHardQueer && queerScore >= 6)
    || (selfUnstable && totalPeachCount >= 3 && queerScore >= 4)
  );
  const bothSidesReal = heteroCore && queerCore;

  // ---------- 取向裁决 ----------
  let orientation = 'straight';
  if (bothSidesReal) {
    orientation = 'bi';
  } else if (queerCore && !heteroCore) {
    orientation = 'gay';
  } else if (queerCore && heteroCore && queerScore >= heteroScore + 2) {
    // 两边都有核，但破格明显更强：仍归同性恋，而不是勉强双
    orientation = 'gay';
  } else if (heteroCore && heteroScore >= queerScore) {
    orientation = 'straight';
  } else if (!queerCore && heteroScore >= 3) {
    orientation = 'straight';
  } else if (queerCore) {
    orientation = 'gay';
  } else {
    orientation = 'straight';
  }

  // ---------- 深柜 ----------
  // 只有非直盘才谈；需要“破格成立 + 表达被压 + 外表可维持常规”
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

  // 外表可装常规：正格配偶有气，或红鸾天喜
  const surfaceMask = (!selfUnstable && spousePresent) || hasHongLuanOrTianXi;
  if (surfaceMask && orientation !== 'straight') {
    closetScore += 2;
    closetFacts.push(
      hasHongLuanOrTianXi
        ? '红鸾/天喜仍可撑住常规恋爱叙事。'
        : (gender === 'male' ? '表面仍有妻星可支撑“常规叙事”。' : '表面仍有夫星可支撑“常规叙事”。'),
    );
  }

  if ((dayMasterYin || strength <= -2) && orientation !== 'straight') {
    closetScore += 1;
    closetFacts.push(dayMasterYin ? '日主偏阴，气机更内收。' : `日主${strengthStatus}，更习惯把锋芒收回。`);
  }

  let isDeepCloset = false;
  if (orientation !== 'straight') {
    const suppressed = printScore >= 2 || outputVisible === 0 || breakHidden > breakVisible;
    isDeepCloset = closetScore >= 6 && suppressed && surfaceMask;
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
    activeScore += Math.min(3, Math.ceil(officerScore / 2));
    activeFacts.push(`官杀合计 ${officerScore}，掌控欲上调。`);
  }
  if (peerScore > 0) {
    activeScore += Math.min(2, Math.ceil(peerScore / 3));
    activeFacts.push(`比劫合计 ${peerScore}，自我主张更强。`);
  }
  if (wealthScore > 0) {
    passiveScore += Math.min(3, Math.ceil(wealthScore / 2));
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
    } else if (supportFacts[0] && supportFacts[0].includes('桃花')) {
      factReasons.push(supportFacts[0].replace(/。$/, '，但还构不成主证据翻盘。'));
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
    if (heteroFacts[0] && spousePresent && !selfUnstable) {
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
      hasHardQueer,
      strongHardQueer,
      mediumHardQueer,
      hasStrongRoot,
      spouseHiddenOnly,
    },
  };
}
