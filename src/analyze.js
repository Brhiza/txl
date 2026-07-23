import { baziCalculator } from 'mingyu-core/bazi';

const PILLAR_KEYS = ['year', 'month', 'day', 'hour'];
const PILLAR_LABEL = { year: '年', month: '月', day: '日', hour: '时' };

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
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
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

function pillarHasTag(shensha = {}, key, keyword) {
  return (shensha[key] || []).some((item) => String(item).includes(keyword));
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

function scoreGods(visibleCount, hiddenCount) {
  return visibleCount * 2 + hiddenCount;
}

function buildFinale(gender, orientation, isDeepCloset) {
  if (orientation === 'straight') return '你根本不是同性恋！';
  if (isDeepCloset) {
    if (gender === 'female') {
      return orientation === 'bi'
        ? '皇帝，你女儿是深柜双，你女儿是深柜啊，你女儿是双性恋你不懂吗？'
        : '皇帝，你女儿是深柜 les，你女儿是深柜啊，你女儿是同性恋你不懂吗？';
    }
    return orientation === 'bi'
      ? '皇帝，你儿子是深柜双，你儿子是深柜啊，你儿子是双性恋你不懂吗？'
      : '皇帝，你儿子是深柜 gay，你儿子是深柜啊，你儿子是同性恋你不懂吗？';
  }
  if (gender === 'female') {
    return orientation === 'bi'
      ? '皇帝，你女儿是双，你女儿是双啊，你女儿是双性恋你不懂吗？'
      : '皇帝，你女儿是les，你女儿是les啊，你女儿是同性恋你不懂吗？';
  }
  return orientation === 'bi'
    ? '皇帝，你儿子是双，你儿子是双啊，你儿子是双性恋你不懂吗？'
    : '皇帝，你儿子是gay，你儿子是gay啊，你儿子是同性恋你不懂吗？';
}

/**
 * 取向证据链（提高“是/不是”准确度）：
 * 1. 异性缘主证据：配偶星透干，或格局以配偶星为主且有根；从格/极弱不作正格异性缘
 * 2. 破格主证据只用“真神煞/结构”：
 *    - 桃花取自盘面神煞位，不用“子午卯酉见就算”
 *    - 孤鸾只作中等信号，不能单独翻案
 *    - 比劫成重必须叠加配偶全虚才算结构破格
 * 3. 双性恋 = 两边都有独立主核；配偶成势时，破格侧必须是强硬核
 * 4. 辅助分（阴阳日主、身弱、配偶偏虚）永不单独成核
 */
export function analyzeOrientation(birthDateValue, timeIndexValue, genderValue, personNameValue) {
  const { year, month, day } = parseBirthDate(birthDateValue);
  const timeIndex = parseTimeIndex(timeIndexValue);
  const gender = parseGender(genderValue);
  const personName = parsePersonName(personNameValue);
  const genderText = gender === 'male' ? '男' : '女';
  const timeLabel = TIME_OPTIONS.find((item) => item.value === timeIndex)?.label || `时辰 ${timeIndex}`;

  const chart = baziCalculator.calculateBazi({ year, month, day, timeIndex, gender });
  const pillars = chart.pillars;
  const dayMaster = chart.dayMaster;
  const dayMasterYin = dayMaster.yinYang === '阴';
  const dayMasterYang = !dayMasterYin;
  const dayBranch = pillars.day.zhi;
  const strengthStatus = chart.analysis?.dayMasterStrength?.status || '';
  const pattern = chart.analysis?.mingGe?.pattern || '';

  const { visible, hidden } = collectTenGods(chart);
  const shenshaList = flattenShensha(chart.shensha);
  const hasGuLuan = shenshaList.some((item) => String(item).includes('孤鸾'));
  const hasHongLuanOrTianXi = shenshaList.some((item) => {
    const s = String(item);
    return s.includes('红鸾') || s.includes('天喜');
  });

  // 真桃花：用神煞落柱，不用地支字面“子午卯酉”
  const peachPillars = PILLAR_KEYS.filter((key) => pillarHasTag(chart.shensha, key, '桃花'));
  const totalPeachCount = peachPillars.length;
  const dayIsPeach = peachPillars.includes('day');
  const multiPeach = totalPeachCount >= 2;
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
  const outputScore = scoreGods(outputVisible, outputHidden);
  const peerScore = scoreGods(peerVisible, peerHidden);
  const printScore = scoreGods(printVisible, printHidden);

  const spouseVisible = gender === 'male' ? wealthVisible : officerVisible;
  const spouseHidden = gender === 'male' ? wealthHidden : officerHidden;
  const spouseScore = gender === 'male' ? wealthScore : officerScore;
  const nonSpouseVisible = gender === 'male' ? officerVisible : wealthVisible;

  const isCongPattern = /从/.test(pattern) || strengthStatus.includes('从');
  const isExtremeWeak = strengthStatus.includes('极弱');
  const selfUnstable = isCongPattern || isExtremeWeak;

  const spousePatternAligned = gender === 'male'
    ? /正财|偏财|财/.test(pattern)
    : /正官|七杀|官|杀/.test(pattern);

  const spouseStrong = !selfUnstable && (
    spouseVisible >= 2
    || (spouseVisible >= 1 && spouseScore >= 4)
    || (spouseVisible >= 1 && spousePatternAligned)
  );
  const spousePresent = !selfUnstable && (
    spouseVisible >= 1
    || (spousePatternAligned && spouseScore >= 3 && spouseHidden >= 1)
  );
  const spouseAbsent = spouseVisible === 0 && spouseScore <= 2 && !spousePatternAligned;
  const spouseHiddenOnly = spouseVisible === 0 && spouseScore >= 3 && !spousePatternAligned;

  // 比劫成势：先看数量；是否构成破格另要求配偶全虚
  const peerHeavyRaw = peerVisible >= 3 || (peerVisible >= 2 && peerScore >= 6);
  const peerHeavy = peerHeavyRaw && spouseAbsent;

  let heteroScore = 0;
  let queerScore = 0;
  const heteroFacts = [];
  const queerFacts = [];
  const supportFacts = [];

  // ---------- 异性缘 ----------
  if (selfUnstable && (spouseVisible >= 1 || spouseScore >= 4)) {
    heteroScore += 1;
    queerScore += 1;
    heteroFacts.push(
      gender === 'male'
        ? `虽见财星（透干 ${wealthVisible}，合计 ${wealthScore}），但日主从格/极弱，不能按普通妻星成势看。`
        : `虽见官杀（透干 ${officerVisible}，合计 ${officerScore}），但日主从格/极弱，不能按普通夫星成势看。`,
    );
    supportFacts.push(
      isCongPattern
        ? `格局为“${pattern || '从格'}”，日主难自立，传统婚恋主证据要降权。`
        : `日主${strengthStatus || '极弱'}，传统配偶星再多也难当正格异性缘。`,
    );
  } else if (spouseStrong) {
    heteroScore += 5;
    heteroFacts.push(
      gender === 'male'
        ? `妻星（财星）成势：透干 ${wealthVisible}，合计 ${wealthScore}。`
        : `夫星（官杀）成势：透干 ${officerVisible}，合计 ${officerScore}。`,
    );
  } else if (spousePresent) {
    heteroScore += 3;
    if (spouseVisible >= 1) {
      heteroFacts.push(
        gender === 'male' ? '妻星透干有气，传统异性缘成立。' : '夫星透干有气，传统异性缘成立。',
      );
    } else {
      heteroFacts.push(
        gender === 'male'
          ? `格局为“${pattern}”，妻星是盘面主结构，传统异性缘成立。`
          : `格局为“${pattern}”，夫星是盘面主结构，传统异性缘成立。`,
      );
    }
  } else if (spouseHiddenOnly) {
    heteroScore += 1;
    supportFacts.push(
      gender === 'male' ? '妻星只见藏干，异性缘有底气但未透清。' : '夫星只见藏干，异性缘有底气但未透清。',
    );
  } else if (spouseAbsent) {
    // 只作辅助：配偶偏虚不能单独把人判成破格
    supportFacts.push(
      gender === 'male' ? '妻星偏虚，传统异性缘偏弱。' : '夫星偏虚，传统异性缘偏弱。',
    );
  }

  if (hasHongLuanOrTianXi && spousePresent) {
    heteroScore += 2;
    heteroFacts.push('见红鸾/天喜，正缘框架仍在。');
  } else if (hasHongLuanOrTianXi) {
    heteroScore += 1;
    supportFacts.push('见红鸾/天喜，作常规叙事辅助。');
  }

  if (spousePresent && pattern && spousePatternAligned) {
    heteroScore += 1;
    heteroFacts.push(`格局“${pattern}”与配偶星方向一致。`);
  }

  // ---------- 破格证据 ----------
  // 强硬：真桃花多柱、比劫成重且配偶全虚、从格/极弱叠加真桃花结构
  if (multiPeach) {
    queerScore += dayIsPeach ? 4 : 3;
    const places = peachPillars.map((k) => PILLAR_LABEL[k]).join('、');
    queerFacts.push(`真桃花落在${places}柱（共 ${totalPeachCount} 处），欲望结构明显活跃。`);
  } else if (dayIsPeach) {
    queerScore += 2;
    queerFacts.push(`日柱见真桃花，夫妻宫本身带欲望波动。`);
  } else if (totalPeachCount === 1) {
    supportFacts.push(`另有${PILLAR_LABEL[peachPillars[0]]}柱桃花，作辅助波动信号。`);
  }

  if (peerHeavy) {
    queerScore += 4;
    queerFacts.push(`比劫成重（透干 ${peerVisible}，合计 ${peerScore}）且配偶星近乎全虚，对同类牵引强。`);
  } else if (peerHeavyRaw && !spouseAbsent) {
    supportFacts.push(`比劫偏重（透干 ${peerVisible}），但配偶星仍在，只作个性辅助。`);
  } else if (peerVisible >= 2 && spouseAbsent) {
    queerScore += 1;
    supportFacts.push('比劫有透且配偶星偏虚，作辅助结构信号。');
  }

  if (selfUnstable && multiPeach) {
    queerScore += 2;
    queerFacts.push(
      isCongPattern
        ? `从格叠真桃花多柱，传统婚恋主证据改判。`
        : `日主${strengthStatus || '极弱'}叠真桃花多柱，传统婚恋主证据改判。`,
    );
  } else if (selfUnstable && dayIsPeach) {
    queerScore += 1;
    supportFacts.push('从格/极弱又见日柱桃花，破格倾向略增。');
  }

  // 中等：孤鸾 / 沐浴 / 非配偶压过配偶（均不可单独成核）
  if (hasGuLuan) {
    queerScore += 2;
    queerFacts.push('见孤鸾煞，感情路径更易偏离常例。');
  }

  if (dayIsMuYu) {
    queerScore += 2;
    queerFacts.push('日柱处“沐浴”，色欲与情感敏感度升高。');
  }

  if (spouseAbsent && nonSpouseVisible >= 2) {
    queerScore += 2;
    queerFacts.push(
      gender === 'male'
        ? '官杀明显透出而妻星近乎全虚，气机更偏同类掌控结构。'
        : '财星明显透出而夫星近乎全虚，气机更偏自我欲望表达。',
    );
  }

  // 阴阳日主：仅在已有破格硬/中证据时微调
  const hasQueerSignalBase =
    multiPeach
    || dayIsPeach
    || dayIsMuYu
    || hasGuLuan
    || peerHeavy
    || (spouseAbsent && nonSpouseVisible >= 2);

  if (hasQueerSignalBase && gender === 'male' && dayMasterYin) {
    queerScore += 1;
    supportFacts.push('男命日主偏阴，使既有破格信号略增重。');
  }
  if (hasQueerSignalBase && gender === 'female' && dayMasterYang) {
    queerScore += 1;
    supportFacts.push('女命日主偏阳，使既有破格信号略增重。');
  }

  // ---------- 主核 ----------
  const heteroCore = !selfUnstable && spousePresent && heteroScore >= 3;

  const strongQueerHard = multiPeach || peerHeavy;

  const mediumFlags = [
    dayIsPeach && !multiPeach,
    dayIsMuYu,
    hasGuLuan,
    spouseAbsent && nonSpouseVisible >= 2,
    peerVisible >= 2 && spouseAbsent && !peerHeavy,
  ];
  const mediumCount = mediumFlags.filter(Boolean).length;
  const mediumQueerHard = mediumCount >= 1;

  // 成核：
  // - 强硬破格：分数 >= 4
  // - 中等破格：至少 2 个独立中等信号，且分数 >= 6（杜绝孤鸾/沐浴单独翻案）
  // - 单中等信号：分数再高也不成核
  const queerCore =
    (strongQueerHard && queerScore >= 4)
    || (mediumCount >= 2 && queerScore >= 6);

  // ---------- 取向 ----------
  let orientation = 'straight';
  if (heteroCore && queerCore) {
    // 配偶成势时，破格侧必须是强硬核，否则不判双（避免孤鸾把成势盘打成双）
    if (spouseStrong && !strongQueerHard) {
      orientation = 'straight';
    } else if (!spouseStrong && strongQueerHard && queerScore >= heteroScore + 2) {
      // 破格远强、配偶只是勉强有气 → 偏 gay 而非双
      orientation = 'gay';
    } else {
      orientation = 'bi';
    }
  } else if (queerCore && !heteroCore) {
    orientation = 'gay';
  } else {
    orientation = 'straight';
  }

  // ---------- 深柜 ----------
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
    closetScore += 2;
    closetFacts.push('食伤不透干，外放表达偏弱。');
  } else if (outputVisible >= 2) {
    closetScore -= 2;
    openFacts.push(`食伤透干 ${outputVisible} 个，更敢直接表达。`);
  }

  const breakHidden = countGods(hidden, ['比肩', '劫财', '食神', '伤官']);
  const breakVisible = countGods(visible, ['比肩', '劫财', '食神', '伤官']);
  if (breakHidden >= breakVisible + 2 && breakHidden >= 3) {
    closetScore += 2;
    closetFacts.push(`比劫/食伤多藏不透（藏 ${breakHidden} / 透 ${breakVisible}），破格更像压在里面。`);
  }

  const surfaceMask = (!selfUnstable && spousePresent) || hasHongLuanOrTianXi;
  if (surfaceMask && orientation !== 'straight') {
    closetScore += 2;
    closetFacts.push(
      hasHongLuanOrTianXi
        ? '红鸾/天喜仍可撑住常规恋爱叙事。'
        : (gender === 'male' ? '表面仍有妻星可支撑“常规叙事”。' : '表面仍有夫星可支撑“常规叙事”。'),
    );
  }

  if (dayMasterYin && orientation !== 'straight') {
    closetScore += 1;
    closetFacts.push('日主偏阴，气机更内收。');
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
    } else if (supportFacts[0]) {
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
    conclusionReasons.push(gender === 'female' ? '所以结论是：你是 les。' : '所以结论是：你是 gay。');
  }

  if (orientation !== 'straight') {
    const roleGap = Math.abs(activeScore - passiveScore);
    if (role === '1') {
      factReasons.push(...activeFacts.slice(0, 2));
      conclusionReasons.push(roleGap > 1 ? '主动轴明显强于受动轴，所以是 1。' : '主动与受动接近，按日主偏阳定夺为 1。');
    } else {
      factReasons.push(...passiveFacts.slice(0, 2));
      conclusionReasons.push(roleGap > 1 ? '受动轴明显强于主动轴，所以是 0。' : '主动与受动接近，按日主偏阴定夺为 0。');
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
      spouseAbsent,
      spouseHiddenOnly,
      selfUnstable,
      heteroCore,
      queerCore,
      queerHard: strongQueerHard || (mediumCount >= 2),
      multiPeach,
      peerHeavy,
      dayIsPeach,
      mediumCount,
      totalPeachCount,
    },
  };
}

