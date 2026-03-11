// ═══════════════════════════════════════════════
// appointment.js — AI-Assisted Appointment
// ═══════════════════════════════════════════════

let apptInterval = null;
let apptSeconds = 0;
let dialogStep = 0;

const DIALOG_SCRIPT = [
    { role: 'patient', text: 'Здравствуйте, доктор. У меня уже две недели сильный кашель, температура поднималась до 38.5, и очень болит горло.' },
    { role: 'doctor', text: 'Здравствуйте. Присаживайтесь. Кашель сухой или с мокротой? Есть ли насморк, слабость?' },
    { role: 'patient', text: 'Кашель сначала был сухой, теперь с мокротой жёлтого цвета. Насморк есть, слабость сильная, аппетита нет совсем.' },
    { role: 'doctor', text: 'Понятно. Были ли контакты с больными? Принимали ли какие-то лекарства самостоятельно?' },
    { role: 'patient', text: 'Да, коллега на работе болел. Пил парацетамол и пил много воды. Ещё ночью потею сильно.' },
    { role: 'doctor', text: 'Хорошо. Сейчас я вас осмотрю. Дышите глубоко. Есть хрипы в нижних отделах лёгких. Нужно сделать рентген грудной клетки и анализ крови.' },
    { role: 'patient', text: 'Доктор, это серьёзно? Мне нужно на работу, могу ли я работать?' },
    { role: 'doctor', text: 'Пока рекомендую постельный режим. По результатам анализов определим точный диагноз и лечение. Выпишу направления.' },
];

const AI_SYMPTOMS = ['Кашель с мокротой', 'Гипертермия 38.5°C', 'Фарингит', 'Ринит', 'Астения', 'Ночная потливость', 'Анорексия'];
const AI_DIAGNOSES = [
    { name: 'Острый бронхит', confidence: '78%' },
    { name: 'Внебольничная пневмония', confidence: '15%' },
    { name: 'ОРВИ с осложнениями', confidence: '7%' },
];
const AI_RECOMMENDATIONS = ['Рентген грудной клетки', 'ОАК + СРБ', 'Постельный режим 7-10 дней', 'Обильное питьё', 'Жаропонижающие при t>38.5'];
const CONCLUSION_TEXT = `Пациент предъявляет жалобы на кашель с гнойной мокротой в течение 2 недель, повышение температуры до 38.5°C, боли в горле, насморк, выраженную слабость, ночную потливость, снижение аппетита.

Эпидемиологический анамнез: контакт с больным ОРВИ на рабочем месте.

При аускультации: хрипы в нижних отделах лёгких с обеих сторон.

Предварительный диагноз: Острый бронхит (J20). Исключить пневмонию.

Назначения: Рентгенография ОГК, ОАК, СРБ. Постельный режим. Обильное питьё. Парацетамол 500мг при t>38.5°C.`;

function initAppointment() {
    // Reset state
    stopAppointment();
    document.getElementById('appt-start-wrap').style.display = 'flex';
    document.getElementById('appt-session').style.display = 'none';
    document.getElementById('appt-status-text').textContent = 'Ожидание';
    document.querySelector('.status-dot').className = 'status-dot';
    document.getElementById('dialog-transcript').innerHTML = '';
    document.getElementById('ai-symptoms').innerHTML = '<div class="ai-loading">Анализирую...</div>';
    document.getElementById('ai-diagnosis').innerHTML = '<div class="ai-loading">Ожидаю данных...</div>';
    document.getElementById('ai-recommendations').innerHTML = '<div class="ai-loading">Ожидаю данных...</div>';
    document.getElementById('conclusion-text').value = '';
    document.getElementById('send-conclusion-btn').style.display = 'none';
    dialogStep = 0;
    apptSeconds = 0;

    if (AppState.selectedPatient) {
        document.getElementById('appt-patient-name').textContent = AppState.selectedPatient.name;
    }
}

function startAppointment() {
    document.getElementById('appt-start-wrap').style.display = 'none';
    document.getElementById('appt-session').style.display = 'block';
    document.getElementById('appt-status-text').textContent = 'Запись идёт';
    document.querySelector('.status-dot').className = 'status-dot recording';

    // Timer
    apptInterval = setInterval(() => {
        apptSeconds++;
        const m = String(Math.floor(apptSeconds / 60)).padStart(2, '0');
        const s = String(apptSeconds % 60).padStart(2, '0');
        document.getElementById('dialog-timer').textContent = `${m}:${s}`;

        // Add dialog messages progressively
        if (dialogStep < DIALOG_SCRIPT.length && apptSeconds % 4 === 0) {
            addDialogMessage(DIALOG_SCRIPT[dialogStep]);
            dialogStep++;
            updateAI();
        }

        // Show conclusion after all dialog
        if (dialogStep >= DIALOG_SCRIPT.length && apptSeconds > DIALOG_SCRIPT.length * 4 + 2) {
            stopRecording();
        }
    }, 1000);
}

function addDialogMessage(msg) {
    const transcript = document.getElementById('dialog-transcript');
    const icon = msg.role === 'patient' ? '🧑' : '👨‍⚕️';
    const label = msg.role === 'patient' ? 'Пациент' : 'Врач';
    const div = document.createElement('div');
    div.className = `dialog-message ${msg.role}`;
    div.innerHTML = `
    <div class="dialog-speaker-icon">${icon}</div>
    <div>
      <div class="dialog-speaker-name">${label}</div>
      <div class="dialog-bubble">${msg.text}</div>
    </div>
  `;
    transcript.appendChild(div);
    transcript.scrollTop = transcript.scrollHeight;
}

function updateAI() {
    const progress = dialogStep / DIALOG_SCRIPT.length;

    if (progress >= 0.25) {
        const symptomsToShow = AI_SYMPTOMS.slice(0, Math.ceil(progress * AI_SYMPTOMS.length));
        document.getElementById('ai-symptoms').innerHTML = symptomsToShow
            .map(s => `<span class="symptom-tag">● ${s}</span>`).join('');
    }

    if (progress >= 0.5) {
        const diagToShow = AI_DIAGNOSES.slice(0, Math.ceil(progress * AI_DIAGNOSES.length));
        document.getElementById('ai-diagnosis').innerHTML = diagToShow.map(d => `
      <div class="diagnosis-item">
        ${d.name}
        <div class="diagnosis-confidence">Вероятность: ${d.confidence}</div>
      </div>
    `).join('');
    }

    if (progress >= 0.75) {
        const recToShow = AI_RECOMMENDATIONS.slice(0, Math.ceil(progress * AI_RECOMMENDATIONS.length));
        document.getElementById('ai-recommendations').innerHTML = recToShow
            .map(r => `<div style="padding:6px 0;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.05)">→ ${r}</div>`).join('');
    }
}

function stopRecording() {
    clearInterval(apptInterval);
    apptInterval = null;
    document.getElementById('appt-status-text').textContent = 'Анализ завершён';
    document.querySelector('.status-dot').className = 'status-dot done';
    document.getElementById('mic-indicator').style.color = 'var(--green)';
    document.querySelector('.mic-dot').style.background = 'var(--green)';
    document.querySelector('.mic-dot').style.animation = 'none';
    document.getElementById('mic-indicator').querySelector('span:last-child').textContent = 'Запись завершена';

    // Fill conclusion
    document.getElementById('conclusion-text').value = CONCLUSION_TEXT;
    document.getElementById('send-conclusion-btn').style.display = 'flex';
    document.getElementById('extended-conclusion-fields').style.display = 'block';

    // Fill all AI panels
    document.getElementById('ai-symptoms').innerHTML = AI_SYMPTOMS.map(s => `<span class="symptom-tag">● ${s}</span>`).join('');
    document.getElementById('ai-diagnosis').innerHTML = AI_DIAGNOSES.map(d => `
    <div class="diagnosis-item">${d.name}<div class="diagnosis-confidence">Вероятность: ${d.confidence}</div></div>
  `).join('');
    document.getElementById('ai-recommendations').innerHTML = AI_RECOMMENDATIONS.map(r =>
        `<div style="padding:6px 0;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.05)">→ ${r}</div>`).join('');
}

function stopAppointment() {
    if (apptInterval) { clearInterval(apptInterval); apptInterval = null; }
}

async function sendConclusion() {
    const text = document.getElementById('conclusion-text').value.trim();
    if (!text) { showToast('Введите заключение', 'error'); return; }

    const postTreatment = document.getElementById('post-treatment-status').value.trim();
    const followUpDate = document.getElementById('follow-up-date').value;

    const btn = document.getElementById('send-conclusion-btn');
    btn.innerHTML = '<span>Отправка...</span>';
    btn.disabled = true;

    try {
        if (AppState.currentAppointmentId) {
            // Bundle AI diagnostics into JSON string
            const aiData = JSON.stringify({
                symptoms: AI_SYMPTOMS,
                diagnoses: AI_DIAGNOSES,
                recommendations: AI_RECOMMENDATIONS
            });

            // 1. Завершить приём
            await apiFetch(`/appointments/${AppState.currentAppointmentId}/`, {
                method: 'PATCH',
                body: JSON.stringify({
                    status: 'done',
                    conclusion: text,
                    post_treatment_status: postTreatment,
                    ai_diagnostics: aiData
                })
            });

            // 2. Создать повторный приём, если указана дата
            if (followUpDate) {
                await apiFetch(`/appointments/`, {
                    method: 'POST',
                    body: JSON.stringify({
                        patient: AppState.selectedPatient.id,
                        date: followUpDate,
                        time: "09:00", // Default time
                        diagnosis: "Повторный приём",
                        status: "waiting"
                    })
                });
                showToast(`📅 Назначен повторный приём на ${followUpDate}`);
            }

            // 3. Создать рецепт автоматически
            if (AppState.selectedPatient) {
                await apiFetch(`/prescriptions/`, {
                    method: 'POST',
                    body: JSON.stringify({
                        patient: AppState.selectedPatient.id,
                        valid_until: '2026-03-20',
                        meds: [
                            { name: 'Парацетамол', dose: '500мг при t>38.5' },
                            { name: 'Амброксол', dose: '30мг 3 раза в день' }
                        ]
                    })
                });
            }
        }

        showToast('✅ Приём успешно завершен. Рецепт передан в аптеку.');
        document.getElementById('appt-status-text').textContent = 'Завершён';
        btn.style.display = 'none';

        // Очистить ID текущего приема
        AppState.currentAppointmentId = null;
        document.getElementById('extended-conclusion-fields').style.display = 'none';
        document.getElementById('post-treatment-status').value = '';
        document.getElementById('follow-up-date').value = '';

        setTimeout(() => navigateTo('dashboard'), 2000);
    } catch (err) {
        showToast(err.message, 'error');
        btn.innerHTML = '<span>Отправить заключение</span>';
        btn.disabled = false;
    }
}
