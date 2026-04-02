// ═══════════════════════════════════════════════
// appointment.js — Real-time AI-Assisted Appointment
// Web Speech API + Doctor Notes + AI Diagnostics
// ═══════════════════════════════════════════════

let apptInterval = null;
let apptSeconds = 0;

// Speech Recognition
let recognition = null;
let speechSupported = false;
let isListening = false;
let currentSpeaker = 'doctor'; // 'doctor' or 'patient'
let fullTranscript = ''; // accumulated full transcript text

// Check Web Speech API support
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
    speechSupported = true;
}

// ─── Init ──────────────────────────────────────────────────────────────────

function initAppointment() {
    stopAppointment();
    document.getElementById('appt-start-wrap').style.display = 'flex';
    document.getElementById('appt-session').style.display = 'none';
    document.getElementById('appt-status-text').textContent = 'Ожидание';
    document.querySelector('.status-dot').className = 'status-dot';
    document.getElementById('dialog-transcript').innerHTML = '';
    document.getElementById('ai-symptoms').innerHTML = '<div class="ai-placeholder">Начните приём для анализа симптомов</div>';
    document.getElementById('ai-diagnosis').innerHTML = '<div class="ai-placeholder">Ожидаю данных для диагностики...</div>';
    document.getElementById('ai-recommendations').innerHTML = '<div class="ai-placeholder">Ожидаю данных для рекомендаций...</div>';
    document.getElementById('conclusion-text').value = '';
    document.getElementById('send-conclusion-btn').style.display = 'none';
    document.getElementById('doctor-notes').value = '';
    document.getElementById('notes-char-count').textContent = '0 символов';
    apptSeconds = 0;
    fullTranscript = '';
    currentSpeaker = 'doctor';

    // Source badge
    const sourceBadge = document.getElementById('ai-source-badge');
    if (sourceBadge) sourceBadge.style.display = 'none';

    if (AppState.selectedPatient) {
        document.getElementById('appt-patient-name').textContent = AppState.selectedPatient.name;
    }

    const anamnesisBox = document.getElementById('appt-patient-anamnesis');
    const anamnesisText = document.getElementById('appt-patient-anamnesis-text');

    // Find appointment to show anamnesis
    let currentAppt = null;
    if (window.APPOINTMENTS_DATA && AppState.currentAppointmentId) {
        currentAppt = window.APPOINTMENTS_DATA.find(a => a.id === AppState.currentAppointmentId);
    }

    if (currentAppt && currentAppt.anamnesis) {
        anamnesisText.textContent = currentAppt.anamnesis;
        anamnesisBox.style.display = 'block';
    } else {
        anamnesisText.textContent = '';
        anamnesisBox.style.display = 'none';
    }
}

// ─── Start Appointment ─────────────────────────────────────────────────────

async function startAppointment() {
    const visitType = document.getElementById('appt-visit-type').value;

    // Optional: Sync visit type to backend if we have an ID
    if (AppState.currentAppointmentId) {
        try {
            await apiFetch(`/appointments/${AppState.currentAppointmentId}/`, {
                method: 'PATCH',
                body: JSON.stringify({ visit_type: visitType })
            });
        } catch (e) {
            console.error('Failed to sync visit type:', e);
        }
    }

    document.getElementById('appt-start-wrap').style.display = 'none';
    document.getElementById('appt-session').style.display = 'block';
    document.getElementById('appt-status-text').textContent = 'Приём идёт';
    document.querySelector('.status-dot').className = 'status-dot recording';

    // Timer
    apptInterval = setInterval(() => {
        apptSeconds++;
        const m = String(Math.floor(apptSeconds / 60)).padStart(2, '0');
        const s = String(apptSeconds % 60).padStart(2, '0');
        document.getElementById('dialog-timer').textContent = `${m}:${s}`;
    }, 1000);

    // Start speech recognition
    if (speechSupported) {
        document.getElementById('speech-warning').style.display = 'none';
        document.getElementById('manual-transcript').style.display = 'none';
        document.getElementById('speech-controls').style.display = 'flex';
        startSpeechRecognition();
    } else {
        // Fallback: show warning and manual input
        document.getElementById('speech-warning').style.display = 'flex';
        document.getElementById('manual-transcript').style.display = 'block';
        document.getElementById('speech-controls').style.display = 'none';
        document.getElementById('mic-indicator').querySelector('span:last-child').textContent = 'Ручной ввод';
        document.querySelector('.mic-dot').style.background = '#F59E0B';
        document.querySelector('.mic-dot').style.animation = 'none';
    }
}

function changePatient() {
    stopAppointment();
    AppState.selectedPatient = null;
    AppState.currentAppointmentId = null;
    navigateTo('dashboard');
    showToast('Выберите пациента из списка или через поиск');
}

// ─── Speech Recognition ────────────────────────────────────────────────────

function startSpeechRecognition() {
    if (!speechSupported) return;

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'ru-RU';
    recognition.maxAlternatives = 1;

    let interimDiv = null;

    recognition.onstart = () => {
        isListening = true;
        updateMicUI(true);
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }

        // Show interim results as a ghost message
        if (interimTranscript) {
            if (!interimDiv) {
                interimDiv = document.createElement('div');
                interimDiv.className = 'dialog-message interim ' + currentSpeaker;
                interimDiv.id = 'interim-message';
                document.getElementById('dialog-transcript').appendChild(interimDiv);
            }
            const icon = currentSpeaker === 'patient' ? '🧑' : '👨‍⚕️';
            const label = currentSpeaker === 'patient' ? 'Пациент' : 'Врач';
            interimDiv.innerHTML = `
                <div class="dialog-speaker-icon">${icon}</div>
                <div>
                    <div class="dialog-speaker-name">${label}</div>
                    <div class="dialog-bubble interim-bubble">${interimTranscript}...</div>
                </div>
            `;
            const transcript_el = document.getElementById('dialog-transcript');
            transcript_el.scrollTop = transcript_el.scrollHeight;
        }

        // Add final result as a permanent message
        if (finalTranscript.trim()) {
            // Remove interim div
            if (interimDiv) {
                interimDiv.remove();
                interimDiv = null;
            }
            addDialogMessage({ role: currentSpeaker, text: finalTranscript.trim() });
            fullTranscript += `${currentSpeaker === 'doctor' ? 'Врач' : 'Пациент'}: ${finalTranscript.trim()}\n`;
        }
    };

    recognition.onerror = (event) => {
        console.log('Speech recognition error:', event.error);
        if (event.error === 'no-speech') {
            // Restart automatically
            if (isListening) {
                try { recognition.start(); } catch(e) {}
            }
        } else if (event.error === 'not-allowed') {
            showToast('❌ Доступ к микрофону запрещён. Разрешите доступ в настройках браузера.', 'error');
            document.getElementById('speech-warning').style.display = 'flex';
            document.getElementById('manual-transcript').style.display = 'block';
        }
    };

    recognition.onend = () => {
        // Auto-restart if still listening
        if (isListening) {
            try { recognition.start(); } catch(e) {}
        }
    };

    try {
        recognition.start();
    } catch(e) {
        console.error('Failed to start speech recognition:', e);
    }
}

function toggleMic() {
    if (isListening) {
        // Pause
        isListening = false;
        if (recognition) {
            try { recognition.stop(); } catch(e) {}
        }
        updateMicUI(false);
    } else {
        // Resume
        isListening = true;
        if (recognition) {
            try { recognition.start(); } catch(e) {
                startSpeechRecognition();
            }
        } else {
            startSpeechRecognition();
        }
        updateMicUI(true);
    }
}

function updateMicUI(active) {
    const btn = document.getElementById('btn-mic-toggle');
    const btnText = document.getElementById('mic-btn-text');
    const indicator = document.getElementById('mic-indicator');
    const micDot = document.querySelector('.mic-dot');

    if (active) {
        btn.classList.add('recording');
        btn.classList.remove('paused');
        btnText.textContent = 'Пауза';
        indicator.querySelector('span:last-child').textContent = 'Запись идёт';
        micDot.style.background = '#EF4444';
        micDot.style.animation = 'pulse 1.5s infinite';
    } else {
        btn.classList.remove('recording');
        btn.classList.add('paused');
        btnText.textContent = 'Продолжить';
        indicator.querySelector('span:last-child').textContent = 'Пауза';
        micDot.style.background = '#F59E0B';
        micDot.style.animation = 'none';
    }
}

// ─── Speaker Toggle ────────────────────────────────────────────────────────

function setSpeaker(speaker) {
    currentSpeaker = speaker;
    document.getElementById('speaker-btn-doctor').classList.toggle('active', speaker === 'doctor');
    document.getElementById('speaker-btn-patient').classList.toggle('active', speaker === 'patient');
}

// ─── Dialog Messages ───────────────────────────────────────────────────────

function addDialogMessage(msg) {
    const transcript = document.getElementById('dialog-transcript');
    const icon = msg.role === 'patient' ? '🧑' : '👨‍⚕️';
    const label = msg.role === 'patient' ? 'Пациент' : 'Врач';
    const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const div = document.createElement('div');
    div.className = `dialog-message ${msg.role}`;
    div.innerHTML = `
        <div class="dialog-speaker-icon">${icon}</div>
        <div>
            <div class="dialog-speaker-name">${label} <span class="dialog-time">${time}</span></div>
            <div class="dialog-bubble">${msg.text}</div>
        </div>
    `;
    transcript.appendChild(div);
    transcript.scrollTop = transcript.scrollHeight;
}

// ─── Manual Transcript Input (fallback) ────────────────────────────────────

function addManualMessage() {
    const input = document.getElementById('manual-transcript-input');
    const text = input.value.trim();
    if (!text) return;

    addDialogMessage({ role: currentSpeaker, text: text });
    fullTranscript += `${currentSpeaker === 'doctor' ? 'Врач' : 'Пациент'}: ${text}\n`;
    input.value = '';
}

// ─── Doctor Notes ──────────────────────────────────────────────────────────

function updateNotesCount() {
    const notes = document.getElementById('doctor-notes');
    const count = document.getElementById('notes-char-count');
    count.textContent = `${notes.value.length} символов`;
}

// ─── Stop Recording ────────────────────────────────────────────────────────

function stopRecordingManual() {
    // Stop speech recognition
    isListening = false;
    if (recognition) {
        try { recognition.stop(); } catch(e) {}
        recognition = null;
    }

    // Stop timer
    if (apptInterval) {
        clearInterval(apptInterval);
        apptInterval = null;
    }

    // Update UI
    document.getElementById('appt-status-text').textContent = 'Запись завершена';
    document.querySelector('.status-dot').className = 'status-dot done';
    const micIndicator = document.getElementById('mic-indicator');
    micIndicator.style.color = 'var(--green)';
    micIndicator.querySelector('span:last-child').textContent = 'Запись завершена';
    document.querySelector('.mic-dot').style.background = '#10B981';
    document.querySelector('.mic-dot').style.animation = 'none';

    // Hide speech controls
    document.getElementById('speech-controls').style.display = 'none';

    // Show conclusion fields
    document.getElementById('extended-conclusion-fields').style.display = 'block';
    document.getElementById('send-conclusion-btn').style.display = 'flex';

    showToast('✅ Запись завершена. Нажмите «ИИ-анализ» для автоматической диагностики.');
}

// ─── AI Analysis ───────────────────────────────────────────────────────────

async function runAIAnalysis() {
    const doctorNotes = document.getElementById('doctor-notes').value.trim();
    const transcript = fullTranscript.trim();

    if (!transcript && !doctorNotes) {
        showToast('⚠️ Нет данных для анализа. Запишите диалог или введите заметки.', 'error');
        return;
    }

    // Show loading state
    const btn = document.getElementById('btn-ai-analyze');
    const originalContent = btn.innerHTML;
    btn.innerHTML = `
        <div class="ai-analyze-icon spinning">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
        </div>
        <div class="ai-analyze-text">
            <span class="ai-analyze-title">⏳ Анализ...</span>
            <span class="ai-analyze-sub">Обработка данных ИИ-движком</span>
        </div>
    `;
    btn.disabled = true;

    // Show loading in AI panels
    document.getElementById('ai-symptoms').innerHTML = '<div class="ai-loading"><div class="ai-loading-spinner"></div>Анализирую симптомы...</div>';
    document.getElementById('ai-diagnosis').innerHTML = '<div class="ai-loading"><div class="ai-loading-spinner"></div>Определяю диагнозы...</div>';
    document.getElementById('ai-recommendations').innerHTML = '<div class="ai-loading"><div class="ai-loading-spinner"></div>Формирую рекомендации...</div>';

    try {
        const result = await apiFetch('/consultation/analyze/', {
            method: 'POST',
            body: JSON.stringify({
                transcript: transcript,
                doctor_notes: doctorNotes,
            })
        });

        if (!result) {
            throw new Error('Нет ответа от сервера');
        }

        // Update symptoms
        if (result.symptoms && result.symptoms.length > 0) {
            document.getElementById('ai-symptoms').innerHTML = result.symptoms
                .map(s => `<span class="symptom-tag">● ${s}</span>`).join('');
        } else {
            document.getElementById('ai-symptoms').innerHTML = '<div class="ai-placeholder">Симптомы не обнаружены. Уточните данные.</div>';
        }

        // Update diagnoses
        if (result.diagnoses && result.diagnoses.length > 0) {
            document.getElementById('ai-diagnosis').innerHTML = result.diagnoses.map(d => {
                const prob = d.probability;
                let barColor = prob >= 60 ? '#EF4444' : prob >= 30 ? '#F59E0B' : '#10B981';
                return `
                    <div class="diagnosis-item">
                        <div class="diagnosis-name">${d.diagnosis}</div>
                        <div class="diagnosis-bar-wrap">
                            <div class="diagnosis-bar" style="width:${Math.min(prob, 100)}%; background:${barColor}"></div>
                        </div>
                        <div class="diagnosis-confidence">${prob}%</div>
                    </div>
                `;
            }).join('');
        } else {
            document.getElementById('ai-diagnosis').innerHTML = '<div class="ai-placeholder">Не удалось определить диагноз</div>';
        }

        // Update recommendations
        if (result.recommendations && result.recommendations.length > 0) {
            document.getElementById('ai-recommendations').innerHTML = result.recommendations
                .map(r => `<div class="recommendation-item">→ ${r}</div>`).join('');
        } else {
            document.getElementById('ai-recommendations').innerHTML = '<div class="ai-placeholder">Нет рекомендаций</div>';
        }

        // Fill conclusion if empty
        if (result.conclusion && !document.getElementById('conclusion-text').value.trim()) {
            document.getElementById('conclusion-text').value = result.conclusion;
        }

        // Show source badge
        const sourceBadge = document.getElementById('ai-source-badge');
        if (sourceBadge) {
            sourceBadge.style.display = 'inline-flex';
            if (result.source === 'endlessmedical') {
                sourceBadge.textContent = 'EndlessMedical API';
                sourceBadge.className = 'badge badge-green';
            } else if (result.source === 'local_ai') {
                sourceBadge.textContent = 'MedAI Engine';
                sourceBadge.className = 'badge badge-blue';
            } else {
                sourceBadge.textContent = 'Базовый анализ';
                sourceBadge.className = 'badge badge-amber';
            }
        }

        // Show conclusion fields
        document.getElementById('extended-conclusion-fields').style.display = 'block';
        document.getElementById('send-conclusion-btn').style.display = 'flex';

        showToast(`✅ ИИ-анализ завершен. Обнаружено симптомов: ${result.symptoms ? result.symptoms.length : 0}`);

    } catch (err) {
        console.error('AI Analysis error:', err);
        showToast('❌ Ошибка AI-анализа: ' + (err.message || 'Неизвестная ошибка'), 'error');

        document.getElementById('ai-symptoms').innerHTML = '<div class="ai-placeholder error">Ошибка анализа</div>';
        document.getElementById('ai-diagnosis').innerHTML = '<div class="ai-placeholder error">Ошибка анализа</div>';
        document.getElementById('ai-recommendations').innerHTML = '<div class="ai-placeholder error">Ошибка анализа</div>';
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}

// ─── Stop Appointment ──────────────────────────────────────────────────────

function stopAppointment() {
    if (apptInterval) { clearInterval(apptInterval); apptInterval = null; }
    isListening = false;
    if (recognition) {
        try { recognition.stop(); } catch(e) {}
        recognition = null;
    }
}

// ─── Send Conclusion ───────────────────────────────────────────────────────

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
            // Collect AI diagnostics from the panels
            const symptomsEls = document.querySelectorAll('#ai-symptoms .symptom-tag');
            const symptoms = Array.from(symptomsEls).map(el => el.textContent.replace('● ', '').trim());
            
            const diagnosisEls = document.querySelectorAll('#ai-diagnosis .diagnosis-item');
            const diagnoses = Array.from(diagnosisEls).map(el => {
                const name = el.querySelector('.diagnosis-name');
                const conf = el.querySelector('.diagnosis-confidence');
                return {
                    name: name ? name.textContent.trim() : '',
                    confidence: conf ? conf.textContent.trim() : ''
                };
            });

            const recEls = document.querySelectorAll('#ai-recommendations .recommendation-item');
            const recommendations = Array.from(recEls).map(el => el.textContent.replace('→ ', '').trim());

            const aiData = JSON.stringify({ symptoms, diagnoses, recommendations, transcript: fullTranscript });

            // 1. Complete appointment
            await apiFetch(`/appointments/${AppState.currentAppointmentId}/`, {
                method: 'PATCH',
                body: JSON.stringify({
                    status: 'done',
                    conclusion: text,
                    post_treatment_status: postTreatment,
                    ai_diagnostics: aiData
                })
            });

            // 2. Create follow-up if date specified
            if (followUpDate) {
                await apiFetch(`/appointments/`, {
                    method: 'POST',
                    body: JSON.stringify({
                        patient: AppState.selectedPatient.id,
                        date: followUpDate,
                        time: "09:00",
                        diagnosis: "Повторный приём",
                        status: "waiting"
                    })
                });
                showToast(`📅 Назначен повторный приём на ${followUpDate}`);
            }

            // 3. Auto-create prescription if patient exists
            if (AppState.selectedPatient) {
                // Extract medication recommendations from AI
                const meds = [];
                recommendations.forEach(rec => {
                    if (rec.match(/парацетамол|ибупрофен|амброксол|противокашлев|муколити|жаропонижающ|сорбент|антигистамин/i)) {
                        meds.push({ name: rec.split('(')[0].trim(), dose: 'По назначению' });
                    }
                });
                if (meds.length === 0) {
                    meds.push({ name: 'По назначению врача', dose: 'Согласно заключению' });
                }

                const validUntil = new Date();
                validUntil.setDate(validUntil.getDate() + 30);
                
                await apiFetch(`/prescriptions/`, {
                    method: 'POST',
                    body: JSON.stringify({
                        patient: AppState.selectedPatient.id,
                        valid_until: validUntil.toISOString().split('T')[0],
                        meds: meds
                    })
                });
            }
        }

        showToast('✅ Приём успешно завершен. Рецепт передан в аптеку.');
        document.getElementById('appt-status-text').textContent = 'Завершён';
        btn.style.display = 'none';

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
