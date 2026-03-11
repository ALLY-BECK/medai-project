// ═══════════════════════════════════════════════
// pharmacy.js — Pharmacist QR Prescription (API-connected)
// ═══════════════════════════════════════════════

let PRESCRIPTIONS_DATA = [];
let currentPrescription = null;

async function initPharmacy() {
  await loadPrescriptions();
}

async function loadPrescriptions() {
  const list = document.getElementById('recent-prescriptions');
  list.innerHTML = '<div style="color:var(--text-muted);font-size:14px;padding:20px">⏳ Загрузка рецептов...</div>';

  try {
    const data = await apiFetch('/prescriptions/');
    if (!data) return;
    PRESCRIPTIONS_DATA = data;
    renderRecentPrescriptions();
  } catch (err) {
    list.innerHTML = `<div style="color:var(--red);padding:12px">❌ ${err.message}</div>`;
  }
}

function renderRecentPrescriptions() {
  const list = document.getElementById('recent-prescriptions');
  if (!PRESCRIPTIONS_DATA.length) {
    list.innerHTML = '<div style="color:var(--text-muted);font-size:14px;padding:20px">Нет рецептов</div>';
    return;
  }
  list.innerHTML = PRESCRIPTIONS_DATA.map(rx => `
    <div class="recent-rx-item">
      <div class="recent-rx-icon">💊</div>
      <div class="recent-rx-info">
        <div class="recent-rx-name">${rx.patient_name}</div>
        <div class="recent-rx-time">${rx.meds && rx.meds[0] ? rx.meds[0].name : '—'} · Врач: ${rx.doctor_name || '—'}</div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="showPrescriptionById(${rx.id})">Показать</button>
    </div>
  `).join('');
}

function simulateScan() {
  const area = document.getElementById('qr-scanner-area');
  area.style.background = 'rgba(16,185,129,0.1)';
  area.style.border = '1px solid rgba(16,185,129,0.3)';
  setTimeout(() => {
    area.style.background = '';
    area.style.border = '';
    // Show the first prescription from the list
    if (PRESCRIPTIONS_DATA.length > 0) {
      showPrescriptionById(PRESCRIPTIONS_DATA[0].id);
    } else {
      showToast('Рецепты не найдены', 'error');
    }
  }, 1200);
}

function showPrescriptionById(id) {
  const rx = PRESCRIPTIONS_DATA.find(p => p.id === id);
  if (!rx) return;
  currentPrescription = rx;
  showPrescription(rx);
}

function showPrescription(rx) {
  const result = document.getElementById('prescription-result');
  const details = document.getElementById('prescription-details');
  const validDate = rx.valid_until ? new Date(rx.valid_until).toLocaleDateString('ru-RU') : '—';
  const createdDate = rx.created_at ? new Date(rx.created_at).toLocaleDateString('ru-RU') : '—';

  details.innerHTML = `
    <div class="record-info-grid" style="margin-bottom:16px">
      <div class="record-info-item"><div class="record-info-label">Пациент</div><div class="record-info-value">${rx.patient_name}</div></div>
      <div class="record-info-item"><div class="record-info-label">ИИН</div><div class="record-info-value" style="font-family:monospace">${rx.patient_iin}</div></div>
      <div class="record-info-item"><div class="record-info-label">Врач</div><div class="record-info-value">${rx.doctor_name || '—'}</div></div>
      <div class="record-info-item"><div class="record-info-label">Действителен до</div><div class="record-info-value">${validDate}</div></div>
    </div>
    <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:10px">Препараты</div>
    ${(rx.meds || []).map(m => `
      <div class="rx-item">
        <div>
          <div class="rx-name">${m.name}</div>
          <div class="rx-dose">${m.dose}</div>
        </div>
      </div>
    `).join('')}
  `;
  result.style.display = 'block';
  result.style.animation = 'fadeInUp 0.3s ease';
}

async function dispenseRx() {
  if (!currentPrescription) return;
  try {
    await apiFetch(`/prescriptions/${currentPrescription.id}/dispense/`, { method: 'PATCH' });
    showToast('✅ Лекарства выданы пациенту');
    document.getElementById('prescription-result').style.display = 'none';
    currentPrescription = null;
    await loadPrescriptions();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}
