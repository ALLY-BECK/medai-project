// ═══════════════════════════════════════════════
// patients.js — Patient Search & Medical Records (API-connected)
// ═══════════════════════════════════════════════

let PATIENTS_DATA = [];
let filteredPatients = [];

async function initPatients() {
  document.getElementById('patient-search').value = '';
  document.getElementById('patients-grid').innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)">⏳ Загрузка пациентов...</div>';

  try {
    const data = await apiFetch('/patients/');
    if (!data) return;
    PATIENTS_DATA = data;
    filteredPatients = [...PATIENTS_DATA];
    renderPatients();
  } catch (err) {
    document.getElementById('patients-grid').innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--red)">❌ ${err.message}</div>`;
  }
}

function searchPatients(query) {
  const q = query.toLowerCase().trim();
  filteredPatients = q
    ? PATIENTS_DATA.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.iin.includes(q) ||
      (p.tags || []).some(t => t.toLowerCase().includes(q))
    )
    : [...PATIENTS_DATA];
  const count = filteredPatients.length;
  document.getElementById('search-count').textContent = count + ' пациент' + (count === 1 ? '' : count < 5 ? 'а' : 'ов');
  renderPatients();
}

function renderPatients() {
  const grid = document.getElementById('patients-grid');
  const count = filteredPatients.length;
  document.getElementById('search-count').textContent = count + ' пациент' + (count === 1 ? '' : count < 5 ? 'а' : 'ов');
  if (!count) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:40px">Пациенты не найдены</div>';
    return;
  }
  grid.innerHTML = filteredPatients.map((p, i) => `
    <div class="patient-card" onclick="openRecord(${p.id})">
      <div class="patient-avatar" style="background:${avatarGrad(p.id)}">${p.initials}</div>
      <div class="patient-info">
        <div class="patient-name">${p.name}</div>
        <div class="patient-iin">ИИН: ${p.iin}</div>
        <div class="patient-tags">
          ${(p.tags || []).map(t => `<span class="badge badge-blue">${t}</span>`).join('')}
        </div>
      </div>
    </div>
  `).join('');
}

async function openRecord(id) {
  const cached = PATIENTS_DATA.find(x => x.id === id);
  if (cached) {
    AppState.selectedPatient = cached;
  }

  const overlay = document.getElementById('record-overlay');
  const content = document.getElementById('record-content');
  content.innerHTML = '<div style="text-align:center;padding:40px">⏳ Загрузка карточки...</div>';
  overlay.style.display = 'flex';

  try {
    const p = await apiFetch(`/patients/${id}/`);
    if (!p) return;
    AppState.selectedPatient = p;

    const allergyLevelMap = { high: 'allergy-high', med: 'allergy-med', low: 'allergy-low' };
    const allergyLabelMap = { high: '⚠️ Высокая', med: '⚡ Средняя', low: '✓ Низкая' };

    content.innerHTML = `
    <div class="record-profile">
      <div class="record-avatar" style="background:${avatarGrad(p.id)}">${p.initials}</div>
      <div>
        <div class="record-name">${p.name}</div>
        <div class="record-meta">ИИН: ${p.iin} · ${p.blood}</div>
      </div>
    </div>

    <div class="record-section">
      <div class="record-section-title">Основная информация</div>
      <div class="record-info-grid">
        <div class="record-info-item"><div class="record-info-label">Дата рождения</div><div class="record-info-value">${p.dob}</div></div>
        <div class="record-info-item"><div class="record-info-label">Пол</div><div class="record-info-value">${p.gender}</div></div>
        <div class="record-info-item"><div class="record-info-label">Группа крови</div><div class="record-info-value">${p.blood}</div></div>
        <div class="record-info-item"><div class="record-info-label">Телефон</div><div class="record-info-value">${p.phone}</div></div>
      </div>
    </div>

    ${p.chronic && p.chronic.length ? `
    <div class="record-section">
      <div class="record-section-title">Хронические заболевания</div>
      ${p.chronic.map(c => `
        <div class="illness-item" style="margin-bottom:8px">
          <div class="illness-dot" style="background:var(--amber);box-shadow:0 0 8px rgba(245,158,11,0.5)"></div>
          <div class="illness-name">${c}</div>
        </div>
      `).join('')}
    </div>` : ''}

    ${p.allergies && p.allergies.length ? `
    <div class="record-section">
      <div class="record-section-title">Аллергии</div>
      <div class="allergy-list">
        ${p.allergies.map(a => `
          <span class="allergy-tag ${allergyLevelMap[a.level]}">${a.name} — ${allergyLabelMap[a.level]}</span>
        `).join('')}
      </div>
    </div>` : `
    <div class="record-section">
      <div class="record-section-title">Аллергии</div>
      <span class="badge badge-green">Аллергий не выявлено</span>
    </div>`}

    <div class="record-section">
      <div class="record-section-title">История болезней</div>
      <div class="illness-timeline">
        ${(p.illnesses || []).map(ill => `
          <div class="illness-item">
            <div class="illness-dot"></div>
            <div>
              <div class="illness-name">${ill.name}</div>
              <div class="illness-date">${ill.date}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <div style="display:flex;gap:10px;margin-top:8px">
      <button class="btn btn-primary btn-full" onclick="goToAppointment(${p.id})">
        🩺 Начать приём
      </button>
    </div>
  `;
  } catch (err) {
    content.innerHTML = `<div style="color:var(--red);padding:20px">❌ ${err.message}</div>`;
  }
}

function closeRecord(e) {
  if (!e || e.target === document.getElementById('record-overlay') || e.target.classList.contains('record-close')) {
    document.getElementById('record-overlay').style.display = 'none';
  }
}

function goToAppointment(id) {
  const p = PATIENTS_DATA.find(x => x.id === id) || AppState.selectedPatient;
  AppState.selectedPatient = p;
  document.getElementById('record-overlay').style.display = 'none';
  navigateTo('appointment');
  document.getElementById('appt-patient-name').textContent = p ? p.name : 'Пациент';
}
