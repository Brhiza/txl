import { analyzeOrientation } from './analyze.js';

const form = document.getElementById('form');
const birthDateInput = document.getElementById('birthDate');
const timeIndexInput = document.getElementById('timeIndex');
const resultEl = document.getElementById('result');
const metricsEl = document.getElementById('metrics');
const orientationAnswerEl = document.getElementById('orientationAnswer');
const roleAnswerEl = document.getElementById('roleAnswer');
const closetAnswerEl = document.getElementById('closetAnswer');
const detailEl = document.getElementById('detail');
const reasonsEl = document.getElementById('reasons');
const finaleEl = document.getElementById('finale');
const errorEl = document.getElementById('error');
const againBtn = document.getElementById('again');

function getSelectedGender() {
  const checked = form.querySelector('input[name="gender"]:checked');
  return checked ? checked.value : '';
}

function clearForm() {
  form.reset();
  const male = form.querySelector('input[name="gender"][value="male"]');
  if (male) male.checked = true;
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
  orientationAnswerEl.textContent = '';
  roleAnswerEl.textContent = '';
  closetAnswerEl.textContent = '';
  detailEl.textContent = '';
  reasonsEl.innerHTML = '';
  finaleEl.hidden = true;
  finaleEl.textContent = '';
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

  const showMetrics = data.orientation !== 'straight';
  metricsEl.hidden = !showMetrics;
  resultEl.classList.toggle('has-metrics', showMetrics);

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

showFormOnly();

form.addEventListener('submit', (event) => {
  event.preventDefault();

  try {
    const data = analyzeOrientation(
      birthDateInput.value,
      timeIndexInput.value,
      getSelectedGender(),
    );
    showResultOnly(data);
  } catch (error) {
    showError(error instanceof Error ? error.message : '计算失败');
  }
});

againBtn.addEventListener('click', () => {
  clearForm();
  showFormOnly();
  birthDateInput.focus();
});
