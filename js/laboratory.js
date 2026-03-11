// ═══════════════════════════════════════════════
// laboratory.js — Lab Results Management (API-connected)
// ═══════════════════════════════════════════════

const LAB_ICONS = {
  blood: { icon: '🩸', color: 'rgba(239,68,68,0.15)' },
  biochem: { icon: '🧪', color: 'rgba(37,99,235,0.15)' },
  pcr: { icon: '🦠', color: 'rgba(139,92,246,0.15)' },
  urine: { icon: '💧', color: 'rgba(6,182,212,0.15)' },
  hormones: { icon: '⚗️', color: 'rgba(245,158,11,0.15)' },
};

let pendingResults = [];
let completedResults = [];

async function initLab() {
  await loadLabResults();
}

async function loadLabResults() {
  try {
    const all = await apiFetch('/lab-results/');
    if (!all) return;
    pendingResults = all.filter(r => r.status === 'pending');
    completedResults = all.filter(r => r.status === 'sent');
    renderLabLists();
  } catch (err) {
    document.getElementById('lab-pending-list').innerHTML = `<div style="color:var(--red);padding:20px">❌ ${err.message}</div>`;
  }
}

function renderLabLists() {
  document.getElementById('pending-count').textContent = pendingResults.length;

  document.getElementById('lab-pending-list').innerHTML = pendingResults.map(item => {
    const meta = LAB_ICONS[item.type] || { icon: '🧪', color: 'rgba(37,99,235,0.15)' };
    const timeStr = item.created_at ? new Date(item.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
    return `
    <div class="lab-item">
      <div class="lab-item-icon" style="background:${meta.color}">${meta.icon}</div>
      <div class="lab-item-info">
        <div class="lab-item-name">${item.type_display || item.type_label || item.type}</div>
        <div class="lab-item-patient">${item.patient_name} · ИИН: ${item.patient_iin}</div>
        <div class="lab-item-time">Взят в ${timeStr}</div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="sendResult(${item.id})">Отправить</button>
    </div>
  `;
  }).join('') || '<div style="color:var(--text-muted);font-size:14px;padding:20px 0">Нет ожидающих анализов</div>';

  document.getElementById('lab-completed-list').innerHTML = completedResults.map(item => {
    const meta = LAB_ICONS[item.type] || { icon: '🧪', color: '' };
    const timeStr = item.created_at ? new Date(item.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
    return `
    <div class="lab-item">
      <div class="lab-item-icon" style="background:rgba(16,185,129,0.15)">${meta.icon}</div>
      <div class="lab-item-info">
        <div class="lab-item-name">${item.type_display || item.type_label || item.type}</div>
        <div class="lab-item-patient">${item.patient_name}</div>
        <div class="lab-item-time">Отправлен в ${timeStr}</div>
      </div>
      <span class="badge badge-green">Отправлен</span>
    </div>
  `;
  }).join('');
}

async function sendResult(id) {
  try {
    const res = await apiFetch(`/lab-results/${id}/send/`, { method: 'PATCH' });
    showToast(`✅ ${res.message}`);
    await loadLabResults();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

function showAddResult() {
  document.getElementById('add-result-modal').style.display = 'flex';
}

function closeAddResult() {
  document.getElementById('add-result-modal').style.display = 'none';
}

async function submitLabResult() {
  const iin = document.getElementById('lab-iin').value.trim();
  const type = document.getElementById('lab-type').value;
  const results = document.getElementById('lab-results').value.trim();

  if (!iin || !results) { showToast('Заполните все поля', 'error'); return; }

  // Map select display value to API type key
  const typeMap = {
    'Общий анализ крови': 'blood',
    'Биохимия крови': 'biochem',
    'Общий анализ мочи': 'urine',
    'ПЦР тест': 'pcr',
    'Гормоны щитовидной железы': 'hormones',
  };

  try {
    // Find patient by IIN first (search)
    const patients = await apiFetch(`/patients/?q=${iin}`);
    if (!patients || !patients.length) {
      showToast('Пациент с таким ИИН не найден', 'error');
      return;
    }

    await apiFetch('/lab-results/', {
      method: 'POST',
      body: JSON.stringify({
        patient: patients[0].id,
        type: typeMap[type] || 'blood',
        type_label: type,
        results,
      }),
    });

    showToast('✅ Результат анализа сохранён');
    closeAddResult();
    document.getElementById('lab-iin').value = '';
    document.getElementById('lab-results').value = '';
    await loadLabResults();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}
