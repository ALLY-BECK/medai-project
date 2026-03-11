// ═══════════════════════════════════════════════
// ministry.js — Ministry of Health Dashboard
// ═══════════════════════════════════════════════

const COMPLAINTS_DATA = [
  { title: 'Долгое ожидание в очереди', clinic: 'Поликлиника №5, Алматы', date: '17.02.2026', status: 'new' },
  { title: 'Грубость медперсонала', clinic: 'Городская больница №2, Нур-Султан', date: '16.02.2026', status: 'new' },
  { title: 'Отказ в экстренной помощи', clinic: 'Скорая помощь, Шымкент', date: '15.02.2026', status: 'review' },
  { title: 'Неправильно выписан рецепт', clinic: 'Поликлиника №12, Алматы', date: '14.02.2026', status: 'new' },
  { title: 'Нехватка лекарств в аптеке', clinic: 'Аптека №7, Актобе', date: '13.02.2026', status: 'resolved' },
];

const REGIONS_DATA = [
  { name: 'Алматы', clinics: 48, visits: 4200, pct: 92 },
  { name: 'Нур-Султан', clinics: 32, visits: 3100, pct: 78 },
  { name: 'Шымкент', clinics: 28, visits: 2800, pct: 71 },
  { name: 'Актобе', clinics: 18, visits: 1600, pct: 55 },
  { name: 'Атырау', clinics: 14, visits: 1200, pct: 42 },
  { name: 'Павлодар', clinics: 16, visits: 1400, pct: 48 },
  { name: 'Тараз', clinics: 12, visits: 980, pct: 35 },
  { name: 'Семей', clinics: 10, visits: 820, pct: 30 },
];

const CHART_DATA = {
  labels: ['Пол. №1', 'Пол. №2', 'ГБ №1', 'ГБ №2', 'Пол. №5', 'ДГБ', 'Пол. №12'],
  values: [1240, 980, 1560, 870, 1100, 640, 890],
};

let chartInstance = null;

async function initMinistry() {
  const now = new Date();
  document.getElementById('ministry-date').textContent = formatDate(now);
  renderComplaints();
  await loadMinistryStats();
}

async function loadMinistryStats() {
  try {
    const data = await apiFetch('/ministry/stats/');
    if (!data) { renderRegions(REGIONS_DATA); setTimeout(renderChart, 100); return; }

    // Update stat cards dynamically
    const statValues = document.querySelectorAll('.stat-value');
    if (statValues[0]) statValues[0].textContent = data.clinics;
    if (statValues[1]) statValues[1].textContent = data.doctors.toLocaleString();
    if (statValues[2]) statValues[2].textContent = data.appointments_month.toLocaleString();
    if (statValues[3]) statValues[3].textContent = data.complaints;

    // Use regions from API if available
    const regions = data.regions && data.regions.length ? data.regions : REGIONS_DATA;
    const maxVisits = Math.max(...regions.map(r => r.visits));
    const mappedRegions = regions.map(r => ({
      name: r.name,
      clinics: r.clinics || r.doctors,
      visits: r.visits,
      pct: Math.round((r.visits / maxVisits) * 100),
    }));
    renderRegions(mappedRegions);
    setTimeout(renderChart, 100);
  } catch (err) {
    renderRegions(REGIONS_DATA);
    setTimeout(renderChart, 100);
  }
}


function renderComplaints() {
  const statusMap = {
    new: '<span class="badge badge-red">Новая</span>',
    review: '<span class="badge badge-amber">На рассмотрении</span>',
    resolved: '<span class="badge badge-green">Решена</span>',
  };
  document.getElementById('complaints-list').innerHTML = COMPLAINTS_DATA.map(c => `
    <div class="complaint-item">
      <div style="font-size:20px">⚠️</div>
      <div class="complaint-info">
        <div class="complaint-title">${c.title}</div>
        <div class="complaint-clinic">${c.clinic}</div>
        <div class="complaint-date">${c.date}</div>
      </div>
      ${statusMap[c.status]}
    </div>
  `).join('');
}

function renderRegions(regionsData) {
  const data = regionsData || REGIONS_DATA;
  document.getElementById('regions-grid').innerHTML = data.map(r => `
    <div class="region-item">
      <div class="region-name">${r.name}</div>
      <div class="region-bar-wrap">
        <div class="region-bar" style="width:${r.pct}%"></div>
      </div>
      <div class="region-stats">
        <span>${r.clinics} клиник</span>
        <span>${r.visits.toLocaleString()} приёмов</span>
      </div>
    </div>
  `).join('');
}

function renderChart() {
  const canvas = document.getElementById('clinics-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.offsetWidth || 500;
  const h = 200;
  canvas.width = w;
  canvas.height = h;

  const max = Math.max(...CHART_DATA.values);
  const barW = Math.floor((w - 60) / CHART_DATA.labels.length) - 8;
  const barAreaH = h - 40;

  ctx.clearRect(0, 0, w, h);

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = 10 + (barAreaH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(w - 10, y);
    ctx.stroke();
  }

  CHART_DATA.labels.forEach((label, i) => {
    const val = CHART_DATA.values[i];
    const barH = (val / max) * barAreaH;
    const x = 40 + i * (barW + 8);
    const y = 10 + barAreaH - barH;

    // Gradient bar
    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
    grad.addColorStop(0, '#3B82F6');
    grad.addColorStop(1, '#06B6D4');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, 4);
    ctx.fill();

    // Label
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.font = '10px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + barW / 2, h - 5);

    // Value
    ctx.fillStyle = '#F1F5F9';
    ctx.font = 'bold 10px Inter';
    ctx.fillText(val, x + barW / 2, y - 4);
  });
}

function updateChart(period) {
  // Simulate different data for different periods
  CHART_DATA.values = CHART_DATA.values.map(v => Math.floor(v * (0.8 + Math.random() * 0.4)));
  renderChart();
}

async function publishMinistryAnnouncement() {
  const text = document.getElementById('ministry-announcement-text').value.trim();
  if (!text) { showToast('Введите текст приказа / уведомления', 'error'); return; }

  try {
    await apiFetch('/announcements/', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    showToast('✅ Обновленный приказ Минздрава доставлен во все клиники!');
    document.getElementById('ministry-announcement-text').value = '';

    // Refresh admin announcements if another role logs in
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}
