// ═══════════════════════════════════════════════
// app.js — Router, State, Utilities
// ═══════════════════════════════════════════════

const AppState = {
  role: null,
  user: null,
  selectedPatient: null,
  appointmentActive: false,
  appointmentTimer: null,
  appointmentSeconds: 0,
};

const ROLE_CONFIG = {
  doctor: {
    name: 'Доктор Асель Нурланова',
    initials: 'АН',
    label: 'Врач — Терапевт',
    nav: [
      { id: 'dashboard', icon: '🏠', label: 'Дашборд' },
      { id: 'patients', icon: '👥', label: 'Пациенты' },
      { id: 'appointment', icon: '🩺', label: 'Приём' },
      { id: 'materials', icon: '📚', label: 'Материалы' },
    ],
    home: 'dashboard',
  },
  admin: {
    name: 'Администратор Клиники',
    initials: 'АК',
    label: 'Мед персонал',
    nav: [
      { id: 'admin', icon: '🏥', label: 'Управление' },
      { id: 'patients', icon: '👥', label: 'Пациенты' },
      { id: 'materials', icon: '📚', label: 'Материалы' },
    ],
    home: 'admin',
  },
  pharmacy: {
    name: 'Аптекарь Данияр',
    initials: 'ДА',
    label: 'Аптека №3',
    nav: [
      { id: 'pharmacy', icon: '💊', label: 'Рецепты' },
      { id: 'materials', icon: '📚', label: 'Материалы' },
    ],
    home: 'pharmacy',
  },
  lab: {
    name: 'Лаборант Айгерим',
    initials: 'АЛ',
    label: 'Лаборатория',
    nav: [
      { id: 'lab', icon: '🔬', label: 'Анализы' },
      { id: 'materials', icon: '📚', label: 'Материалы' },
    ],
    home: 'lab',
  },
  ministry: {
    name: 'Инспектор Минздрав',
    initials: 'МЗ',
    label: 'Министерство здравоохранения',
    nav: [
      { id: 'ministry', icon: '🏛️', label: 'Статистика' },
      { id: 'materials', icon: '📚', label: 'Материалы' },
    ],
    home: 'ministry',
  },
  patient: {
    name: 'Пациент',
    initials: 'ПЦ',
    label: 'Пациент',
    nav: [
      { id: 'patient-dashboard', icon: '🏠', label: 'Главная' },
      { id: 'hospitals', icon: '🏥', label: 'Врачи' },
      { id: 'diagnostics', icon: '🤖', label: 'AI Триаж' },
      { id: 'history', icon: '📋', label: 'История' },
      { id: 'materials', icon: '📚', label: 'Материалы' },
      { id: 'patient-profile', icon: '👤', label: 'Профиль' },
    ],
    home: 'patient-dashboard',
  },
};

function navigateTo(pageId) {
  document.querySelectorAll('.content-page').forEach(p => p.style.display = 'none');
  const page = document.getElementById('page-' + pageId);
  if (page) {
    page.style.display = 'block';
    page.style.animation = 'none';
    requestAnimationFrame(() => { page.style.animation = 'fadeInUp 0.4s ease'; });
  }
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === pageId);
  });
  // Init page
  if (pageId === 'dashboard') initDashboard();
  if (pageId === 'patients') initPatients();
  if (pageId === 'pharmacy') initPharmacy();
  if (pageId === 'lab') initLab();
  if (pageId === 'ministry') initMinistry();
  if (pageId === 'admin') initAdmin();
  if (pageId === 'patient-dashboard') typeof initPatientDashboard === 'function' && initPatientDashboard();
  if (pageId === 'hospitals') typeof initHospitals === 'function' && initHospitals();
  if (pageId === 'diagnostics') typeof initDiagnostics === 'function' && initDiagnostics();
  if (pageId === 'history') typeof initHistory === 'function' && initHistory();
  if (pageId === 'patient-profile') typeof initPatientProfile === 'function' && initPatientProfile();
  if (pageId === 'materials') typeof initMaterials === 'function' && initMaterials();
}

function loginAs(role, apiUser = null) {
  AppState.role = role;
  const cfg = ROLE_CONFIG[role];

  // Merge API user data with local config
  AppState.user = apiUser ? {
    ...cfg,
    name: apiUser.name || cfg.name,
    initials: apiUser.initials || cfg.initials,
    label: apiUser.label || cfg.label,
    id: apiUser.id,
    email: apiUser.email,
  } : cfg;

  document.getElementById('page-auth').style.display = 'none';
  const shell = document.getElementById('app-shell');
  shell.style.display = 'flex';

  // Set user info from server
  document.getElementById('sidebar-user-name').textContent = AppState.user.name;
  document.getElementById('sidebar-user-role').textContent = AppState.user.label;
  document.getElementById('sidebar-avatar').textContent = AppState.user.initials;

  // Build nav
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = cfg.nav.map(item => `
    <button class="nav-item" data-page="${item.id}" onclick="navigateTo('${item.id}')">
      <span class="nav-icon">${item.icon}</span>
      ${item.label}
    </button>
  `).join('');

  navigateTo(cfg.home);
}

function handleLogout() {
  AppState.role = null;
  AppState.selectedPatient = null;
  if (typeof clearTokens === 'function') clearTokens();
  document.getElementById('app-shell').style.display = 'none';
  document.getElementById('page-auth').style.display = 'flex';
  document.querySelectorAll('.role-card').forEach(c => c.classList.remove('active'));
  document.getElementById('auth-form').reset();
  document.getElementById('login-btn').disabled = true;
  document.getElementById('selected-role-badge').style.display = 'none';
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (type === 'error' ? ' error' : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function formatTime(date) {
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date) {
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function closeModal(e) {
  if (e.target === e.currentTarget) {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
  }
}

// Gradient colors for avatars
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#2563EB,#8B5CF6)',
  'linear-gradient(135deg,#06B6D4,#2563EB)',
  'linear-gradient(135deg,#10B981,#06B6D4)',
  'linear-gradient(135deg,#F59E0B,#EF4444)',
  'linear-gradient(135deg,#8B5CF6,#EC4899)',
  'linear-gradient(135deg,#EF4444,#F59E0B)',
];
function avatarGrad(i) { return AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length]; }

// ─── Calendar Widget ───────────────────────────────────────────────────────
function renderCalendar(appointments, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Days in month
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();

  // Collect days with appointments
  const apptDays = new Set();
  (appointments || []).forEach(a => {
    if (a.date) {
      const d = new Date(a.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        apptDays.add(d.getDate());
      }
    }
  });

  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const dayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  let cells = '';
  // Add empty cells for day offset (Mon-based)
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  for (let i = 0; i < startOffset; i++) {
    cells += '<div></div>';
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = d === today;
    const hasAppt = apptDays.has(d);
    let style = 'padding:6px; border-radius:6px; font-size:12px; text-align:center; cursor:default;';
    if (isToday) style += ' background:var(--blue); color:#fff; font-weight:700;';
    else if (hasAppt) style += ' background:rgba(16,185,129,0.2); border:1px solid rgba(16,185,129,0.5); color:#10B981; font-weight:600;';
    else style += ' color:var(--text-secondary);';
    cells += `<div style="${style}">${d}${hasAppt ? '<div style="width:4px;height:4px;border-radius:50%;background:#10B981;margin:2px auto 0;"></div>' : ''}</div>`;
  }

  el.innerHTML = `
    <div style="padding:4px 0 12px; font-size:13px; font-weight:600; color:var(--text-secondary);">${monthNames[month]} ${year}</div>
    <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:4px;">
      ${dayLabels.map(l => `<div style="font-size:10px; color:var(--text-muted); text-align:center; padding-bottom:4px;">${l}</div>`).join('')}
      ${cells}
    </div>
    <div style="display:flex; align-items:center; gap:8px; margin-top:10px; font-size:11px; color:var(--text-muted);">
      <div style="width:8px;height:8px;border-radius:50%;background:var(--blue);"></div> Сегодня
      <div style="width:8px;height:8px;border-radius:50%;background:#10B981; margin-left:8px;"></div> Записи
    </div>
  `;
}
