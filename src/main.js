import { analyzeOrientation } from './analyze.js';

const form = document.getElementById('form');
const personNameInput = document.getElementById('personName');
const birthDateInput = document.getElementById('birthDate');
const timeIndexInput = document.getElementById('timeIndex');
const resultEl = document.getElementById('result');
const metricsEl = document.getElementById('metrics');
const nameLineEl = document.getElementById('nameLine');
const orientationAnswerEl = document.getElementById('orientationAnswer');
const roleAnswerEl = document.getElementById('roleAnswer');
const closetAnswerEl = document.getElementById('closetAnswer');
const detailEl = document.getElementById('detail');
const reasonsEl = document.getElementById('reasons');
const finaleEl = document.getElementById('finale');
const errorEl = document.getElementById('error');
const againBtn = document.getElementById('again');
const saveImageBtn = document.getElementById('saveImage');

let latestResult = null;

function getSelectedGender() {
  const checked = form.querySelector('input[name="gender"]:checked');
  return checked ? checked.value : '';
}

function clearForm() {
  form.reset();
  const male = form.querySelector('input[name="gender"][value="male"]');
  if (male) male.checked = true;
  personNameInput.value = '';
  birthDateInput.value = '';
  timeIndexInput.value = '6';
}

function showFormOnly() {
  form.hidden = false;
  resultEl.hidden = true;
  resultEl.classList.remove('has-metrics');
  errorEl.hidden = true;
  errorEl.textContent = '';
  metricsEl.hidden = true;
  nameLineEl.textContent = '';
  orientationAnswerEl.textContent = '';
  roleAnswerEl.textContent = '';
  closetAnswerEl.textContent = '';
  detailEl.textContent = '';
  reasonsEl.innerHTML = '';
  finaleEl.hidden = true;
  finaleEl.textContent = '';
  latestResult = null;
}

function showError(message) {
  form.hidden = false;
  resultEl.hidden = true;
  errorEl.hidden = false;
  errorEl.textContent = message;
}

function showResultOnly(data) {
  form.hidden = true;
  resultEl.hidden = false;
  errorEl.hidden = true;
  errorEl.textContent = '';
  latestResult = data;

  const showMetrics = data.orientation !== 'straight';
  metricsEl.hidden = !showMetrics;
  resultEl.classList.toggle('has-metrics', showMetrics);

  nameLineEl.textContent = data.personName || '';

  if (showMetrics) {
    orientationAnswerEl.textContent = data.orientationText;
    roleAnswerEl.textContent = data.roleText;
    closetAnswerEl.textContent = data.closetText;
  } else {
    orientationAnswerEl.textContent = '';
    roleAnswerEl.textContent = '';
    closetAnswerEl.textContent = '';
  }

  detailEl.textContent = data.detail;
  reasonsEl.innerHTML = '';

  for (const reason of data.reasons) {
    const li = document.createElement('li');
    li.textContent = reason;
    reasonsEl.appendChild(li);
  }

  if (data.finale) {
    finaleEl.hidden = false;
    finaleEl.textContent = data.finale;
  } else {
    finaleEl.hidden = true;
    finaleEl.textContent = '';
  }
}

function wrapText(ctx, text, maxWidth) {
  const chars = String(text || '').split('');
  const lines = [];
  let line = '';

  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawRoundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function safeFileName(name) {
  const cleaned = String(name || '未命名')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 30);
  return cleaned || '未命名';
}

function buildResultImage(data) {
  const width = 1080;
  const padding = 56;
  const contentWidth = width - padding * 2;
  const reasons = (data.reasons || []).slice(0, 6);
  const personName = data.personName || '未命名';
  const genderText = data.genderText || '';

  const measure = document.createElement('canvas').getContext('2d');
  measure.font = '28px "Microsoft YaHei", "PingFang SC", sans-serif';
  const reasonLines = [];
  for (const reason of reasons) {
    reasonLines.push(...wrapText(measure, `· ${reason}`, contentWidth - 20));
  }

  measure.font = 'bold 48px "Microsoft YaHei", "PingFang SC", sans-serif';
  const finaleLines = wrapText(measure, data.finale || '', contentWidth);

  // 隐私：图片不写出生日期、时辰、四柱等八字信息，只保留名字和性别
  const summaryLine = genderText ? `${personName} · ${genderText}` : personName;
  measure.font = '26px "Microsoft YaHei", "PingFang SC", sans-serif';
  const summaryLines = wrapText(measure, summaryLine, contentWidth);

  const showMetrics = data.orientation !== 'straight';
  let height = 180;
  height += summaryLines.length * 40 + 28;
  if (showMetrics) height += 180;
  height += 70;
  height += reasonLines.length * 42 + 24;
  if (finaleLines.length) height += finaleLines.length * 62 + 40;
  height += 90;
  height = Math.max(height, 860);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#f7f1e7');
  bg.addColorStop(0.55, '#efe4d4');
  bg.addColorStop(1, '#e8d7c4');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(138, 61, 47, 0.08)';
  ctx.beginPath();
  ctx.arc(width - 120, 110, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(90, height - 120, 120, 0, Math.PI * 2);
  ctx.fill();

  drawRoundRect(ctx, 34, 34, width - 68, height - 68, 28);
  ctx.fillStyle = 'rgba(255, 250, 242, 0.94)';
  ctx.fill();
  ctx.strokeStyle = '#d8ccb8';
  ctx.lineWidth = 2;
  ctx.stroke();

  let y = 100;
  ctx.fillStyle = '#8a3d2f';
  ctx.font = '24px "Microsoft YaHei", "PingFang SC", sans-serif';
  ctx.fillText('取向速断', padding, y);

  y += 58;
  ctx.fillStyle = '#1c1814';
  ctx.font = 'bold 54px "Microsoft YaHei", "PingFang SC", sans-serif';
  ctx.fillText('你是不是同性恋？', padding, y);

  y += 48;
  ctx.strokeStyle = '#d8ccb8';
  ctx.beginPath();
  ctx.moveTo(padding, y);
  ctx.lineTo(width - padding, y);
  ctx.stroke();

  y += 50;
  ctx.fillStyle = '#6f6558';
  ctx.font = '26px "Microsoft YaHei", "PingFang SC", sans-serif';
  for (const line of summaryLines) {
    ctx.fillText(line, padding, y);
    y += 40;
  }

  if (showMetrics) {
    y += 18;
    const cardW = (contentWidth - 28) / 3;
    const cardH = 132;
    const items = [
      { label: '取向', value: data.orientationText },
      { label: '0 还是 1', value: data.roleText },
      { label: '深柜', value: data.closetText },
    ];

    items.forEach((item, index) => {
      const x = padding + index * (cardW + 14);
      drawRoundRect(ctx, x, y, cardW, cardH, 16);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#d8ccb8';
      ctx.stroke();

      ctx.fillStyle = '#6f6558';
      ctx.font = '24px "Microsoft YaHei", "PingFang SC", sans-serif';
      ctx.fillText(item.label, x + 22, y + 42);

      ctx.fillStyle = '#1c1814';
      ctx.font = 'bold 42px "Microsoft YaHei", "PingFang SC", sans-serif';
      ctx.fillText(String(item.value ?? ''), x + 22, y + 96);
    });
    y += cardH + 36;
  } else {
    y += 18;
  }

  ctx.fillStyle = '#1c1814';
  ctx.font = 'bold 30px "Microsoft YaHei", "PingFang SC", sans-serif';
  ctx.fillText('判定理由', padding, y);
  y += 18;
  ctx.strokeStyle = '#d8ccb8';
  ctx.beginPath();
  ctx.moveTo(padding, y);
  ctx.lineTo(width - padding, y);
  ctx.stroke();
  y += 42;

  ctx.fillStyle = '#2a241d';
  ctx.font = '28px "Microsoft YaHei", "PingFang SC", sans-serif';
  for (const line of reasonLines) {
    ctx.fillText(line, padding, y);
    y += 42;
  }

  if (finaleLines.length) {
    y += 18;
    ctx.fillStyle = '#8a3d2f';
    ctx.font = 'bold 44px "Microsoft YaHei", "PingFang SC", sans-serif';
    for (const line of finaleLines) {
      ctx.fillText(line, padding, y);
      y += 58;
    }
  }

  ctx.fillStyle = '#8a7a68';
  ctx.font = '22px "Microsoft YaHei", "PingFang SC", sans-serif';
  ctx.fillText('娱乐向八字速断 · sydf.cc', padding, height - 58);

  return canvas;
}

function downloadCanvas(canvas, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

showFormOnly();

form.addEventListener('submit', (event) => {
  event.preventDefault();

  try {
    const data = analyzeOrientation(
      birthDateInput.value,
      timeIndexInput.value,
      getSelectedGender(),
      personNameInput.value,
    );
    showResultOnly(data);
  } catch (error) {
    showError(error instanceof Error ? error.message : '计算失败');
  }
});

againBtn.addEventListener('click', () => {
  clearForm();
  showFormOnly();
  personNameInput.focus();
});

saveImageBtn.addEventListener('click', () => {
  if (!latestResult) {
    showError('请先完成一次测试');
    return;
  }

  try {
    const canvas = buildResultImage(latestResult);
    const namePart = safeFileName(latestResult.personName);
    downloadCanvas(canvas, `${namePart}-取向速断.png`);
  } catch (error) {
    showError(error instanceof Error ? error.message : '保存图片失败');
  }
});
