// ═══════════════════════════════════════════════
// dashboard.js — Doctor Dashboard (API-connected)
// ═══════════════════════════════════════════════

async function initDashboard() {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Доброе утро' : hour < 17 ? 'Добрый день' : 'Добрый вечер';
  const name = AppState.user ? AppState.user.name.split(' ')[1] || AppState.user.name : 'Доктор';
  document.getElementById('dashboard-greeting').textContent = `${greeting}, ${name}!`;
  document.getElementById('header-date').textContent = formatDate(now) + ' · ' + formatTime(now);

  await loadNotifications();
  await loadAppointments();
}

async function loadNotifications() {
  const list = document.getElementById('notifications-list');
  try {
    const data = await apiFetch('/announcements/');
    if (!data || !data.length) {
      list.innerHTML = '<div style="color:var(--text-muted);font-size:14px;padding:20px">Нет новых уведомлений</div>';
      return;
    }
    renderNotifications(data);
  } catch (err) {
    list.innerHTML = `<div style="color:var(--red);padding:20px">❌ ${err.message}</div>`;
  }
}

async function loadAppointments() {
  const list = document.getElementById('appointments-list');
  list.innerHTML = '<div style="color:var(--text-muted);font-size:14px;padding:20px">⏳ Загрузка приёмов...</div>';

  try {
    const data = await apiFetch('/appointments/');
    if (!data) return;
    APPOINTMENTS_DATA = data;
    renderCalendar(APPOINTMENTS_DATA, 'calendar-widget');
    renderAppointments();
  } catch (err) {
    list.innerHTML = `<div style="color:var(--red);padding:20px">❌ ${err.message}</div>`;
  }
}

function renderAppointments() {
  const list = document.getElementById('appointments-list');
  if (!APPOINTMENTS_DATA.length) {
    list.innerHTML = '<div style="color:var(--text-muted);font-size:14px;padding:20px">Нет приёмов на сегодня</div>';
    return;
  }
  list.innerHTML = APPOINTMENTS_DATA.map((a, i) => {
    const statusBadge = a.status === 'done'
      ? '<span class="badge badge-green">Завершён</span>'
      : a.status === 'current'
        ? '<span class="badge badge-amber">Идёт приём</span>'
        : '<span class="badge badge-blue">Ожидает</span>';
    const timeStr = a.time ? a.time.substring(0, 5) : '';
    return `
      <div class="appointment-item" onclick="openPatientFromDashboard(${a.patient_id}, ${a.id})">
        <span class="appt-time">${timeStr}</span>
        <div class="appt-avatar" style="background:${avatarGrad(i)}">${a.patient_initials || '?'}</div>
        <div class="appt-info">
          <div class="appt-name">${a.patient_name}</div>
          <div class="appt-diagnosis">${a.diagnosis || 'Без диагноза'}</div>
        </div>
        <div class="appt-actions">${statusBadge}</div>
      </div>
    `;
  }).join('');
}

function renderNotifications(announcements) {
  const list = document.getElementById('notifications-list');
  list.innerHTML = announcements.map(a => {
    const dateStr = new Date(a.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const isMinistry = (a.author_name || '').toLowerCase().includes('минздрав');
    const icon = isMinistry ? '🏛️' : '🏥';
    const type = isMinistry ? 'ministry' : 'clinic';

    return `
      <div class="notif-item">
        <div class="notif-icon notif-icon-${type}">${icon}</div>
        <div class="notif-body">
          <div class="notif-title">${isMinistry ? 'Приказ Минздрава' : 'Объявление (' + a.author_name + ')'}</div>
          <div class="notif-text">${a.text}</div>
          <div class="notif-time">Сегодня, ${dateStr}</div>
        </div>
      </div>
    `;
  }).join('');
}

function openPatientFromDashboard(patientId, appointmentId) {
  if (!patientId) return;
  AppState.currentAppointmentId = appointmentId;
  navigateTo('patients');
  // Auto-open appointment directly
  setTimeout(() => {
    if (typeof goToAppointment === 'function') {
      goToAppointment(patientId);
    }
  }, 100);
}
