// ═══════════════════════════════════════════════
// auth.js — Login & Registration (with real API)
// ═══════════════════════════════════════════════

let selectedRole = null;

const ROLE_LABELS = {
    doctor: '🩺 Врач',
    admin: '🏥 Мед персонал',
    pharmacy: '💊 Аптекарь',
    lab: '🔬 Лаборатория',
    ministry: '🏛️ Минздрав',
    patient: '👤 Пациент',
};

const ROLE_EMAILS = {
    doctor: 'doctor@medai.kz',
    admin: 'admin@medai.kz',
    pharmacy: 'pharmacy@medai.kz',
    lab: 'lab@medai.kz',
    ministry: 'ministry@medai.kz',
    patient: 'patient@medai.kz', // Or could be IIN for patient
};

let tempUserId = null; // Store user ID during verification

// ─── Tab switching ─────────────────────────────────────────────────────────

function switchAuthTab(tab) {
    const isLogin = tab === 'login';
    document.getElementById('panel-login').style.display = isLogin ? '' : 'none';
    document.getElementById('panel-register').style.display = isLogin ? 'none' : '';
    document.getElementById('tab-login').classList.toggle('active', isLogin);
    document.getElementById('tab-register').classList.toggle('active', !isLogin);
}

// ─── Login ─────────────────────────────────────────────────────────────────

function selectRole(role) {
    selectedRole = role;
    document.querySelectorAll('.role-card').forEach(c => c.classList.remove('active'));
    document.querySelector(`[data-role="${role}"]`).classList.add('active');
    const badge = document.getElementById('selected-role-badge');
    badge.style.display = 'flex';
    badge.textContent = 'Выбрана роль: ' + ROLE_LABELS[role];
    document.getElementById('login-btn').disabled = false;
    // Auto-fill for convenience
    const emailInput = document.getElementById('auth-email');
    const passInput = document.getElementById('auth-password');
    if (!emailInput.value || Object.values(ROLE_EMAILS).includes(emailInput.value)) {
        emailInput.value = ROLE_EMAILS[role];
        passInput.value = 'medai2026';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    if (!selectedRole) { showToast('Выберите роль', 'error'); return; }
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const btn = document.getElementById('login-btn');
    btn.innerHTML = '<span>Вход...</span>';
    btn.disabled = true;
    try {
        const data = await apiLogin(email, password);
        saveTokens(data.access, data.refresh);
        saveUser(data.user);
        loginAs(data.user.role, data.user);
    } catch (err) {
        showToast(err.message || 'Ошибка входа', 'error');
        btn.innerHTML = '<span>Войти в систему</span>';
        btn.disabled = false;
    }
}

// ─── Register ──────────────────────────────────────────────────────────────

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const role = document.getElementById('reg-role').value;
    const btn = document.getElementById('register-btn');

    const iin = document.getElementById('reg-iin') ? document.getElementById('reg-iin').value.trim() : '';
    const phone = document.getElementById('reg-phone') ? document.getElementById('reg-phone').value.trim() : '';

    if (!name) { showToast('Введите ваше имя', 'error'); return; }
    if (!email) { showToast('Введите email для получения кода подтверждения', 'error'); return; }
    if (role === 'patient' && !iin) { showToast('Введите ИИН', 'error'); return; }
    if (password.length < 6) { showToast('Пароль минимум 6 символов', 'error'); return; }

    btn.innerHTML = '<span>Регистрация...</span>';
    btn.disabled = true;

    const payload = { name, email, password, role };
    if (role === 'patient') {
        payload.iin = iin;
        payload.phone = phone;
    }

    btn.innerHTML = '<span>⏳ Подключение к серверу...</span>';

    // Fetch with 45s timeout (Render free tier needs ~30s to wake up)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    // Countdown message
    let seconds = 0;
    const countInterval = setInterval(() => {
        seconds++;
        if (seconds > 5) {
            btn.innerHTML = `<span>⏳ Сервер просыпается... ${seconds}с</span>`;
        }
    }, 1000);

    try {
        const res = await fetch(`${API_BASE}/auth/register/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        clearInterval(countInterval);

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ошибка регистрации');

        // If backend returns tokens directly — login immediately (no email verification)
        if (data.access && data.user) {
            saveTokens(data.access, data.refresh);
            saveUser(data.user);
            showToast(`✅ Добро пожаловать, ${data.user.name}!`);
            loginAs(data.user.role, data.user);
            return;
        }

        // Legacy: Show verification modal if no tokens in response
        tempUserId = data.user_id;
        const modal = document.getElementById('verify-email-modal');
        modal.style.display = 'flex';
        document.body.appendChild(modal);
        showToast(`✅ Код отправлен на ${email}`);

        btn.innerHTML = '<span>Зарегистрироваться</span>';
        btn.disabled = false;
    } catch (err) {
        clearTimeout(timeoutId);
        clearInterval(countInterval);
        showToast(err.message || 'Ошибка регистрации', 'error');
        btn.innerHTML = '<span>Зарегистрироваться</span>';
        btn.disabled = false;
    }
}

async function handleVerifyEmail() {
    const code = document.getElementById('verify-code').value.trim();
    if (!code || code.length !== 6) {
        showToast('Введите 6-значный код', 'error');
        return;
    }

    const btn = document.getElementById('verify-btn');
    btn.innerHTML = 'Проверка...';
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/auth/verify-email/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: tempUserId, code: code }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ошибка проверки кода');

        document.getElementById('verify-email-modal').style.display = 'none';
        saveTokens(data.access, data.refresh);
        saveUser(data.user);
        showToast(`✅ ${data.message}! Добро пожаловать, ${data.user.name}!`);
        loginAs(data.user.role, data.user);

        // Reset verify input
        document.getElementById('verify-code').value = '';
    } catch (err) {
        showToast(err.message || 'Ошибка проверки кода', 'error');
    } finally {
        btn.innerHTML = 'Подтвердить';
        btn.disabled = false;
    }
}

// ─── Setup Listeners ───────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    const regRoleSelect = document.getElementById('reg-role');
    if (regRoleSelect) {
        regRoleSelect.addEventListener('change', (e) => {
            const isPatient = e.target.value === 'patient';
            const patientFields = document.getElementById('reg-patient-fields');
            if (patientFields) patientFields.style.display = isPatient ? 'block' : 'none';
            // Adjust IIN requirement
            const iinInput = document.getElementById('reg-iin');
            if (iinInput) iinInput.required = isPatient;
        });
    }
});
