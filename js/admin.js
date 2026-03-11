// ═══════════════════════════════════════════════
// admin.js — Admin/Medical Staff Dashboard (API-connected)
// ═══════════════════════════════════════════════

const SCHEDULE_DATA = [
  { name: 'Нурланова А.С.', spec: 'Терапевт', time: '08:00–14:00', status: 'active' },
  { name: 'Касымов Б.К.', spec: 'Хирург', time: '09:00–15:00', status: 'active' },
  { name: 'Алимова Г.Т.', spec: 'Кардиолог', time: '10:00–16:00', status: 'active' },
  { name: 'Джаксыбеков Н.О.', spec: 'Невролог', time: '08:00–14:00', status: 'away' },
  { name: 'Сейткали А.Ж.', spec: 'Педиатр', time: '09:00–17:00', status: 'active' },
];

async function initAdmin() {
  renderSchedule();
  await loadAnnouncements();
}

function renderSchedule() {
  const el = document.getElementById('admin-schedule');
  el.innerHTML = SCHEDULE_DATA.map(d => `
    <div class="schedule-item">
      <div class="schedule-avatar">${d.name.split(' ')[0][0]}${d.name.split(' ')[1]?.[0] || ''}</div>
      <div class="schedule-info">
        <div class="schedule-name">${d.name}</div>
        <div class="schedule-spec">${d.spec} · ${d.time}</div>
      </div>
      <span class="badge ${d.status === 'active' ? 'badge-green' : 'badge-amber'}">${d.status === 'active' ? 'На смене' : 'Отсутствует'}</span>
    </div>
  `).join('');
}

async function loadAnnouncements() {
  const list = document.getElementById('announcements-list');
  try {
    const data = await apiFetch('/announcements/');
    if (!data) return;
    if (!data.length) {
      list.innerHTML = '<div style="color:var(--text-muted);font-size:14px;padding:16px 0">Нет объявлений</div>';
      return;
    }
    list.innerHTML = data.map(a => {
      const dateStr = new Date(a.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
      return `
      <div class="announcement-item">
        <div class="announcement-meta">${a.author_name || 'Администратор'} · ${dateStr}</div>
        <div class="announcement-text">${a.text}</div>
      </div>
    `;
    }).join('');
  } catch (err) {
    list.innerHTML = `<div style="color:var(--red);padding:12px">❌ ${err.message}</div>`;
  }
}

async function publishAnnouncement() {
  const text = document.getElementById('announcement-text').value.trim();
  if (!text) { showToast('Введите текст объявления', 'error'); return; }

  try {
    await apiFetch('/announcements/', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    showToast('✅ Объявление опубликовано');
    document.getElementById('announcement-text').value = '';
    await loadAnnouncements();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}
