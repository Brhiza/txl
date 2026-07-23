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
 * 基于 mingyu-core 完整八字盘的娱乐向多因子算法。
 *
 * 取向三轴：hetero / queer / bi
 * 角色两轴：active(1) / passive(0)
 * 深柜轴：内里有破格线索，但外在被压制、伪装或收着不说
 */
export function analyzeOrientation(birthDateValue, timeIndexValue, genderValue) {
  const { year, month, day } = parseBirthDate(birthDateValue);
  const timeIndex = parseTimeIndex(timeIndexValue);
  const gender = parseGender(genderValue);
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
  const hasXianChiOrTaoHua = peachTags.some((item) => item === '桃花' || item === '咸池' || item === '沐浴');

  const peachPillars = PILLAR_KEYS.filter((key) => PEACH_BRANCHES.has(pillars[key].zhi));
  const dayIsPeach = PEACH_BRANCHES.has(dayBranch);
  const muYuPillars = PILLAR_KEYS.filter((key) => chart.lifeStages?.[key] === '沐浴');
  const dayIsMuYu = chart.lifeStages?.day === '沐浴';

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

  const spouseScore = gender === 'male' ? wealthScore : officerScore;
  const spouseVisible = gender === 'male' ? wealthVisible : officerVisible;
  const nonSpouseScore = gender === 'male' ? officerScore : wealthScore;
  const nonSpouseVisible = gender === 'male' ? officerVisible : wealthVisible;

  // 破格类十神在藏干中的数量：越藏越像“柜”
  const queerHiddenGods = countGods(hidden, gender === 'male'
    ? ['比肩', '劫财', '食神', '伤官', '正官', '七杀']
    : ['比肩', '劫财', '食神', '伤官', '正财', '偏财']);
  const queerVisibleGods = countGods(visible, gender === 'male'
    ? ['比肩', '劫财', '食神', '伤官', '正官', '七杀']
    : ['比肩', '劫财', '食神', '伤官', '正财', '偏财']);

  const relationText = [
    ...(chart.pillarRelations?.fanyin || []),
    ...(chart.pillarRelations?.xingChong || []),
  ].join('；');
  const hasDaySpouseClash =
    relationText.includes('日柱') &&
    (relationText.includes('冲') || relationText.includes('刑') || relationText.includes('克'));

  let heteroScore = 0;
  let queerScore = 0;
  let biScore = 0;
  const heteroFacts = [];
  const queerFacts = [];
  const biFacts = [];

  if (spouseVisible >= 2 || spouseScore >= 5) {
    heteroScore += 4;
    heteroFacts.push(
      gender === 'male'
        ? `财星透干明显（透干 ${wealthVisible}，含藏合计 ${wealthScore}），传统妻星较实。`
        : `官杀透干明显（透干 ${officerVisible}，含藏合计 ${officerScore}），传统夫星较实。`,
    );
  } else if (spouseVisible === 1 || spouseScore >= 3) {
    heteroScore += 2;
    biScore += 1;
    heteroFacts.push(
      gender === 'male'
        ? '财星有根有气，传统异性缘仍在，但未成压倒之势。'
        : '官杀有根有气，传统异性缘仍在，但未成压倒之势。',
    );
  } else if (spouseScore <= 1) {
    queerScore += 3;
    queerFacts.push(
      gender === 'male'
        ? '妻星（财星）偏虚，传统异性配偶线索不足。'
        : '夫星（官杀）偏虚，传统异性配偶线索不足。',
    );
  }

  if (wealthScore > 0 && officerScore > 0) {
    biScore += 3;
    biFacts.push('财星与官杀同时成立，情欲结构两边都接得上。');
    if (spouseScore > 0 && nonSpouseScore > 0) {
      biScore += 1;
      queerScore += 1;
    }
  } else if (nonSpouseVisible > 0 && spouseVisible === 0) {
    queerScore += 2;
    queerFacts.push(
      gender === 'male'
        ? '官杀显而财星不透，气机更偏同类掌控/被掌控，而非传统妻星。'
        : '财星显而官杀不透，气机更偏自我欲望表达，而非传统夫星。',
    );
  }

  if (dayIsPeach) {
    queerScore += 2;
    biScore += 1;
    queerFacts.push(`日支落桃花地支“${dayBranch}”，夫妻宫本身带欲望波动。`);
  }

  if (peachPillars.length >= 3) {
    queerScore += 3;
    queerFacts.push(`四柱桃花地支多达 ${peachPillars.length} 处，欲望线索非常活跃。`);
  } else if (peachPillars.length === 2) {
    queerScore += 2;
    biScore += 1;
    biFacts.push('桃花地支出现两处，既有破格可能，也保留两边点燃的空间。');
  } else if (peachPillars.length === 1) {
    biScore += 1;
    biFacts.push('桃花地支只露一条，更像选择性点燃，而不是单边锁死。');
  }

  if (hasGuLuan) {
    queerScore += 3;
    queerFacts.push('见孤鸾煞，传统上主感情路径不按常例展开。');
  }
  if (hasXianChiOrTaoHua) {
    queerScore += 2;
    queerFacts.push(`命盘见${peachTags.filter((t) => ['桃花', '咸池', '沐浴'].includes(t)).join('、')}，情欲表达更容易破格。`);
  }
  if (hasHongLuanOrTianXi) {
    heteroScore += 1;
    biScore += 1;
    heteroFacts.push('红鸾/天喜仍在，说明正缘线索没有完全关掉。');
  }

  if (dayIsMuYu) {
    queerScore += 2;
    queerFacts.push('日柱处“沐浴”，色欲与情感敏感度升高。');
  } else if (muYuPillars.length >= 2) {
    queerScore += 1;
    biScore += 1;
    biFacts.push(`十二长生中有 ${muYuPillars.length} 处沐浴，欲望波动较频繁。`);
  }

  if (gender === 'male' && dayMasterYin) {
    queerScore += 2;
    queerFacts.push('男命日主偏阴，气机内收，非典型取向权重上调。');
  }
  if (gender === 'female' && dayMasterYang) {
    queerScore += 2;
    queerFacts.push('女命日主偏阳，气机外放，非典型取向权重上调。');
  }
  if (gender === 'male' && dayMasterYang && spouseScore >= 3) heteroScore += 1;
  if (gender === 'female' && dayMasterYin && spouseScore >= 3) heteroScore += 1;

  if (peerScore >= 4 || peerVisible >= 2) {
    queerScore += 2;
    queerFacts.push(`比劫较重（透干 ${peerVisible}），对同类牵引更强。`);
  } else if (peerVisible === 1) {
    biScore += 1;
  }

  if (outputScore >= 4 || outputVisible >= 2) {
    queerScore += 1;
    biScore += 2;
    biFacts.push(`食伤偏旺（透干 ${outputVisible}），表达外放，固定模式更易被冲开。`);
  }

  if (printScore >= 3 && spouseScore >= 2) {
    biScore += 1;
    biFacts.push('印星与配偶星并存，内外拉扯更像双性节奏。');
  }

  if (strength <= -2 && spouseScore <= 2) {
    queerScore += 1;
    queerFacts.push(`日主${strengthStatus || '偏弱'}且配偶星不厚，传统婚恋结构更难压住破格信号。`);
  }
  if (strength >= 2 && spouseScore >= 3) {
    heteroScore += 1;
    heteroFacts.push(`日主${strengthStatus || '偏强'}并得配偶星，常规取向底盘更稳。`);
  }
  if (pattern && /伤官|食神|比劫|建禄|月劫/.test(pattern) && spouseScore <= 2) {
    queerScore += 1;
    queerFacts.push(`格局偏“${pattern}”，再叠加配偶星偏虚，破格倾向更明显。`);
  }
  if (pattern && /正财|偏财|正官|七杀|财/.test(pattern) && spouseScore >= 3) {
    heteroScore += 1;
    heteroFacts.push(`格局见“${pattern}”，与传统配偶星方向一致。`);
  }

  if (hasDaySpouseClash) {
    queerScore += 1;
    biScore += 1;
    biFacts.push('夫妻宫相关冲刑明显，感情结构更不稳定，取向更易游移。');
  }

  const netQueer = queerScore - heteroScore;
  const bothSide = Math.min(queerScore, heteroScore);

  let orientation = 'straight';
  if (biScore >= 4 && bothSide >= 2 && Math.abs(netQueer) <= 3) {
    orientation = 'bi';
  } else if (netQueer >= 3 && queerScore >= 6) {
    orientation = 'gay';
  } else if (biScore >= 5 && queerScore >= 4 && heteroScore >= 2) {
    orientation = 'bi';
  } else if (netQueer >= 2 && queerScore >= 5 && biScore <= 3) {
    orientation = 'gay';
  } else if (heteroScore >= queerScore + 1 || (heteroScore >= 4 && netQueer <= 1)) {
    orientation = 'straight';
  } else if (queerScore >= 7) {
    orientation = 'gay';
  } else if (biScore >= 4 && queerScore >= 3) {
    orientation = 'bi';
  } else {
    orientation = 'straight';
  }

  // ---------- 深柜轴 ----------
  // 深柜 = 内里破格/同性线索够，但表达被压、表面维持常规
  let closetScore = 0;
  const closetFacts = [];
  const openFacts = [];

  if (printScore >= 4 || printVisible >= 2) {
    closetScore += 3;
    closetFacts.push(`印星偏重（透干 ${printVisible}，合计 ${printScore}），更会把真实欲望往里收。`);
  } else if (printScore >= 2) {
    closetScore += 1;
    closetFacts.push('印星有气，表达上更容易克制。');
  }

  if (outputVisible === 0 && outputScore <= 2) {
    closetScore += 3;
    closetFacts.push('食伤几乎不透，心里有事也不太往外说。');
  } else if (outputVisible === 0) {
    closetScore += 2;
    closetFacts.push('食伤不透干，外放表达偏弱。');
  } else if (outputVisible >= 2) {
    closetScore -= 2;
    openFacts.push(`食伤透干 ${outputVisible} 个，更敢直接表达，深柜倾向下降。`);
  }

  if (spouseVisible >= 1 && queerScore >= 4) {
    closetScore += 2;
    closetFacts.push(
      gender === 'male'
        ? '表面仍有妻星可演“正常”，但破格线索已经不轻。'
        : '表面仍有夫星可演“正常”，但破格线索已经不轻。',
    );
  }

  if (queerHiddenGods >= queerVisibleGods + 2 && queerHiddenGods >= 3) {
    closetScore += 3;
    closetFacts.push(`破格相关十神多藏不透（藏 ${queerHiddenGods} / 透 ${queerVisibleGods}），更像压在柜子里。`);
  } else if (queerHiddenGods > queerVisibleGods && queerHiddenGods >= 2) {
    closetScore += 2;
    closetFacts.push('关键破格信号更多落在藏干，外在不那么显眼。');
  } else if (queerVisibleGods >= 3 && outputVisible >= 1) {
    closetScore -= 1;
    openFacts.push('破格信号透干较多，没那么“深藏”。');
  }

  if (dayMasterYin || strength <= -2) {
    closetScore += 1;
    closetFacts.push(dayMasterYin ? '日主偏阴，本来就更内收。' : `日主${strengthStatus}，更习惯把锋芒收回去。`);
  }

  if (hasGuLuan && spouseScore >= 2) {
    closetScore += 1;
    closetFacts.push('孤鸾与配偶星同见，外面像有正缘框架，里面仍容易偏轨。');
  }

  if (hasHongLuanOrTianXi && queerScore >= 5) {
    closetScore += 1;
    closetFacts.push('红鸾/天喜还能撑住“常规恋爱叙事”，更容易把真实取向盖住。');
  }

  if (pattern && /正官|正财|七杀|偏财/.test(pattern) && queerScore >= 5) {
    closetScore += 1;
    closetFacts.push(`格局挂着“${pattern}”的常规外壳，实际破格分却不低。`);
  }

  // 只有同性恋/双性恋才判深柜；纯直盘不谈柜子
  let isDeepCloset = false;
  if (orientation !== 'straight') {
    if (closetScore >= 6 && queerScore >= 4) isDeepCloset = true;
    else if (closetScore >= 5 && spouseVisible >= 1 && outputVisible <= 1) isDeepCloset = true;
    else if (closetScore >= 7) isDeepCloset = true;
  }

  // ---------- 0/1 角色 ----------
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
    activeScore += Math.min(4, officerScore);
    activeFacts.push(`官杀合计 ${officerScore}，掌控欲与主导欲上调。`);
  }
  if (peerScore > 0) {
    activeScore += Math.min(3, peerScore);
    activeFacts.push(`比劫合计 ${peerScore}，自我主张更强。`);
  }
  if (wealthScore > 0) {
    passiveScore += Math.min(4, wealthScore);
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
    passiveScore += 2;
    passiveFacts.push('夫妻宫桃花/沐浴/孤鸾一类信号偏多，角色更容易偏受动。');
  }
  if (gender === 'male' && officerScore >= wealthScore + 2) {
    activeScore += 1;
    activeFacts.push('男命官杀明显强于财星，主动位再抬一档。');
  }
  if (gender === 'female' && wealthScore >= officerScore + 2) {
    passiveScore += 1;
    passiveFacts.push('女命财星明显强于官杀，受动位再抬一档。');
  }

  let role = null;
  let roleText = '不适用';
  if (orientation !== 'straight') {
    if (activeScore > passiveScore + 1) role = '1';
    else if (passiveScore > activeScore + 1) role = '0';
    else role = dayMasterYang ? '1' : '0';
    roleText = role === '1' ? '1（偏主动）' : '0（偏受动）';
  }

  const factReasons = [];
  const conclusionReasons = [];

  if (orientation === 'straight') {
    factReasons.push(...heteroFacts.slice(0, 3));
    if (queerFacts[0]) {
      factReasons.push(queerFacts[0].replace(/。$/, '，但还压不过传统配偶星结构。'));
    }
    if (factReasons.length === 0) {
      factReasons.push('配偶星、桃花与破格信号都不够成局，整体更接近常规取向。');
    }
  } else if (orientation === 'bi') {
    factReasons.push(...biFacts.slice(0, 3));
    if (heteroFacts[0]) factReasons.push(heteroFacts[0]);
    if (queerFacts[0]) factReasons.push(queerFacts[0]);
    conclusionReasons.push('异性缘与破格信号同时成立，所以更接近双性恋。');
  } else {
    factReasons.push(...queerFacts.slice(0, 4));
    if (heteroFacts[0] && spouseScore > 0) {
      factReasons.push(heteroFacts[0].replace(/。$/, '，但主线仍被破格信号盖过。'));
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
      conclusionReasons.push('内里破格线索足、外在表达被压，所以判为深柜。');
    } else {
      if (openFacts[0]) factReasons.push(openFacts[0]);
      else if (closetFacts[0]) factReasons.push(closetFacts[0].replace(/。$/, '，但还没到深柜阈值。'));
      conclusionReasons.push('表达轴没有被明显锁死，所以不算深柜。');
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
    detail: `${genderText} · ${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${timeLabel} · 四柱 ${pillarsText} · 日主 ${dayMasterText}${strengthStatus ? `（${strengthStatus}）` : ''}${pattern ? ` · 格局 ${pattern}` : ''}`,
    reasons,
    finale: buildFinale(gender, orientation, isDeepCloset),
    scores: {
      heteroScore,
      queerScore,
      biScore,
      netQueer,
      activeScore,
      passiveScore,
      closetScore,
      spouseScore,
      wealthScore,
      officerScore,
      peerScore,
      outputScore,
      printScore,
      queerHiddenGods,
      queerVisibleGods,
    },
  };
}
