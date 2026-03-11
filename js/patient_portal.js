// ═══════════════════════════════════════════════
// patient_portal.js — Patient Role UI Logic
// ═══════════════════════════════════════════════

// ─── 1. Dashboard ─────────────────────────────────────────────────────────
async function initPatientDashboard() {
  const d = new Date();
  document.getElementById('patient-date').textContent = `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
  document.getElementById('patient-greeting').textContent = `Добрый день, ${AppState.user.name.split(' ')[0]}!`;

  const container = document.getElementById('patient-dashboard-content');
  container.innerHTML = '<div style="text-align:center; padding: 20px; color:var(--text-muted)">Загрузка данных...</div>';

  try {
    const data = await apiFetch('/patient/me/');

    // Store globally for other tabs
    AppState.patientData = data;
    const appts = data.appointments || [];
    const rx = data.prescriptions || [];

    const activeAppts = appts.filter(a => a.status === 'waiting' || a.status === 'in_progress');

    let appointmentsHtml = '';
    if (activeAppts.length > 0) {
      appointmentsHtml = activeAppts.map(app => `
        <div class="appointment-item">
          <div class="appt-time">${app.date} ${app.time}</div>
          <div class="appt-avatar">👨‍⚕️</div>
          <div class="appt-info">
              <div class="appt-name">${app.doctor_name || 'Врач'}</div>
              <div class="appt-diagnosis">${app.hospital_name || 'Частная клиника'}</div>
          </div>
          <button class="btn btn-ghost btn-sm">Маршрут</button>
        </div>
      `).join('');
    } else {
      appointmentsHtml = '<p style="color:var(--text-secondary); font-size:13px; text-align:center; padding: 20px 0;">У вас нет предстоящих записей</p>';
    }

    let rxHtml = '';
    if (rx.length > 0) {
      rxHtml = rx.map(r => `
        <div class="rx-item" style="display:flex; flex-direction:column; align-items:flex-start; margin-bottom:10px;">
          <div style="width:100%;">
              <div class="rx-name" style="font-weight:600; color:var(--text-primary); margin-bottom:4px;">Рецепт от ${r.doctor_name}</div>
              <div class="rx-dose" style="font-size:13px; color:var(--text-secondary);">${r.meds.map(m => `${m.name} (${m.dose})`).join(', ')}</div>
              <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Активен до: ${r.valid_until || '-'}</div>
          </div>
        </div>
      `).join('');
    } else {
      rxHtml = '<p style="color:var(--text-secondary); font-size:13px; text-align:center; padding: 20px 0;">Нет активных рецептов</p>';
    }

    container.innerHTML = `
      <div class="glass-card">
          <div class="card-header">
              <h2 class="card-title">Ближайшие записи</h2>
          </div>
          <div class="appointments-list">
              ${appointmentsHtml}
          </div>
      </div>

      <div class="glass-card">
          <div class="card-header">
              <h2 class="card-title">Ваши назначения</h2>
              <span class="badge badge-amber">Активные</span>
          </div>
          <div class="prescription-list" style="display:flex; flex-direction:column; gap:10px;">
              ${rxHtml}
          </div>
      </div>

      <!-- News / Outbreaks -->
      <div class="glass-card" style="grid-column: 1 / -1;">
          <div class="card-header">
              <h2 class="card-title">Лента здоровья</h2>
          </div>
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px;">
              <div style="padding:16px; background:rgba(239,68,68,0.05); border:1px solid rgba(239,68,68,0.2); border-radius:var(--radius-md);">
                  <div class="badge badge-red" style="margin-bottom:8px">Внимание: Вспышка</div>
                  <h3 style="font-size:15px; font-weight:600; margin-bottom:6px">Сезонный грипп H1N1</h3>
                  <p style="font-size:13px; color:var(--text-secondary)">В школах города зафиксировано повышение заболеваемости. Рекомендуется вакцинация.</p>
              </div>
              <div style="padding:16px; background:rgba(37,99,235,0.05); border:1px solid rgba(37,99,235,0.2); border-radius:var(--radius-md);">
                  <div class="badge badge-blue" style="margin-bottom:8px">Полезная статья</div>
                  <h3 style="font-size:15px; font-weight:600; margin-bottom:6px">Как защитить себя от вирусов</h3>
                  <p style="font-size:13px; color:var(--text-secondary)">5 простых шагов для укрепления иммунитета в осенне-зимний период.</p>
              </div>
          </div>
      </div>
    `;
  } catch (e) {
    container.innerHTML = '<p style="color:var(--red); text-align:center;">Ошибка соединения с сервером</p>';
    showToast(e.message, 'error');
  }
}

// ─── 2. Hospitals & Doctors ───────────────────────────────────────────────
async function initHospitals() {
  const container = document.getElementById('patient-hospitals-content');
  container.innerHTML = '<div style="text-align:center; padding: 40px; color:var(--text-muted)">Загрузка врачей...</div>';

  try {
    const doctors = await apiFetch('/doctors/');

    let docsHtml = doctors.map(d => `
        <div class="doctor-card" style="padding:16px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:var(--radius-md); margin-top:12px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                <div style="display:flex; gap:12px; align-items:center;">
                    <div class="appt-avatar" style="width:48px;height:48px;font-size:18px;">${d.initials}</div>
                    <div>
                        <div style="font-size:15px; font-weight:600">${d.name}</div>
                        <div style="font-size:13px; color:var(--text-secondary)">${d.label || 'Специалист'}</div>
                    </div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="openBookingModal(${d.id}, '${d.name}')">Записаться</button>
            </div>
            
            <h4 style="font-size:12px; color:var(--text-muted); margin-bottom:8px; text-transform:uppercase;">Ближайшие свободные окна (сегодня)</h4>
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap:8px;">
                <button class="btn btn-ghost btn-sm" style="padding:6px; font-size:12px;" onclick="document.getElementById('booking-time').value='09:00'; openBookingModal(${d.id}, '${d.name}')">09:00</button>
                <button class="btn btn-ghost btn-sm" style="padding:6px; font-size:12px;" onclick="document.getElementById('booking-time').value='10:30'; openBookingModal(${d.id}, '${d.name}')">10:30</button>
                <div style="padding:6px; font-size:12px; text-align:center; color:var(--text-muted); background:rgba(0,0,0,0.2); border-radius:var(--radius-sm); border:1px dashed rgba(255,255,255,0.1);">занято</div>
                <button class="btn btn-ghost btn-sm" style="padding:6px; font-size:12px;" onclick="document.getElementById('booking-time').value='14:00'; openBookingModal(${d.id}, '${d.name}')">14:00</button>
            </div>
        </div>
    `).join('') || '<p>Нет доступных врачей</p>';

    container.innerHTML = `
        <div class="glass-card">
            <div class="card-header" style="margin-bottom:8px;">
                <h2 class="card-title" style="font-size:18px;">Доступные специалисты</h2>
            </div>
            ${docsHtml}
        </div>
    `;

    // Add modal HTML if it doesn't exist
    if (!document.getElementById('booking-modal')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay" id="booking-modal" style="display:none" onclick="closeModal(event)">
          <div class="modal glass-card" onclick="event.stopPropagation()">
            <h2 class="modal-title">Запись на приём</h2>
            <p id="booking-doc-name" style="margin-bottom:16px;"></p>
            <input type="hidden" id="booking-doc-id" />
            <div class="form-group">
              <label class="form-label">Дата</label>
              <input type="date" class="form-input" id="booking-date" required />
            </div>
            <div class="form-group">
              <label class="form-label">Время (слоты по 30 мин)</label>
              <select class="form-input" id="booking-time">
                <option value="09:00">09:00 - 09:30</option>
                <option value="09:30">09:30 - 10:00</option>
                <option value="10:00">10:00 - 10:30</option>
                <option value="10:30">10:30 - 11:00</option>
                <option value="11:00">11:00 - 11:30</option>
                <option value="14:00">14:00 - 14:30</option>
                <option value="14:30">14:30 - 15:00</option>
                <option value="15:00">15:00 - 15:30</option>
                <option value="15:30">15:30 - 16:00</option>
              </select>
            </div>
            <div class="modal-actions">
              <button class="btn btn-ghost" onclick="document.getElementById('booking-modal').style.display='none'">Отмена</button>
              <button class="btn btn-primary" onclick="submitBooking()">Подтвердить</button>
            </div>
          </div>
        </div>
      `);
    }
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function openBookingModal(docId, docName) {
  document.getElementById('booking-doc-id').value = docId;
  document.getElementById('booking-doc-name').textContent = `Врач: ${docName}`;
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('booking-date').min = today;
  document.getElementById('booking-date').value = today;
  document.getElementById('booking-modal').style.display = 'flex';
}

async function submitBooking() {
  const doctor_id = document.getElementById('booking-doc-id').value;
  const date = document.getElementById('booking-date').value;
  const time = document.getElementById('booking-time').value;

  try {
    const data = await apiFetch('/appointments/book/', {
      method: 'POST',
      body: JSON.stringify({ doctor_id, date, time })
    });

    showToast('Успешная запись на прием!');
    document.getElementById('booking-modal').style.display = 'none';

    // Refresh history / dashboard
    initHospitals();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─── 3. Diagnostics & AI ──────────────────────────────────────────────────
function initDiagnostics() {
  document.getElementById('ai-symptoms-input').value = '';
  document.getElementById('ai-diagnostics-results').innerHTML = '';
}

async function analyzeSymptoms() {
  const text = document.getElementById('ai-symptoms-input').value.trim();
  if (!text) { showToast('Пожалуйста, опишите симптомы', 'error'); return; }

  const resultsDiv = document.getElementById('ai-diagnostics-results');
  resultsDiv.innerHTML = '<div class="ai-loading">Отправка запроса ИИ-помощнику...</div>';

  try {
    const data = await apiFetch('/diagnostics/analyze/', {
      method: 'POST',
      body: JSON.stringify({ symptoms: text })
    });

    resultsDiv.innerHTML = `
      <div style="margin-bottom:15px; padding:15px; background:rgba(16,185,129,0.1); border-left:4px solid #10b981; border-radius:4px;">
        <p><strong>Мнение ИИ:</strong> ${data.message}</p>
      </div>
      <h3 style="margin-bottom:10px;">Возможные диагнозы (Предварительно!):</h3>
      ${data.analysis.map(a => `
        <div style="display:flex; justify-content:space-between; margin-bottom:10px; padding:10px; background:var(--bg-secondary); border-radius:8px;">
          <span>${a.diagnosis}</span>
          <span style="font-weight:600; color:${a.probability > 70 ? '#ef4444' : '#f59e0b'}">${a.probability}%</span>
        </div>
      `).join('')}
      <button class="btn btn-primary btn-full" style="margin-top:15px;" onclick="navigateTo('hospitals')">Подобрать и записаться к врачу</button>
    `;
  } catch (e) {
    resultsDiv.innerHTML = '';
    showToast('Ошибка сервера (ИИ временно недоступен)', 'error');
  }
}

// ─── 4. History ───────────────────────────────────────────────────────────
function initHistory() {
  if (!AppState.patientData) {
    // If user refreshed or directly visited History, fetch data first
    initPatientDashboard().then(() => renderHistory());
  } else {
    renderHistory();
  }
}

function renderHistory() {
  const grid = document.getElementById('history-grid');
  const d = AppState.patientData;
  if (!d) return;

  const appts = d.appointments || [];
  const labs = d.lab_results || [];

  renderCalendar(appts, 'patient-calendar-widget');

  let apptsHtml = appts.map(a => `
      <div class="illness-item" style="background:rgba(255,255,255,0.02); padding:16px; border-radius:var(--radius-md); border:1px solid rgba(255,255,255,0.05); width:100%;">
          <div class="illness-dot" style="margin-top:8px; ${a.status === 'completed' || a.status === 'done' ? 'background:var(--green); box-shadow:0 0 8px rgba(16,185,129,0.5);' : 'background:var(--amber);'}"></div>
          <div style="flex:1;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <div>
                      <div class="illness-name" style="font-size:16px;">${a.diagnosis || 'Симптоматический прием'}</div>
                      <div class="illness-date" style="color:var(--cyan); margin-top:2px;">${a.date} ${a.time} • Врач: ${a.doctor_name || 'Не указан'}</div>
                  </div>
                  <span class="badge badge-${a.status === 'completed' || a.status === 'done' ? 'green' : 'amber'}">${a.status}</span>
              </div>
              <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
                  <button class="btn btn-ghost btn-sm" style="font-size:12px; padding:6px 12px;" onclick='event.stopPropagation(); showHistoryDetail(${JSON.stringify(a).replace(/'/g, "&#39;")})'>📄 Детали приема</button>
                  ${a.ai_diagnostics ? '<button class="btn btn-ghost btn-sm" style="font-size:12px; padding:6px 12px; pointer-events:none; color:var(--cyan);">🤖 ИИ-Анализ</button>' : ''}
              </div>
          </div>
      </div>
  `).join('');

  if (appts.length === 0) {
    apptsHtml = '<p style="color:var(--text-secondary); text-align:center; padding: 20px 0;">История приемов пуста</p>';
  }

  grid.innerHTML = `
    <div class="glass-card">
      <h2 class="card-title" style="margin-bottom:16px;">Ваши приемы</h2>
      <div class="illness-timeline" style="gap:20px;">
        ${apptsHtml}
      </div>
    </div>
    
    <div class="glass-card">
      <h2 class="card-title">Результаты анализов</h2>
      ${labs.map(r => `
        <div style="border-bottom:1px solid rgba(255,255,255,0.1); padding:10px 0;">
          <div style="font-weight:600; margin-bottom:4px;">${r.created_at.split('T')[0]} - ${r.type_label}</div>
          <div style="font-size:13px; color:#aaa;">Результат: ${r.results || '-'}</div>
        </div>
      `).join('') || '<p>Нет результатов анализов</p>'}
    </div>
  `;
}

window.showHistoryDetail = function (appt) {
  let aiHtml = '';
  if (appt.ai_diagnostics) {
    try {
      const aiData = JSON.parse(appt.ai_diagnostics);

      const symptomsHtml = (aiData.symptoms || []).map(s => `<span class="symptom-tag" style="display:inline-block; margin:2px; padding:4px 8px; background:rgba(255,255,255,0.1); border-radius:12px; font-size:12px;">${s}</span>`).join('');
      const diagnosisHtml = (aiData.diagnoses || []).map(d => `<div style="margin-bottom:5px;">${d.diagnosis} <span style="font-size:12px; color:#aaa;">(${d.probability}%)</span></div>`).join('');
      const recsHtml = (aiData.recommendations || []).map(r => `<li style="margin-left:15px; font-size:14px; margin-bottom:4px;">${r}</li>`).join('');

      aiHtml = `
        <div style="background:rgba(0,0,0,0.2); padding:15px; border-radius:8px; margin-top:15px;">
          <h3 style="font-size:16px; margin-bottom:10px; color:#10B981;">🤖 ИИ-Анализ</h3>
          
          <div style="margin-bottom:10px;">
            <strong style="display:block; margin-bottom:4px; font-size:13px; color:#aaa;">Симптомы:</strong>
            ${symptomsHtml || 'Нет данных'}
          </div>
          
          <div style="margin-bottom:10px;">
            <strong style="display:block; margin-bottom:4px; font-size:13px; color:#aaa;">Предварительные диагнозы:</strong>
            ${diagnosisHtml || 'Нет данных'}
          </div>

          <div>
             <strong style="display:block; margin-bottom:4px; font-size:13px; color:#aaa;">Рекомендации ИИ:</strong>
             <ul style="padding:0; margin:0;">${recsHtml || 'Нет данных'}</ul>
          </div>
        </div>
      `;
    } catch (e) {
      aiHtml = `
        <div style="background:rgba(0,0,0,0.2); padding:15px; border-radius:8px; margin-top:15px;">
           <h3 style="font-size:16px; margin-bottom:10px; color:#10B981;">🤖 ИИ-Анализ</h3>
           <p style="white-space: pre-wrap; font-size:14px;">${appt.ai_diagnostics}</p>
        </div>
      `;
    }
  }

  const content = document.getElementById('history-modal-content');
  content.innerHTML = `
    <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:15px;">
       <div>
         <div style="font-size:12px; color:#aaa;">Врач</div>
         <div style="font-size:16px; font-weight:600;">${appt.doctor_name || 'Не указан'}</div>
       </div>
       <div style="text-align:right;">
         <div style="font-size:12px; color:#aaa;">Дата и время</div>
         <div style="font-size:16px; font-weight:600;">${appt.date} ${appt.time}</div>
       </div>
    </div>

    <div style="margin-bottom:15px;">
      <div style="font-size:12px; color:#aaa;">Официальный Диагноз</div>
      <div style="font-size:16px;">${appt.diagnosis || 'Не поставлен'}</div>
    </div>
    
    <div style="margin-bottom:15px;">
      <div style="font-size:12px; color:#aaa;">Заключение врача</div>
      <div style="font-size:14px; white-space: pre-wrap; background:rgba(255,255,255,0.05); padding:10px; border-radius:4px; margin-top:4px;">${appt.conclusion || 'Нет заключения'}</div>
    </div>

    ${appt.post_treatment_status ? `
    <div style="margin-bottom:15px;">
      <div style="font-size:12px; color:#aaa;">Состояние после лечения</div>
      <div style="font-size:14px; background:rgba(255,255,255,0.05); padding:10px; border-radius:4px; margin-top:4px;">${appt.post_treatment_status}</div>
    </div>
    ` : ''}

    ${aiHtml}
  `;

  document.getElementById('history-detail-modal').style.display = 'flex';
};

// ─── 5. Profile ───────────────────────────────────────────────────────────
function initPatientProfile() {
  if (!AppState.patientData) {
    initPatientDashboard().then(() => renderProfile());
  } else {
    renderProfile();
  }
}

function renderProfile() {
  const d = AppState.patientData;
  if (!d) return;
  const p = d.profile || {};
  const c = document.getElementById('patient-profile-content');

  const chronic = p.chronic || [];
  const allergies = p.allergies || [];

  c.innerHTML = `
    <div style="display:flex; gap:20px; align-items:center; margin-bottom:20px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:20px;">
      <div class="sidebar-avatar" style="width:64px; height:64px; font-size:24px;">${p.initials || 'П'}</div>
      <div>
        <h2 style="font-size:20px;">${p.name || 'Пациент'}</h2>
        <p style="color:#aaa;">ИИН: ${p.iin || 'Не указан'}</p>
        <p style="color:#aaa;">Телефон: ${p.phone || 'Не указан'}</p>
      </div>
    </div>
    <div class="stats-row" style="margin-bottom:20px;">
      <div class="stat-card" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);">
        <div class="stat-label">Пол</div>
        <div class="stat-value" style="font-size:16px;">${p.gender === 'M' ? 'Мужской' : p.gender === 'F' ? 'Женский' : 'Не указан'}</div>
      </div>
      <div class="stat-card" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);">
        <div class="stat-label">Дата рождения</div>
        <div class="stat-value" style="font-size:16px;">${p.dob || '-'}</div>
      </div>
      <div class="stat-card" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);">
        <div class="stat-label">Группа крови</div>
        <div class="stat-value" style="font-size:16px;">${p.blood || '-'}</div>
      </div>
    </div>
    <div>
      <h3 style="margin-bottom: 10px;">Медицинская информация</h3>
      <p style="margin-bottom: 6px;"><strong>Хронические заболевания:</strong> ${chronic.length ? chronic.join(', ') : 'Нет'}</p>
      <p style="margin-bottom: 6px;"><strong>Аллергии:</strong> ${allergies.length ? allergies.map(a => a.name).join(', ') : 'Нет'}</p>
    </div>
  `;
}
