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

function listHas(list, keyword) {
  return (list || []).some((item) => String(item).includes(keyword));
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

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function softStack(weights) {
  const sorted = [...weights].filter((w) => w > 0).sort((a, b) => b - a);
  let total = 0;
  const decay = [1, 0.55, 0.35, 0.22, 0.15, 0.1];
  sorted.forEach((w, i) => {
    total += w * (decay[i] ?? 0.08);
  });
  return total;
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
 * 多维同源协同取向算法
 *
 * 原则：穷举婚恋相关证据并按同源归维；同维饱和、跨维协同；
 * 成核看证据链是否闭合，终判看两轴相对强弱。不做目标概率调参。
 *
 * 异性轴 = 配偶质地 x 自立 + 正缘/用神同向 + 夫妻宫稳
 * 破格轴 = 日宫欲望 + 结构倒置 + 同类牵引 + 夫妻宫破损 + 从格空转
 *
 * 硬同源（可 multi/残响）：真桃花、硬结构、硬同类、从格、用神背离、已闭合硬单链。
 * 结构硬核按性别：
 *   女命 = 伤官见官 / 财重夫虚+宫锚 / 食伤压官 / 从格(含从财从儿) / 用神背离夫星 / 比劫重夫虚
 *   男命 = 比劫夺财 / 比劫重妻虚 / 日支比劫·食伤线 / 从格 / 用神背离妻星
 *   男命「官杀重妻虚」属事业结构，不计入破格硬核。
 * 软燃料（孤鸾/红艳/华盖/沐浴/八专等）只抬欲望维，不可单独闭合任何链。
 * 多维同源：成对协同 + 连续场(homoField) + multi 计维（欲望/结构/同类/宫）。
 * 每条成核链必须跨维配合，第二维不能只是软神煞。不做目标概率调参。
 */
export function analyzeOrientation(birthDateValue, timeIndexValue, genderValue, personNameValue) {
  const { year, month, day } = parseBirthDate(birthDateValue);
  const timeIndex = parseTimeIndex(timeIndexValue);
  const gender = parseGender(genderValue);
  const personName = parsePersonName(personNameValue);
  const genderText = gender === 'male' ? '男' : '女';
  const timeLabel = TIME_OPTIONS.find((item) => item.value === timeIndex)?.label || ('时辰 ' + timeIndex);

  const chart = baziCalculator.calculateBazi({ year, month, day, timeIndex, gender });
  const pillars = chart.pillars;
  const dayMaster = chart.dayMaster;
  const dayMasterYin = dayMaster.yinYang === '阴';
  const dayMasterYang = !dayMasterYin;
  const strengthStatus = chart.analysis?.dayMasterStrength?.status || '';
  const pattern = chart.analysis?.mingGe?.pattern || '';
  const useful = chart.analysis?.usefulGod || {};
  const favorableGods = [
    ...(useful.primaryFavorable || []),
    ...(useful.secondaryFavorable || []),
    ...(useful.favorable || []),
  ];
  const unfavorableGods = [
    ...(useful.primaryUnfavorable || []),
    ...(useful.secondaryUnfavorable || []),
    ...(useful.unfavorable || []),
  ];

  const { visible, hidden } = collectTenGods(chart);
  const shenshaList = flattenShensha(chart.shensha);
  const hasGuLuan = listHas(shenshaList, '孤鸾');
  const hasHongLuan = listHas(shenshaList, '红鸾');
  const hasTianXi = listHas(shenshaList, '天喜');
  const hasHongLuanOrTianXi = hasHongLuan || hasTianXi;
  const hasHongYan = listHas(shenshaList, '红艳');
  const hasGuaSu = listHas(shenshaList, '寡宿') || listHas(shenshaList, '孤辰');
  const hasGuXu = listHas(shenshaList, '孤虚');
  const hasTongZi = listHas(shenshaList, '童子');
  const hasHuaGai = listHas(shenshaList, '华盖');
  const dayHuaGai = pillarHasTag(chart.shensha, 'day', '华盖');
  const hasJinYu = listHas(shenshaList, '金舆');
  const dayJinYu = pillarHasTag(chart.shensha, 'day', '金舆');
  const hasJiuChou = listHas(shenshaList, '九丑');
  const hasYinYangSha = listHas(shenshaList, '阴阳');
  const hasLiuXia = listHas(shenshaList, '流霞');
  const hasYangRen = listHas(shenshaList, '羊刃');
  const dayYangRen = pillarHasTag(chart.shensha, 'day', '羊刃') || pillarHasTag(chart.shensha, 'day', '飞刃');
  const hasXueRen = listHas(shenshaList, '血刃') || listHas(shenshaList, '血光');
  const hasYiMa = listHas(shenshaList, '驿马');
  const hasBaZhuan = listHas(shenshaList, '八专');
  const dayBaZhuan = pillarHasTag(chart.shensha, 'day', '八专');
  // 特殊从格细化（娱乐向取向：从势下正缘更易空转）
  const isCongCai = /从财/.test(pattern);
  const isCongEr = /从儿|从食|从伤/.test(pattern);
  const isCongSha = /从杀|从官/.test(pattern);

  const peachPillars = PILLAR_KEYS.filter((key) => pillarHasTag(chart.shensha, key, '桃花'));
  const totalPeachCount = peachPillars.length;
  const dayIsPeach = peachPillars.includes('day');
  const multiPeach = totalPeachCount >= 2;

  const dayStage = chart.lifeStages?.day || '';
  const dayIsMuYu = dayStage === '沐浴';
  const dayCollapsed = /墓|死|绝/.test(dayStage);
  const dayWeakStage = /病|衰|胎|养/.test(dayStage);
  const dayIsWang = /帝旺|临官|长生/.test(dayStage);
  const strengthDetails = chart.analysis?.dayMasterStrength?.details || {};
  const hasRoot = !!strengthDetails.hasRoot || !!strengthDetails.hasStrongRoot;
  const hasSupport = !!strengthDetails.hasSupport;
  const dayZiZuo = chart.ziZuo?.day || '';
  const dayZiZuoCollapsed = /墓|死|绝/.test(dayZiZuo);
  const dayZiZuoWang = /帝旺|临官|长生/.test(dayZiZuo);

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
  const shangVisible = countGods(visible, ['伤官']);

  const wealthScore = scoreGods(wealthVisible, wealthHidden);
  const officerScore = scoreGods(officerVisible, officerHidden);
  const outputScore = scoreGods(outputVisible, outputHidden);
  const peerScore = scoreGods(peerVisible, peerHidden);
  const printScore = scoreGods(printVisible, printHidden);

  const spouseNames = gender === 'male' ? ['正财', '偏财'] : ['正官', '七杀'];
  const nonSpouseNames = gender === 'male' ? ['正官', '七杀'] : ['正财', '偏财'];
  const spouseVisible = gender === 'male' ? wealthVisible : officerVisible;
  const spouseHidden = gender === 'male' ? wealthHidden : officerHidden;
  const spouseScore = gender === 'male' ? wealthScore : officerScore;
  const nonSpouseVisible = gender === 'male' ? officerVisible : wealthVisible;

  const dayHiddenGods = chart.hiddenTenGods?.day || [];
  const dayMainGod = dayHiddenGods[0] || '';
  const dayBranchIsSpouse = spouseNames.includes(dayMainGod);
  const dayBranchIsPeer = ['比肩', '劫财'].includes(dayMainGod);
  const dayBranchIsOutput = ['食神', '伤官'].includes(dayMainGod);
  const dayBranchIsNonSpouse = nonSpouseNames.includes(dayMainGod);
  const dayBranchHasSpouse = dayHiddenGods.some((g) => spouseNames.includes(g));

  const spouseFavorCount = spouseNames.filter((n) => favorableGods.includes(n)).length;
  const spouseAvoidCount = spouseNames.filter((n) => unfavorableGods.includes(n)).length;
  const spouseUsefulAligned = spouseFavorCount > 0 && spouseAvoidCount === 0;
  const spouseUsefulOpposed = spouseAvoidCount > 0 && spouseFavorCount === 0;

  const isCongPattern = /从/.test(pattern) || strengthStatus.includes('从');
  const isExtremeWeak = strengthStatus.includes('极弱');
  const isWeak = strengthStatus.includes('身弱') || strengthStatus.includes('偏弱');
  const isStrong = strengthStatus.includes('身强') || strengthStatus.includes('偏强') || strengthStatus.includes('旺');
  const selfUnstable = isCongPattern || isExtremeWeak;
  let selfStand = 1;
  if (isCongPattern) selfStand = 0.22;
  else if (isExtremeWeak) selfStand = 0.32;
  else if (isWeak) selfStand = 0.72;
  else if (isStrong) selfStand = 1;
  else selfStand = 0.9;

  const spousePatternAligned = gender === 'male'
    ? /正财|偏财|财格|财旺/.test(pattern)
    : /正官|七杀|官格|杀格|官旺|杀旺/.test(pattern)
      || (/官/.test(pattern) && !/伤官|食神/.test(pattern));

  const rel = chart.pillarRelations || {};
  const xingChong = rel.xingChong || [];
  const fanyin = rel.fanyin || [];
  const fuxin = rel.fuxin || [];
  const dayRelList = xingChong.filter((s) => {
    const t = String(s);
    return t.includes('日柱') || /与日|日与/.test(t);
  });
  const dayClashHeavy = dayRelList.filter((s) => /冲|刑/.test(String(s)) && !/合/.test(String(s))).length;
  const dayClashSoft = dayRelList.filter((s) => /破|害/.test(String(s)) && !/合/.test(String(s))).length;
  const dayHe = dayRelList.filter((s) => {
    const t = String(s);
    return /合/.test(t) && !/冲|刑/.test(t);
  }).length;
  const dayFanYin = fanyin.some((s) => String(s).includes('日柱') || String(s).includes('日'));
  const dayFuYin = fuxin.some((s) => String(s).includes('日柱') || String(s).includes('日'));
  const fuYinHeavy = fuxin.length >= 2 || dayFuYin;

  const dayKong = chart.kongWang?.day || [];
  const dayZhi = pillars?.day?.zhi || (pillars?.day?.ganZhi ? String(pillars.day.ganZhi).slice(1) : '');
  const dayIsKong = !!(dayZhi && dayKong.includes(dayZhi));

  const hourGod = chart.tenGods?.hour || '';
  const hourIsSpouse = spouseNames.includes(hourGod);
  const hourIsPeer = hourGod === '比肩' || hourGod === '劫财';
  const hourIsNonSpouse = nonSpouseNames.includes(hourGod);
  const monthGod = chart.tenGods?.month || '';
  const monthIsSpouse = spouseNames.includes(monthGod);

  const femaleHurtOfficer = gender === 'female' && shangVisible >= 1 && officerVisible >= 1;
  const femaleOutputOverOfficer = gender === 'female' && outputVisible >= 2 && officerVisible <= 1;
  const malePeerRobWealth = gender === 'male' && peerVisible >= 2 && wealthVisible <= 1;
  const maleOutputOverWealth = gender === 'male' && outputVisible >= 2 && wealthVisible === 0;

  // 盘面配偶是否真实存在（不看自立）：用于硬结构与软欲望分流
  const spouseOnChart = spouseVisible >= 1 || spouseScore >= 3 || spousePatternAligned;

  // 通根/帮扶可略抬自立；无根极弱更难按正格异性缘
  if (!isCongPattern) {
    if (hasRoot && hasSupport && isWeak) selfStand = Math.max(selfStand, 0.8);
    if (hasRoot && isExtremeWeak) selfStand = Math.max(selfStand, 0.36);
    if (!hasRoot && isExtremeWeak) selfStand = Math.min(selfStand, 0.3);
  }
  // 极弱但配偶星成格/成势：给一点自立，避免正财/官格被完全清零
  if (isExtremeWeak && !isCongPattern && spouseOnChart) {
    if (spouseVisible >= 2 && spouseScore >= 5 && spousePatternAligned) selfStand = Math.max(selfStand, 0.48);
    else if (spouseVisible >= 1 && spouseScore >= 4) selfStand = Math.max(selfStand, 0.4);
  }

  const spouseStrong = selfStand >= 0.65 && (
    spouseVisible >= 2
    || (spouseVisible >= 1 && spouseScore >= 4)
    || (spouseVisible >= 1 && spousePatternAligned && !spouseUsefulOpposed)
  );
  const spousePresent = selfStand >= 0.65 && (
    spouseVisible >= 1
    || (spousePatternAligned && spouseScore >= 3 && spouseHidden >= 1)
  );
  const spouseAbsent = spouseVisible === 0 && spouseScore <= 2 && !spousePatternAligned;
  const spouseHiddenOnly = spouseVisible === 0 && spouseScore >= 3 && !spousePatternAligned;
  const spouseThin = spouseAbsent
    || (spouseHiddenOnly && nonSpouseVisible >= 1)
    || (spouseVisible === 1 && spouseScore <= 3 && nonSpouseVisible >= 2);

  const peerHeavyRaw = peerVisible >= 3 || (peerVisible >= 2 && peerScore >= 6);
  // 注意：nonSpouse 男女含义不同
  // 女命 nonSpouse=财 → 欲望/自我表达，可参与破格结构
  // 男命 nonSpouse=官杀 → 事业/压力/掌控，默认不参与破格结构
  const femaleWealthHeavy = gender === 'female' && spouseAbsent && nonSpouseVisible >= 2;
  const maleOfficerHeavy = gender === 'male' && nonSpouseVisible >= 2; // 仅事实，不作破格硬核
  const nonSpouseHeavy = femaleWealthHeavy; // 兼容旧名：仅女命财重夫虚算「非配偶成重破格」

  // 硬同源证据：只有这些能支撑 multi/残响成核；孤鸾/沐浴/红艳只是燃料
  const desireHard = multiPeach || dayIsPeach
    || (hasJiuChou && (dayIsPeach || multiPeach || dayIsMuYu));

  // 宫位结构锚按性别：
  // 男命：日支比劫/食伤本气才算破格宫位；日支官杀是事业宫象，不算破格锚
  // 女命：日支财/比劫本气算破格宫位；日支官杀是夫宫正象
  const palaceQueerBranch = gender === 'male'
    ? (dayBranchIsPeer || dayBranchIsOutput)
    : (dayBranchIsNonSpouse || dayBranchIsPeer || dayBranchIsOutput);
  const palaceStructAnchor = palaceQueerBranch || dayClashHeavy >= 1 || dayFanYin;
  // 宫位结构锚（弱）：空亡/墓绝，只作辅助
  const palaceStructSoft = dayIsKong || (dayCollapsed && (isCongPattern || isExtremeWeak));
  const palaceStructAny = palaceStructAnchor || palaceStructSoft;

  // 结构硬核（性别分流）
  // 女：伤官见官 / 财重夫虚+宫锚 / 从格 / 用神背离
  // 男：比劫夺财 / 比劫重妻虚 / 日支比劫+比劫透 / 从格 / 用神背离
  // 禁止：男命「官杀重妻虚」单独成硬结构
  const femaleStructInvert = gender === 'female'
    && spouseAbsent
    && nonSpouseVisible >= 2
    && palaceStructAnchor;
  const malePeerStruct = gender === 'male'
    && (spouseAbsent || spouseThin)
    && (
      malePeerRobWealth
      || (peerHeavyRaw && (spouseAbsent || spouseVisible === 0))
      || (dayBranchIsPeer && peerVisible >= 1 && spouseAbsent)
    );
  const structHard =
    femaleHurtOfficer
    || malePeerRobWealth
    || malePeerStruct
    || femaleStructInvert
    || (isCongPattern && (spouseVisible >= 1 || spouseScore >= 4 || peerVisible >= 1 || nonSpouseVisible >= 1 || dayCollapsed || palaceStructAny))
    || (spouseUsefulOpposed && isCongPattern)
    || (spouseUsefulOpposed && spouseThin && (peerVisible >= 1 || (gender === 'female' && nonSpouseVisible >= 1)))
    || (dayFuYin && spouseAbsent && peerVisible >= 2 && palaceStructAnchor);

  const peerHard = (peerHeavyRaw && (spouseAbsent || spouseThin))
    || (dayBranchIsPeer && peerVisible >= 2 && (spouseAbsent || spouseThin));

  // 软结构：十神对比有偏，只喂分数，不单独成 hard 同源
  // 男命官杀重只记软事实（事业压过妻星），不记破格 soft lit 的独立一维
  const structSoft = femaleWealthHeavy
    || (gender === 'female' && spouseThin && nonSpouseVisible >= 2)
    || (gender === 'female' && spouseHiddenOnly && nonSpouseVisible >= 2)
    || malePeerRobWealth
    || (peerVisible >= 2 && (spouseAbsent || spouseThin));

  const heteroFacts = [];
  const queerFacts = [];
  const supportFacts = [];


  // =========================
  // 维1：配偶质地
  // =========================
  const spouseWeights = [];
  if (spouseVisible >= 2) {
    spouseWeights.push(4.2);
    if (spouseScore >= 5) spouseWeights.push(1.6);
    if (dayBranchIsSpouse || dayBranchHasSpouse) spouseWeights.push(1.2);
  } else if (spouseVisible === 1) {
    spouseWeights.push(spousePatternAligned ? 3.2 : 2.5);
    if (spouseScore >= 4) spouseWeights.push(1.2);
    if (dayBranchIsSpouse || dayBranchHasSpouse) spouseWeights.push(0.9);
  } else if (spousePatternAligned && spouseHidden >= 1 && spouseScore >= 3) {
    spouseWeights.push(2.2, 0.7);
  } else if (spouseHiddenOnly) {
    spouseWeights.push(1.15);
  } else if (!spouseAbsent) {
    spouseWeights.push(clamp(spouseScore * 0.28, 0, 1.3));
  }

  if (spouseUsefulAligned && spouseVisible >= 1) spouseWeights.push(1.1);
  if (monthIsSpouse && spouseVisible >= 1) spouseWeights.push(0.75);
  if (hourIsSpouse && spouseVisible >= 1) spouseWeights.push(0.85);
  if (dayJinYu || hasJinYu) {
    spouseWeights.push(dayJinYu ? 0.95 : 0.45);
  }
  let spouseDim = clamp(softStack(spouseWeights), 0, 6.5);
  if (spouseUsefulOpposed && spouseVisible >= 1) {
    spouseDim = clamp(spouseDim * 0.72, 0, 6.5);
    supportFacts.push(gender === 'male' ? '用神层面财星偏忌，妻星成势也要打折。' : '用神层面官杀偏忌，夫星成势也要打折。');
  }
  if (!hasRoot && selfUnstable && spouseDim > 0) {
    spouseDim = clamp(spouseDim * (isCongPattern ? 0.55 : 0.75), 0, 6.5);
  }

  if (spouseDim >= 2.5 && selfStand >= 0.65) {
    heteroFacts.push(
      spouseVisible >= 2
        ? (gender === 'male'
          ? ('妻星（财星）多透：透干 ' + wealthVisible + '，合计 ' + wealthScore + '。')
          : ('夫星（官杀）多透：透干 ' + officerVisible + '，合计 ' + officerScore + '。'))
        : (gender === 'male' ? '妻星透干有气，传统异性缘有基础。' : '夫星透干有气，传统异性缘有基础。'),
    );
  } else if (spouseAbsent) {
    supportFacts.push(gender === 'male' ? '妻星偏虚，传统异性缘偏弱。' : '夫星偏虚，传统异性缘偏弱。');
  } else if (spouseHiddenOnly) {
    supportFacts.push(gender === 'male' ? '妻星只见藏干，异性缘有底气但未透清。' : '夫星只见藏干，异性缘有底气但未透清。');
  }

  if (selfStand < 0.65 && (spouseVisible >= 1 || spouseScore >= 4)) {
    heteroFacts.push(
      gender === 'male'
        ? ('虽见财星（透干 ' + wealthVisible + '，合计 ' + wealthScore + '），但日主' + (isCongPattern ? '从格' : '极弱') + '，配偶星要降权。')
        : ('虽见官杀（透干 ' + officerVisible + '，合计 ' + officerScore + '），但日主' + (isCongPattern ? '从格' : '极弱') + '，配偶星要降权。'),
    );
    supportFacts.push(
      isCongPattern
        ? ('格局为「' + (pattern || '从格') + '」，日主难自立。')
        : ('日主' + (strengthStatus || '偏弱') + '，正格异性缘难立。'),
    );
  }

  // =========================
  // 维2：正缘 / 格局同向
  // =========================
  const spouseEffPre = spouseDim * selfStand;
  const fateWeights = [];
  if (hasHongLuan) fateWeights.push(spousePresent || spouseEffPre >= 2 ? 1.7 : 0.45);
  if (hasTianXi) fateWeights.push(spousePresent || spouseEffPre >= 2 ? 1.35 : 0.35);
  if (spousePatternAligned && spouseEffPre >= 1.4) fateWeights.push(1.15);
  if (spouseUsefulAligned && spouseEffPre >= 1.4) fateWeights.push(0.9);
  if (hasJinYu || dayJinYu) {
    fateWeights.push((spousePresent || spouseEffPre >= 1.8) ? (dayJinYu ? 1.2 : 0.7) : 0.25);
  }
  if (dayHe >= 1 && dayClashHeavy === 0 && spouseEffPre >= 1.2) {
    fateWeights.push(0.85);
    supportFacts.push('日柱见合，夫妻宫有相合之象。');
  }
  const fateDim = softStack(fateWeights);

  if (hasHongLuanOrTianXi && (spousePresent || spouseEffPre >= 2)) {
    heteroFacts.push('见红鸾/天喜，与配偶星同向时正缘框架更稳。');
  } else if (hasHongLuanOrTianXi) {
    supportFacts.push('见红鸾/天喜，作常规叙事辅助。');
  }
  if (spousePatternAligned && spouseEffPre >= 1.4 && pattern) {
    heteroFacts.push('格局「' + pattern + '」与配偶星方向一致。');
  }

  // =========================
  // 维3：夫妻宫稳固 / 破损
  // =========================
  const palaceStableWeights = [];
  const palaceBreakWeights = [];

  if (dayBranchIsSpouse || dayBranchHasSpouse) {
    palaceStableWeights.push(dayBranchIsSpouse ? 2.0 : 1.1);
  }
  if (dayIsWang && !dayCollapsed) palaceStableWeights.push(0.7);
  if (dayZiZuoWang && !dayZiZuoCollapsed) palaceStableWeights.push(0.45);
  if (dayHe >= 1 && dayClashHeavy === 0) {
    palaceStableWeights.push(1.15 + Math.min(0.6, (dayHe - 1) * 0.3));
  }
  if (dayIsMuYu) palaceBreakWeights.push(1.4);
  if (dayCollapsed) {
    palaceBreakWeights.push(isCongPattern ? 2.0 : 1.5);
    if (isCongPattern || selfUnstable) {
      queerFacts.push('日柱处「' + dayStage + '」，夫妻宫气机收煞，正缘难按常例展开。');
    } else {
      supportFacts.push('日柱处「' + dayStage + '」，夫妻宫略收。');
    }
  } else if (dayWeakStage) {
    palaceBreakWeights.push(0.55);
  }
  if (dayZiZuoCollapsed && !dayCollapsed) {
    palaceBreakWeights.push(0.9);
    supportFacts.push('日主自坐「' + dayZiZuo + '」，夫妻宫气机偏收。');
  }
  if (dayClashHeavy >= 1) {
    palaceBreakWeights.push(1.3 + Math.min(1.2, (dayClashHeavy - 1) * 0.45));
    const clashText = dayRelList.filter((s) => /冲|刑/.test(String(s)) && !/合/.test(String(s))).slice(0, 2).join('；');
    queerFacts.push('夫妻宫逢刑冲（' + clashText + '），宫位不稳。');
  }
  if (dayClashSoft >= 1 && dayClashHeavy === 0) {
    palaceBreakWeights.push(0.7);
    supportFacts.push('夫妻宫见破害，稳定性略降。');
  }
  if (dayFanYin) {
    palaceBreakWeights.push(1.6);
    queerFacts.push('日柱见反吟（天克地冲类），婚姻宫波动大。');
  }
  if (dayFuYin || fuYinHeavy) {
    palaceBreakWeights.push(dayFuYin ? 1.45 : 0.85);
    queerFacts.push(dayFuYin
      ? '日柱见伏吟，婚姻宫易自困、反复，正缘难顺展。'
      : '盘中伏吟偏重，情缘主线易缠滞。');
  }
  if (dayIsKong) {
    palaceBreakWeights.push(1.2);
    supportFacts.push('日支落空亡，夫妻宫象虚。');
  }
  if (dayBranchIsPeer) {
    palaceBreakWeights.push(1.35);
    queerFacts.push('日支本气为比劫，夫妻宫更偏同类并立。');
  } else if (dayBranchIsNonSpouse) {
    if (gender === 'female') {
      palaceBreakWeights.push(1.15);
      supportFacts.push('日支本气偏财，夫宫气机易被欲望结构占位。');
    } else {
      // 男命日支官杀：事业/压力象，轻微影响宫稳，不按破格写 queer
      palaceBreakWeights.push(0.45);
      supportFacts.push('日支本气偏官杀，妻宫气机略被事业主导结构占位。');
    }
  } else if (dayBranchIsOutput) {
    palaceBreakWeights.push(gender === 'male' ? 1.0 : 0.85);
    if (gender === 'male') supportFacts.push('日支本气偏食伤，妻宫表达外放、正缘象略散。');
  }
  if (dayYangRen) {
    palaceBreakWeights.push(0.95);
    supportFacts.push('日柱见羊刃/飞刃，夫妻宫锋利，关系易起冲突。');
  }

  const palaceStable = clamp(softStack(palaceStableWeights), 0, 3.5);
  const palaceBreak = clamp(softStack(palaceBreakWeights), 0, 5.5);

  // 异性轴
  const spouseEff = spouseDim * selfStand;
  const palaceHeteroMod = 1 - clamp(palaceBreak / 8.5, 0, 0.42) + clamp(palaceStable / 10, 0, 0.12);
  const fateBoost = fateDim * (0.4 + 0.6 * clamp(spouseEff / 3.5, 0, 1));
  const heteroAxis = clamp((spouseEff + fateBoost) * palaceHeteroMod, 0, 10);


  // =========================
  // 维4：日宫欲望同源
  // =========================
  const desireWeights = [];
  if (multiPeach) {
    desireWeights.push(dayIsPeach ? 4.3 : 3.5);
    const places = peachPillars.map((k) => PILLAR_LABEL[k]).join('、');
    queerFacts.push('真桃花落在' + places + '柱（共 ' + totalPeachCount + ' 处），欲望结构活跃。');
  } else if (dayIsPeach) {
    desireWeights.push(2.5);
    queerFacts.push('日柱见真桃花，夫妻宫带欲望波动。');
  } else if (totalPeachCount === 1) {
    desireWeights.push(1.05);
    supportFacts.push('另有' + PILLAR_LABEL[peachPillars[0]] + '柱桃花，作辅助波动。');
  }
  if (hasHongYan) {
    // 红艳无真桃花时只作软燃料，不可单独成核
    desireWeights.push(dayIsPeach || multiPeach ? 1.35 : hasGuLuan || dayIsMuYu ? 1.05 : 1.55);
    queerFacts.push('见红艳煞，情欲表达更直、更易越界常例。');
  }
  if (dayIsMuYu) {
    desireWeights.push(dayIsPeach || multiPeach ? 1.35 : hasHongYan || hasGuLuan ? 1.2 : 1.7);
    queerFacts.push('日柱处「沐浴」，色欲与情感敏感度升高。');
  }
  if (hasGuLuan) {
    desireWeights.push(dayIsPeach || multiPeach ? 1.3 : dayIsMuYu || hasHongYan ? 1.05 : 1.65);
    queerFacts.push('见孤鸾煞，感情路径更易偏离常例。');
  }
  if (dayHuaGai || hasHuaGai) {
    desireWeights.push(dayHuaGai ? (isCongPattern || selfUnstable ? 1.4 : 1.0) : 0.55);
    if (dayHuaGai && (isCongPattern || selfUnstable || multiPeach || hasGuLuan)) {
      queerFacts.push('日柱见华盖，情欲更易走孤清/非常规路径。');
    } else if (hasHuaGai) {
      supportFacts.push('盘中见华盖，情志略偏孤清。');
    }
  }
  if (hasGuaSu) {
    desireWeights.push(0.85);
    supportFacts.push('见寡宿/孤辰，情缘上略孤清。');
  }
  if (hasGuXu && !hasGuaSu) {
    desireWeights.push(0.45);
  }
  if (hasTongZi) {
    desireWeights.push(0.5);
  }
  if (hasJiuChou) {
    desireWeights.push(dayIsPeach || multiPeach || dayIsMuYu ? 1.55 : 0.95);
    queerFacts.push('见九丑，情欲结构更易偏离常例。');
  }
  if (hasYinYangSha) {
    desireWeights.push(dayIsPeach || multiPeach || hasGuLuan ? 1.15 : 0.7);
    supportFacts.push('见阴阳煞，情缘象略偏非常轨。');
  }
  if (hasLiuXia) {
    desireWeights.push(hasHongYan || dayIsPeach ? 0.9 : 0.55);
  }
  if (hasXueRen && (dayIsPeach || hasHongYan || dayIsMuYu)) {
    desireWeights.push(0.65);
  }
  if (dayCollapsed && !dayIsMuYu) {
    desireWeights.push(isCongPattern ? 1.25 : selfUnstable ? 0.9 : 0.4);
  }
  if (hasBaZhuan) {
    // 八专：传统非常轨/私情象，无真桃花时只作软燃料
    desireWeights.push(dayBaZhuan
      ? (dayIsPeach || multiPeach ? 1.4 : 1.15)
      : (dayIsPeach || multiPeach ? 0.85 : 0.55));
    if (dayBaZhuan || (hasBaZhuan && (hasGuLuan || hasHongYan || dayIsMuYu))) {
      queerFacts.push('见八专，情缘象更易偏离常例。');
    } else {
      supportFacts.push('盘中见八专，情缘象略偏非常轨。');
    }
  }

  let desireDim = clamp(softStack(desireWeights), 0, 7);
  // 无真桃花/九丑硬核时，软燃料（孤鸾红艳华盖沐浴等）同维饱和封顶，防堆叠伪核
  const softDesireOnly = !desireHard && !isCongPattern;
  if (softDesireOnly) {
    desireDim = Math.min(desireDim, 1.95);
  }

  // =========================
  // 维5：结构倒置
  // =========================
  const structWeights = [];

  // 配偶空：基础虚位分（男女同）
  if (spouseAbsent) {
    structWeights.push(0.55);
  } else if (spouseHiddenOnly) {
    structWeights.push(0.35);
  }

  // 女命：财重夫虚 = 欲望结构倒置（破格相关）
  if (gender === 'female') {
    if (spouseAbsent && nonSpouseVisible >= 2) {
      structWeights.push(2.85 + Math.min(1.1, (nonSpouseVisible - 2) * 0.45));
      queerFacts.push('财星明显透出而夫星近乎全虚，气机更偏自我欲望表达。');
    } else if (spouseAbsent && nonSpouseVisible === 1) {
      structWeights.push(1.15);
      supportFacts.push('财星有透而夫星偏虚，结构略偏。');
    } else if (spouseHiddenOnly && nonSpouseVisible >= 2) {
      structWeights.push(1.55);
      supportFacts.push('夫星只藏而财星外透，结构略不稳。');
    } else if (spouseThin && nonSpouseVisible >= 2) {
      structWeights.push(1.25);
      supportFacts.push('夫星气偏薄而财星成势，结构略倒置。');
    }
  } else {
    // 男命：官杀重妻虚 = 事业/压力占位，只给很轻的结构分，不写破格 queer 文案
    if (spouseAbsent && nonSpouseVisible >= 2) {
      structWeights.push(0.75);
      supportFacts.push('官杀明显而妻星偏虚，更偏事业压力占位，不直接等于情感破格。');
    } else if (spouseAbsent && nonSpouseVisible === 1) {
      structWeights.push(0.4);
    } else if (spouseThin && nonSpouseVisible >= 2) {
      structWeights.push(0.45);
    }
    // 男命真正的结构倒置：比劫/食伤压过妻星
    if (peerVisible >= 2 && (spouseAbsent || spouseThin)) {
      structWeights.push(1.4 + Math.min(0.8, (peerVisible - 2) * 0.35));
      if (spouseAbsent && peerVisible >= 2) {
        supportFacts.push('比劫有透而妻星偏虚，同类/自我结构抬升。');
      }
    }
  }

  if (femaleHurtOfficer) {
    structWeights.push(2.1);
    queerFacts.push('伤官见官，传统夫星结构被反制，情感关系易偏非常轨。');
  } else if (femaleOutputOverOfficer) {
    structWeights.push(1.35);
    supportFacts.push('食伤明显压过官杀，夫星难当令。');
  }
  if (malePeerRobWealth) {
    structWeights.push(1.9);
    queerFacts.push('比劫夺财明显，妻星难稳，情感更易走向自我/同类。');
  } else if (maleOutputOverWealth) {
    structWeights.push(1.2);
    supportFacts.push('食伤显而财星弱，妻星结构偏虚。');
  }

  if (spouseUsefulOpposed && (spouseVisible >= 1 || spouseScore >= 3)) {
    structWeights.push(selfUnstable ? 1.5 : 1.05);
    supportFacts.push('用神不喜配偶星，正缘主线容易让位。');
  }
  const nonSpouseFavor = nonSpouseNames.filter((n) => favorableGods.includes(n)).length;
  const peerFavor = ['比肩', '劫财'].filter((n) => favorableGods.includes(n)).length;
  // 用神背离：女命喜财/比劫，男命喜比劫（喜官杀不算破格用神）
  const usefulQueerFavor = gender === 'female'
    ? (nonSpouseFavor >= 1 || peerFavor >= 1)
    : (peerFavor >= 1);
  if (spouseUsefulOpposed && usefulQueerFavor && spouseVisible <= 1) {
    structWeights.push(1.35);
    queerFacts.push(
      gender === 'male'
        ? '用神背离妻星而喜比劫，情感结构更易走向自我/同类。'
        : '用神背离夫星而喜财/比劫，情感结构更易倒置。',
    );
  }
  // 时柱：女命时透财+夫虚可抬；男命时透官杀不抬破格，时透比劫才抬
  if (gender === 'female' && hourIsNonSpouse && (spouseAbsent || spouseThin)) {
    structWeights.push(0.95);
    supportFacts.push('时柱透财而夫星偏虚，终点缘分易偏欲望结构。');
  } else if (gender === 'male' && hourIsPeer && (spouseAbsent || spouseThin)) {
    structWeights.push(0.95);
    supportFacts.push('时柱透比劫而妻星偏虚，终点缘分易偏同类并立。');
  }
  if (dayFuYin && spouseAbsent && (peerVisible >= 1 || (gender === 'female' && nonSpouseVisible >= 1))) {
    structWeights.push(0.85);
  } else if (fuYinHeavy && spouseThin) {
    structWeights.push(0.4);
  }
  if (dayYangRen && spouseThin) {
    structWeights.push(0.55);
  }

  if (isCongPattern) {
    if (spouseVisible >= 2 || (spouseVisible >= 1 && spouseScore >= 5)) {
      structWeights.push(2.6);
      queerFacts.push(
        gender === 'male'
          ? '从格下财星虽成势，日主难自立承接，妻星更像外势而非正缘。'
          : '从格下官杀虽成势，日主难自立承接，夫星更像外势而非正缘。',
      );
    } else if (spouseVisible >= 1 || spouseScore >= 4) {
      structWeights.push(1.75);
      supportFacts.push('从格下配偶星有气但难内化。');
    } else {
      structWeights.push(1.05);
    }
    if (spouseVisible >= 1 && nonSpouseVisible >= 1) {
      structWeights.push(1.4);
      queerFacts.push('从势格局里多股外势并行，情感结构更易偏离单线异性缘。');
    }
    if (dayCollapsed || dayFanYin || dayClashHeavy >= 1) {
      structWeights.push(1.0);
    }
    // 从财/从儿：女命欲望外势、男命妻星外势更明显
    if (isCongCai) {
      structWeights.push(gender === 'female' ? 1.25 : 0.85);
      if (gender === 'female') queerFacts.push('从财格下财星成势而日主从之，欲望结构易压过夫星正缘。');
      else supportFacts.push('从财格下妻星成外势，正缘承接依赖从势是否稳定。');
    }
    if (isCongEr) {
      structWeights.push(1.1);
      supportFacts.push('从儿/食伤格下表达与欲望外放，传统配偶星难当令。');
    }
    if (isCongSha && gender === 'female') {
      structWeights.push(0.7);
      supportFacts.push('从杀/从官下夫星成外势，需看日主是否真能从。');
    }
  } else if (selfUnstable) {
    // 极弱非从格：不自动记硬结构；仅配偶空+对方十神时才抬
    if (spouseAbsent && nonSpouseVisible >= 1) {
      structWeights.push(1.0);
    } else if (!spouseOnChart) {
      structWeights.push(0.45);
    }
    if (dayCollapsed && spouseAbsent && nonSpouseVisible >= 1) {
      structWeights.push(1.15);
      supportFacts.push('日主极弱且夫妻宫收煞，结构略不稳。');
    }
  }

  // 宫位破损可喂结构，但从格/硬空转才给足量；软欲望盘减半，防伪结构点亮
  if (palaceBreak >= 2.2) {
    const palaceToStruct = Math.min(1.6, palaceBreak * 0.35);
    structWeights.push(isCongPattern || structHard ? palaceToStruct : palaceToStruct * 0.45);
  }

  const structDim = clamp(softStack(structWeights), 0, 6.5);

  // =========================
  // 维6：同类牵引
  // =========================
  const peerWeights = [];
  if (peerHeavyRaw && spouseAbsent) {
    peerWeights.push(3.9);
    queerFacts.push('比劫成重（透干 ' + peerVisible + '，合计 ' + peerScore + '）且配偶近乎全虚，对同类牵引强。');
  } else if (peerHeavyRaw && spouseThin) {
    peerWeights.push(2.4);
    queerFacts.push('比劫成重（透干 ' + peerVisible + '）而配偶气薄，同类牵引明显。');
  } else if (peerHeavyRaw) {
    peerWeights.push(1.05);
    supportFacts.push('比劫偏重（透干 ' + peerVisible + '），但配偶星仍在，更偏个性。');
  } else if (peerVisible >= 2 && (spouseAbsent || spouseThin)) {
    peerWeights.push(1.65);
    supportFacts.push('比劫有透且配偶偏虚，同类牵引作辅助。');
  } else if (peerVisible >= 1 && spouseAbsent) {
    peerWeights.push(0.75);
  }
  if ((spouseAbsent || spouseThin) && peerHidden >= 3 && peerVisible <= 1) {
    peerWeights.push(0.85);
  }
  if (dayBranchIsPeer && peerVisible >= 1) {
    peerWeights.push(0.9);
  }
  if (hourIsPeer && (spouseAbsent || spouseThin)) {
    peerWeights.push(1.15);
    supportFacts.push('时柱透比劫且配偶偏虚，同类牵引延伸到终点。');
  } else if (hourIsPeer) {
    peerWeights.push(0.45);
  }
  if (hasYiMa && peerVisible >= 2 && (spouseAbsent || spouseThin)) {
    peerWeights.push(0.7);
  }
  const peerDim = clamp(softStack(peerWeights), 0, 5.8);

  // =========================
  // 跨维协同
  // =========================
  const dDesire = desireDim;
  const dStruct = structDim;
  const dPeer = peerDim;
  const dPalace = palaceBreak;

  const litDesire = dDesire >= 1.7;
  const litStruct = dStruct >= 1.7;
  const litPeer = dPeer >= 1.7;
  const litPalace = dPalace >= 1.9;
  const litCount = [litDesire, litStruct, litPeer].filter(Boolean).length
    + (litPalace && !litStruct ? 0.5 : 0)
    + (litPalace && litStruct ? 0.25 : 0);

  let synergy = 0;
  const pairBoost = (a, b, rate, need = 1.55) => {
    if (a >= need && b >= need) return Math.sqrt(a * b) * rate;
    if ((a >= need && b >= 0.95) || (b >= need && a >= 0.95)) return Math.min(a, b) * rate * 0.24;
    return 0;
  };
  synergy += pairBoost(dDesire, dStruct, 0.44);
  synergy += pairBoost(dDesire, dPeer, 0.4);
  synergy += pairBoost(dStruct, dPeer, 0.5);
  synergy += pairBoost(dDesire, dPalace, 0.32);
  synergy += pairBoost(dStruct, dPalace, 0.36);
  synergy += pairBoost(dPeer, dPalace, 0.28);

  // 同源连续场：多维同时中等偏强时给连续协同，避免「只靠硬 if 拼接」
  // 配偶空/薄作调制：空位越高，同源场越像「破格共振」而非孤立信号
  const spouseVoidMod = spouseAbsent ? 1.0 : (spouseThin ? 0.72 : 0.42);
  const homoField = Math.sqrt(
    Math.max(dDesire, 0.05)
    * Math.max(dStruct, 0.05)
    * Math.max(Math.max(dPeer, 0.08) + Math.max(dPalace, 0.08) * 0.55, 0.08),
  );
  if (homoField >= 1.15 && (litDesire || litStruct || litPeer || litPalace)) {
    synergy += Math.min(1.65, (homoField - 1.0) * 0.85 * spouseVoidMod);
  }
  // 真欲望×宫破 / 硬结构×同类 的专项同源加成（非软燃料）
  if (desireHard && dPalace >= 1.6) {
    synergy += Math.min(0.85, Math.sqrt(dDesire * Math.max(dPalace, 0.5)) * 0.22);
  }
  if ((structHard || peerHard) && (litDesire || litPalace) && (spouseAbsent || spouseThin)) {
    synergy += 0.35;
  }

  const coreLits = [litDesire, litStruct, litPeer].filter(Boolean).length;
  if (coreLits >= 3) {
    synergy += Math.cbrt(Math.max(dDesire, 0.1) * Math.max(dStruct, 0.1) * Math.max(dPeer, 0.1)) * 0.55;
    queerFacts.push('日宫欲望、结构倒置与同类牵引同时抬头，破格信号形成配合。');
  } else if (coreLits === 2) {
    const names = [];
    if (litDesire) names.push('日宫欲望');
    if (litStruct) names.push('结构倒置');
    if (litPeer) names.push('同类牵引');
    queerFacts.push(names.join('与') + '互相配合，破格倾向被放大。');
  } else if (coreLits === 1 && litPalace) {
    queerFacts.push('主破格维与夫妻宫破损互相配合，非常轨倾向被放大。');
  } else if (homoField >= 1.6 && spouseVoidMod >= 0.7) {
    queerFacts.push('多维破格信号呈同源连续场，非常轨倾向由配合放大而非单点堆砌。');
  }

  let polarityMul = 1;
  if (gender === 'male' && dayMasterYin && (coreLits + (litPalace ? 1 : 0)) >= 1) {
    polarityMul = 1.07;
    supportFacts.push('男命日主偏阴，使已有破格配合略增重。');
  } else if (gender === 'female' && dayMasterYang && (coreLits + (litPalace ? 1 : 0)) >= 1) {
    polarityMul = 1.07;
    supportFacts.push('女命日主偏阳，使已有破格配合略增重。');
  }

  const breakBase = dDesire * 1.0 + dStruct * 0.95 + dPeer * 1.05 + dPalace * 0.55;
  const queerAxis = clamp((breakBase + synergy) * polarityMul, 0, 14);

  const coverage = coreLits
    + (litPalace ? 0.5 : 0)
    + (dDesire >= 3.0 || dPeer >= 3.0 || dStruct >= 3.0 ? 0.5 : 0);

  // =========================
  // 成核
  // =========================
  const heteroCore = selfStand >= 0.65
    && spouseEff >= 1.9
    && heteroAxis >= 2.8
    && palaceBreak < 4.2;

  // ---- 同源成链：每条链必须跨至少两维，且第二维不能只是软神煞燃料 ----
  const softFuelPresent = hasHongYan || hasGuLuan || hasHuaGai || dayIsMuYu
    || hasGuaSu || hasJiuChou || hasYinYangSha || hasLiuXia || hasBaZhuan;
  // 倒置第二维锚：真欲望/同类/刑冲反吟/从格/伤官见官/比劫夺财/用神背离/宫位结构锚
  // 明确排除「仅软燃料抬欲望」
  const invertSecondAnchor = desireHard
    || peerHard || litPeer
    || femaleHurtOfficer || malePeerRobWealth
    || isCongPattern
    || dayClashHeavy >= 1 || dayFanYin
    || (spouseUsefulOpposed && (nonSpouseFavor >= 1 || peerFavor >= 1 || nonSpouseVisible >= 1))
    || (palaceStructAnchor && dPalace >= 2.0);

  // 真桃花多现：要求欲望够分 + 第二维（宫破/结构/同类/配偶空薄/软燃料共振）配合
  // 禁止「只见两处桃花标签」硬翻案；多维同源才成核
  const peachSecondAnchor = dPalace >= 1.6
    || litStruct || litPeer || litPalace
    || spouseAbsent || spouseThin
    || structHard || peerHard || isCongPattern
    || dayClashHeavy >= 1 || dayFanYin || dayFuYin
    || softFuelPresent
    || (gender === 'female' && nonSpouseVisible >= 1)
    || (gender === 'male' && peerVisible >= 1);
  const chainMultiPeach = multiPeach && dDesire >= 2.8 && peachSecondAnchor;
  // 日支真桃花 + 多维配合：单柱桃花也可成核，但必须有结构/宫/同类/配偶空之一
  const chainDayPeach = dayIsPeach
    && dDesire >= 2.6
    && !multiPeach
    && (
      dPalace >= 1.8
      || litStruct
      || litPeer
      || structHard
      || peerHard
      || isCongPattern
      || (spouseAbsent && (litPalace || dayClashHeavy >= 1 || dayFanYin || (softFuelPresent && dPalace >= 1.2)))
      || (spouseThin && (structSoft || litPalace || dayClashHeavy >= 1) && dPalace >= 1.2)
    )
    && spouseEff < 2.8
    && !(spouseStrong && heteroAxis >= 3.5);
  const chainPeerSpouseVoid = peerHeavyRaw && (spouseAbsent || spouseThin) && dPeer >= 2.8;
  // 结构倒置链：非配偶成重 + 结构够分 + 第二维硬锚（禁止软燃料单独闭合）
  const chainInvert = nonSpouseHeavy
    && dStruct >= 3.0
    && invertSecondAnchor
    && spouseEff < 2.2
    && (desireHard
      || litPeer
      || femaleHurtOfficer
      || malePeerRobWealth
      || isCongPattern
      || dayClashHeavy >= 1
      || dayFanYin
      || spouseUsefulOpposed
      || (palaceStructAnchor && dPalace >= 2.0));
  const chainHurtSpouse = (femaleHurtOfficer || malePeerRobWealth)
    && dStruct >= 2.4
    && (desireHard || litPeer || spouseThin || spouseAbsent || dPalace >= 1.8);
  const chainCongCollapse = isCongPattern
    && dStruct >= 2.6
    && (dDesire >= 1.3 || dPalace >= 1.8 || (spouseVisible >= 1 && nonSpouseVisible >= 1) || palaceStructAnchor)
    && spouseEff < 2.3;
  // 宫破+欲望：必须有刑冲/反吟/从格/硬欲望/硬结构；软燃料欲望不得顶替 desireHard
  const chainPalaceDesire = dPalace >= 2.4
    && (desireHard ? dDesire >= 2.0 : dDesire >= 2.4)
    && spouseEff < 2.3
    && (spouseThin || spouseAbsent || isCongPattern)
    && (desireHard || structHard || peerHard || isCongPattern || dayClashHeavy >= 1 || dayFanYin)
    && (desireHard || isCongPattern || structHard || dayClashHeavy >= 1 || dayFanYin);
  // 伏吟/反吟+欲望：禁止「日时伏吟+孤鸾红艳」单独翻案；非配偶重也需宫位锚或硬欲望
  const chainFuYinDesire = (dayFuYin || dayFanYin)
    && dPalace >= 2.3
    && (desireHard ? dDesire >= 2.0 : false) // 无真欲望时伏吟链不靠软燃料闭合
    && spouseEff < 2.0
    && (spouseAbsent || spouseThin)
    && (desireHard || structHard || peerHard || isCongPattern)
    && (desireHard || palaceStructAnchor || peerHard || isCongPattern);
  const chainUsefulInvert = spouseUsefulOpposed
    && dStruct >= 2.4
    && spouseEff < 2.6
    && (
      gender === 'female'
        ? (nonSpouseVisible >= 1 || peerVisible >= 1 || litPeer)
        : (peerVisible >= 1 || litPeer || malePeerRobWealth)
    )
    && (
      desireHard || litPeer || peerHard || malePeerRobWealth
      || (gender === 'female' && (nonSpouseHeavy || dPalace >= 1.8 || palaceStructAnchor))
      || (gender === 'male' && (dPalace >= 1.8 || palaceStructAnchor || peerVisible >= 2))
    );
  const chainPalacePeer = dayBranchIsPeer
    && peerVisible >= 1
    && (spouseAbsent || spouseThin)
    && dPeer + dPalace >= 3.2
    && spouseEff < 2.5;
  // 女命财重夫虚 + 食伤/宫破/用神背离配合：欲望结构与夫星空转同源
  // 必须有宫位锚或真欲望/用神背离，禁止「只见财多官少」单独成核
  const chainFemaleWealth = gender === 'female'
    && nonSpouseHeavy
    && dStruct >= 3.0
    && spouseEff < 1.8
    && (outputVisible >= 1 || desireHard || litPeer)
    && (desireHard || spouseUsefulOpposed || dayClashHeavy >= 1 || dayFanYin
      || (palaceStructAnchor && dPalace >= 2.2) || (outputVisible >= 2 && palaceStructAnchor));
  // 女命食伤压官 + 夫星虚：伤官见官的轻量跨维版（无官透时靠食伤+财）
  const chainFemaleOutput = gender === 'female'
    && (femaleHurtOfficer || femaleOutputOverOfficer)
    && (spouseAbsent || spouseThin)
    && dStruct >= 2.5
    && spouseEff < 2.2
    && (desireHard || litPeer || nonSpouseVisible >= 1 || palaceStructAnchor || dayClashHeavy >= 1 || dayFanYin);
  // 男命日支比劫/食伤 + 时透比劫 + 妻虚：宫位与终点同类并立
  const chainMalePeerLine = gender === 'male'
    && (spouseAbsent || spouseThin)
    && (dayBranchIsPeer || dayBranchIsOutput || hourIsPeer)
    && peerVisible >= 1
    && dPeer + dPalace >= 3.0
    && spouseEff < 2.2
    && (peerHard || litPeer || malePeerRobWealth || dayBranchIsPeer || (hourIsPeer && peerVisible >= 2));
  // 女命同类牵引链：比劫重 + 夫星空薄 + 宫/结构/欲望第二维（与男命 malePeerLine 对称）
  const chainFemalePeer = gender === 'female'
    && (spouseAbsent || spouseThin)
    && peerVisible >= 2
    && dPeer >= 2.0
    && spouseEff < 2.2
    && (litStruct || structHard || dPalace >= 1.8 || litPalace || desireHard || dayBranchIsPeer || dayClashHeavy >= 1 || dayFanYin);
  // 从财/从儿特殊链：从势 + 配偶难内化 + 第二维
  const chainCongSpecial = isCongPattern
    && (isCongCai || isCongEr || (isCongSha && gender === 'female'))
    && dStruct >= 2.8
    && spouseEff < 2.2
    && (dDesire >= 1.2 || dPalace >= 1.6 || peerVisible >= 1 || nonSpouseVisible >= 1 || palaceStructAnchor);

  const singleStrong = chainMultiPeach
    || chainDayPeach
    || chainPeerSpouseVoid
    || chainInvert
    || chainHurtSpouse
    || chainCongCollapse
    || chainPalaceDesire
    || chainFuYinDesire
    || chainUsefulInvert
    || chainPalacePeer
    || chainFemaleWealth
    || chainFemaleOutput
    || chainMalePeerLine
    || chainFemalePeer
    || chainCongSpecial;

  // 硬同源锚：真欲望/硬结构/硬同类/从格/已闭合硬单链
  // 注意：chainInvert 已要求第二维硬锚，可计入；纯软燃料不算
  const hardHomology = desireHard || structHard || peerHard || isCongPattern
    || chainMultiPeach || chainDayPeach || chainPeerSpouseVoid || chainInvert
    || chainHurtSpouse || chainCongCollapse
    || chainUsefulInvert || chainPalacePeer
    || chainFemaleWealth || chainFemaleOutput || chainMalePeerLine || chainFemalePeer || chainCongSpecial
    || ((chainPalaceDesire || chainFuYinDesire) && (desireHard || structHard || peerHard || isCongPattern));

  // multi 的硬锚：至少一条「真」证据，禁止 softFuel×structSoft 伪 multi
  const multiHardAnchor = desireHard || peerHard || isCongPattern
    || femaleHurtOfficer || malePeerRobWealth
    || structHard
    || spouseUsefulOpposed
    || ((dayClashHeavy >= 1 || dayFanYin) && (structSoft || spouseAbsent || spouseThin || litPeer || desireHard))
    || chainMultiPeach || chainDayPeach || chainPeerSpouseVoid || chainHurtSpouse
    || chainCongCollapse || chainUsefulInvert || chainPalacePeer
    || chainInvert || chainFemaleWealth || chainFemaleOutput || chainMalePeerLine || chainFemalePeer || chainCongSpecial;

  // 极弱非从格 + 盘面配偶成势：禁止仅靠软欲望×软结构翻案
  const softOnlyBlocked = (
    (isExtremeWeak && !isCongPattern && spouseOnChart
      && !desireHard && !peerHard && !structHard
      && !(dayCollapsed && spouseAbsent))
    // 正格可立 + 仅软燃料 + 无硬结构/同类/从格：禁止 multi 伪核
    || (!isCongPattern && softDesireOnly && softFuelPresent && !structHard && !peerHard
      && !femaleHurtOfficer && !malePeerRobWealth && !spouseUsefulOpposed
      && dayClashHeavy === 0 && !dayFanYin)
  );

  // 仅靠伏吟/宫欲软链、且无硬同源时，不成核
  const softChainOnly = singleStrong
    && !chainMultiPeach && !chainDayPeach && !chainPeerSpouseVoid && !chainInvert
    && !chainHurtSpouse && !chainCongCollapse && !chainUsefulInvert && !chainPalacePeer
    && !chainFemaleWealth && !chainFemaleOutput && !chainMalePeerLine && !chainFemalePeer && !chainCongSpecial
    && (chainPalaceDesire || chainFuYinDesire)
    && !desireHard && !structHard && !peerHard && !isCongPattern;

  // multi 计维：软欲望 lit 不计入独立一维（无 desireHard 时）
  // 宫位破损在硬锚下可计 0.75 维，形成「欲望/结构/宫」三源配合，而非硬拼标签
  const multiDesireLit = desireHard && dDesire >= 1.7;
  const multiStructLit = dStruct >= 1.7 && (structHard || isCongPattern || femaleHurtOfficer || malePeerRobWealth || spouseUsefulOpposed || (structSoft && (spouseAbsent || spouseThin) && dStruct >= 2.2));
  // 同类 lit：重比劫 / 日支比劫 / 「维分够 + 有透 + 配偶空薄或结构硬」 都可计
  // 避免 peer 分高却因未达 peerHeavyRaw 被整维抹掉（结构×同类×宫 无法同源）
  const multiPeerLit = dPeer >= 1.7 && (
    peerHard
    || peerHeavyRaw
    || peerVisible >= 2
    || (dayBranchIsPeer && peerVisible >= 1 && (spouseAbsent || spouseThin))
    || (peerVisible >= 1 && dPeer >= 2.0 && (spouseAbsent || spouseThin || structHard || dayBranchIsPeer))
  );
  const multiPalaceLit = dPalace >= 1.9 && (
    dayClashHeavy >= 1 || dayFanYin || dayBranchIsPeer || dayIsKong || isCongPattern
    || palaceStructAnchor || dayFuYin || (dayCollapsed && (spouseAbsent || spouseThin))
  );
  const multiCoreLits = [multiDesireLit, multiStructLit, multiPeerLit].filter(Boolean).length
    + (multiPalaceLit ? (desireHard || structHard || peerHard || isCongPattern ? 0.75 : 0.5) : 0);

  // 同源共振场成核：硬锚 + 多维连续场 + 配偶空位
  // 必须至少两条「真」计维（或 欲望硬+宫 且结构/同类有中等气），禁止刑冲单独冒充多维
  const homologyHardCore = desireHard || structHard || peerHard || isCongPattern
    || femaleHurtOfficer || malePeerRobWealth;
  // 结构硬 + 宫 lit + 同类/欲望中等：1.75 维即可，因已是三源同源而非单点
  const homologyLitsOk = multiCoreLits >= 2
    || (multiCoreLits >= 1.75 && multiStructLit && multiPalaceLit && (multiPeerLit || multiDesireLit || dPeer >= 1.7 || dDesire >= 1.5));
  const chainHomologyField = !softOnlyBlocked
    && multiHardAnchor
    && homologyHardCore
    && (spouseAbsent || spouseThin || isCongPattern || spouseUsefulOpposed)
    && homologyLitsOk
    && coverage >= 2
    && homoField >= 1.65
    && synergy >= 0.85
    && queerAxis >= Math.max(4.4, heteroAxis + 1.1)
    && !(softDesireOnly && !desireHard && !structHard && !peerHard)
    && !chainMultiPeach && !chainDayPeach && !chainPeerSpouseVoid && !chainInvert
    && !chainHurtSpouse && !chainCongCollapse && !chainPalaceDesire && !chainFuYinDesire
    && !chainUsefulInvert && !chainPalacePeer
    && !chainFemaleWealth && !chainFemaleOutput && !chainMalePeerLine && !chainFemalePeer && !chainCongSpecial;

  const relativeQueerLead = queerAxis - heteroAxis;
  const multiSupport = !softOnlyBlocked
    && hardHomology
    && multiHardAnchor
    && (
      multiCoreLits >= 2
      || (multiCoreLits >= 1.75 && multiStructLit && multiPalaceLit && (multiPeerLit || dPeer >= 1.7))
    )
    && coverage >= 2
    && queerAxis >= Math.max(4.2, heteroAxis + 1.1)
    && synergy >= 0.55;
  // multi 弱成核：1.5 维仅限「真欲望 + 宫破」且配偶空薄；其余仍要满 2 维
  const multiSoft = !softOnlyBlocked
    && hardHomology
    && multiHardAnchor
    && coverage >= 1.5
    && queerAxis >= Math.max(3.8, heteroAxis * 0.95 + 0.8)
    && synergy >= 0.8
    && (
      multiCoreLits >= 2
      || (desireHard && multiPalaceLit && multiCoreLits >= 1.5
        && (spouseAbsent || spouseThin || dStruct >= 1.6)
        && queerAxis >= Math.max(5.0, heteroAxis + 1.4))
    )
    && (dStruct >= 1.8 || dPeer >= 1.8 || desireHard || isCongPattern || peerHard);

  const queerCore = (singleStrong && !softChainOnly && !softOnlyBlocked)
    || chainHomologyField
    || multiSupport
    || multiSoft;

  let heteroScore = Math.round(heteroAxis * 10) / 10;
  let queerScore = Math.round(queerAxis * 10) / 10;

  // =========================
  // 终判
  // =========================
  let orientation = 'straight';
  const axisGap = queerAxis - heteroAxis;

  if (queerCore && heteroCore) {
    if (spouseStrong && !singleStrong && axisGap < 0.9) {
      orientation = 'straight';
    } else if (axisGap >= 1.8 && (!spouseStrong || singleStrong)) {
      orientation = spouseStrong && heteroAxis >= 4.0 && axisGap < 3.2 ? 'bi' : 'gay';
    } else if (heteroAxis - queerAxis >= 1.8 && spouseStrong && !singleStrong) {
      orientation = 'straight';
    } else if (heteroAxis >= 3.2 && queerAxis >= 3.2) {
      orientation = 'bi';
    } else if (axisGap > 0.6) {
      orientation = 'gay';
    } else {
      orientation = 'straight';
    }
  } else if (queerCore && !heteroCore) {
    orientation = 'gay';
  } else if (!queerCore && heteroCore) {
    orientation = 'straight';
  } else {
    // 两核皆无：只认已闭合单链残响，或「真硬锚 + 多维覆盖」；禁止软燃料堆轴分翻案
    if (((singleStrong && !softChainOnly) || chainHomologyField) && !softOnlyBlocked && axisGap >= 0.8 && queerAxis >= 3.5) {
      orientation = 'gay';
    } else if (
      !softOnlyBlocked
      && multiHardAnchor
      && (desireHard || peerHard || isCongPattern || femaleHurtOfficer || malePeerRobWealth || chainUsefulInvert)
      && axisGap >= 2.6
      && multiCoreLits >= 2
      && queerAxis >= 6.0
    ) {
      orientation = 'gay';
    } else {
      orientation = 'straight';
    }
  }

  // 证据链未闭合：破格轴收敛，避免「软燃料堆分很高却判 straight」的分数矛盾
  // 这是分数诚实，不是目标占比调参
  let queerScoreAdj = Math.round(queerAxis * 10) / 10;
  let heteroScoreAdj = Math.round(heteroAxis * 10) / 10;
  if (orientation === 'straight' && !queerCore) {
    if (softDesireOnly && softFuelPresent && !singleStrong) {
      queerScoreAdj = Math.min(queerScoreAdj, Math.max(heteroScoreAdj + 1.5, 4.8));
    } else if (!hardHomology && !singleStrong) {
      queerScoreAdj = Math.min(queerScoreAdj, Math.max(heteroScoreAdj + 2.2, 5.5));
    }
  }
  heteroScore = heteroScoreAdj;
  queerScore = queerScoreAdj;

  // =========================
  // 深柜
  // =========================
  let suppressDim = 0;
  const closetFacts = [];
  const openFacts = [];

  if (printScore >= 4 || printVisible >= 2) {
    suppressDim += 2.4;
    closetFacts.push('印星偏重（透干 ' + printVisible + '，合计 ' + printScore + '），更会把欲望往里收。');
  } else if (printScore >= 2 || printVisible >= 1) {
    suppressDim += 1.1;
    closetFacts.push('印星有气，表达上更容易克制。');
  }

  if (outputVisible === 0) {
    suppressDim += 1.6;
    closetFacts.push('食伤不透干，外放表达偏弱。');
  } else if (outputVisible >= 2) {
    suppressDim -= 1.4;
    openFacts.push('食伤透干 ' + outputVisible + ' 个，更敢直接表达。');
  } else {
    suppressDim -= 0.4;
  }

  const breakHidden = countGods(hidden, ['比肩', '劫财', '食神', '伤官']);
  const breakVisibleCount = countGods(visible, ['比肩', '劫财', '食神', '伤官']);
  if (breakHidden >= breakVisibleCount + 2 && breakHidden >= 3) {
    suppressDim += 1.5;
    closetFacts.push('比劫/食伤多藏不透（藏 ' + breakHidden + ' / 透 ' + breakVisibleCount + '），破格更像压在里面。');
  }

  if (dayMasterYin) suppressDim += 0.55;
  if (dayHuaGai) suppressDim += 0.45;

  let surfaceDim = 0;
  if (!selfUnstable && (spousePresent || spouseHiddenOnly)) {
    surfaceDim += spouseStrong ? 2.4 : 1.8;
    closetFacts.push(gender === 'male' ? '表面仍有妻星可支撑「常规叙事」。' : '表面仍有夫星可支撑「常规叙事」。');
  } else if (hasHongLuanOrTianXi && !selfUnstable) {
    surfaceDim += 0.9;
    supportFacts.push('见红鸾/天喜，外表叙事略可维持。');
  } else if (hasHongLuanOrTianXi) {
    surfaceDim += 0.45;
  }
  if (selfUnstable && spouseVisible >= 2) {
    surfaceDim += 1.2;
    closetFacts.push(
      isCongPattern
        ? '从格下外势配偶星仍可支撑表面常规叙事。'
        : '日主极弱但盘中配偶星仍可支撑表面常规叙事。',
    );
  }

  const closetAxis = clamp(
    suppressDim * 0.9 + surfaceDim * 0.85 + Math.min(suppressDim, surfaceDim) * 0.5,
    0,
    10,
  );
  const closetScore = Math.round(closetAxis * 10) / 10;
  let isDeepCloset = false;
  if (orientation !== 'straight') {
    isDeepCloset = closetAxis >= 5.5 && suppressDim >= 2.0 && surfaceDim >= 1.4;
  }

  // =========================
  // 0/1
  // =========================
  let activeDim = 0;
  let passiveDim = 0;
  const activeFacts = [];
  const passiveFacts = [];

  if (dayMasterYang) {
    activeDim += 2.6;
    activeFacts.push('日主偏阳，主动性先天更强。');
  } else {
    passiveDim += 2.6;
    passiveFacts.push('日主偏阴，承接性先天更强。');
  }

  activeDim += clamp(officerScore * 0.45, 0, 2.8);
  if (officerScore > 0) activeFacts.push('官杀合计 ' + officerScore + '，掌控欲上调。');

  activeDim += clamp(peerScore * 0.28, 0, 2.2);
  if (peerScore > 0) activeFacts.push('比劫合计 ' + peerScore + '，自我主张更强。');

  passiveDim += clamp(wealthScore * 0.42, 0, 2.8);
  if (wealthScore > 0) passiveFacts.push('财星合计 ' + wealthScore + '，更偏被吸引与承纳。');

  if (outputVisible > 0 && officerVisible === 0) {
    passiveDim += 0.9;
    passiveFacts.push('食伤显而官杀弱，表达柔软多于压制。');
  }
  if (printScore >= 3 && outputVisible === 0) {
    passiveDim += 0.8;
    passiveFacts.push('印重食伤弱，角色更易偏承接。');
  }
  if (orientation !== 'straight' && dDesire >= 2.5 && activeDim - passiveDim < 1.5) {
    passiveDim += 0.5;
  }

  let role = null;
  let roleText = '不适用';
  if (orientation !== 'straight') {
    if (activeDim > passiveDim + 1.1) role = '1';
    else if (passiveDim > activeDim + 1.1) role = '0';
    else role = dayMasterYang ? '1' : '0';
    roleText = role;
  }

  // =========================
  // 理由
  // =========================
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
    factReasons.push(...queerFacts.slice(0, 3));
    conclusionReasons.push('异性轴与破格轴都立得住，两边信号形成配合，所以判为双性恋。');
  } else {
    factReasons.push(...queerFacts.slice(0, 4));
    if (supportFacts[0]) factReasons.push(supportFacts[0]);
    if (heteroFacts[0] && spousePresent && selfStand >= 0.65) {
      factReasons.push(heteroFacts[0].replace(/。$/, '，但破格轴配合更强。'));
    }
    conclusionReasons.push(gender === 'female' ? '所以结论是：你是 les。' : '所以结论是：你是 gay。');
  }

  if (orientation !== 'straight') {
    const roleGap = Math.abs(activeDim - passiveDim);
    if (role === '1') {
      factReasons.push(...activeFacts.slice(0, 2));
      conclusionReasons.push(roleGap > 1.1 ? '主动轴明显强于受动轴，所以是 1。' : '主动与受动接近，按日主偏阳定夺为 1。');
    } else {
      factReasons.push(...passiveFacts.slice(0, 2));
      conclusionReasons.push(roleGap > 1.1 ? '受动轴明显强于主动轴，所以是 0。' : '主动与受动接近，按日主偏阴定夺为 0。');
    }

    if (isDeepCloset) {
      factReasons.push(...closetFacts.slice(0, 3));
      conclusionReasons.push('收束与「可装常规」同时成立，所以判为深柜。');
    } else {
      if (openFacts[0]) factReasons.push(openFacts[0]);
      else if (closetFacts[0]) factReasons.push(closetFacts[0].replace(/。$/, '，但还不足以构成深柜。'));
      conclusionReasons.push('收束与表面叙事没有同时配合到位，所以不算深柜。');
    }
  }

  const reasons = unique([...factReasons, ...conclusionReasons]);

  const pillarsText = pillars.year.ganZhi + ' ' + pillars.month.ganZhi + ' ' + pillars.day.ganZhi + ' ' + pillars.hour.ganZhi;
  const dayMasterText = dayMaster.gan + dayMaster.element + dayMaster.yinYang;
  let orientationText = '不是';
  if (orientation === 'gay') orientationText = gender === 'female' ? 'les' : 'gay';
  if (orientation === 'bi') orientationText = '双性恋';
  const closetText = orientation === 'straight' ? '不适用' : isDeepCloset ? '是' : '不是';

  const activeScore = Math.round(activeDim * 10) / 10;
  const passiveScore = Math.round(passiveDim * 10) / 10;

  return {
    personName,
    birthDate: year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0'),
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
    detail: personName + ' · ' + genderText + ' · ' + year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0') + ' ' + timeLabel + ' · 四柱 ' + pillarsText + ' · 日主 ' + dayMasterText + (strengthStatus ? '（' + strengthStatus + '）' : '') + (pattern ? ' · 格局 ' + pattern : ''),
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
      queerHard: singleStrong || coverage >= 2,
      multiPeach,
      peerHeavy: peerHeavyRaw && (spouseAbsent || spouseThin),
      dayIsPeach,
      mediumCount: coreLits,
      totalPeachCount,
      dayPalaceBreak: dayIsPeach || dayIsMuYu || hasGuLuan || dayCollapsed || dayFanYin || dayClashHeavy >= 1,
      nonSpouseHeavy,
      dims: {
        spouse: Math.round(spouseDim * 10) / 10,
        fate: Math.round(fateDim * 10) / 10,
        desire: Math.round(dDesire * 10) / 10,
        struct: Math.round(dStruct * 10) / 10,
        peer: Math.round(dPeer * 10) / 10,
        palace: Math.round(dPalace * 10) / 10,
        synergy: Math.round(synergy * 10) / 10,
        heteroAxis: heteroScore,
        queerAxis: queerScore,
        coverage: Math.round(coverage * 10) / 10,
        selfStand: Math.round(selfStand * 100) / 100,
        suppress: Math.round(suppressDim * 10) / 10,
        surface: Math.round(surfaceDim * 10) / 10,
        hard: {
          desire: desireHard,
          struct: structHard,
          peer: peerHard,
          homology: hardHomology,
          softBlocked: softOnlyBlocked,
          multiAnchor: multiHardAnchor,
          softDesireOnly: softDesireOnly,
          structSoft: structSoft,
          multiCoreLits: multiCoreLits,
        },
        chains: {
          multiPeach: chainMultiPeach,
          dayPeach: chainDayPeach,
          peerVoid: chainPeerSpouseVoid,
          invert: chainInvert,
          hurtSpouse: chainHurtSpouse,
          cong: chainCongCollapse,
          palaceDesire: chainPalaceDesire,
          fuYinDesire: chainFuYinDesire,
          usefulInvert: chainUsefulInvert,
          palacePeer: chainPalacePeer,
          femaleWealth: chainFemaleWealth,
          femaleOutput: chainFemaleOutput,
          malePeerLine: chainMalePeerLine,
          femalePeer: chainFemalePeer,
          congSpecial: chainCongSpecial,
          homologyField: chainHomologyField,
        },
      },
    },
  };
}

