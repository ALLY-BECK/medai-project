// ═══════════════════════════════════════════════
// api.js — Central API utility for MedAI
// Handles JWT tokens, fetch requests to backend
// ═══════════════════════════════════════════════

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:8000/api'
    : 'https://medai-project.onrender.com/api';

// ─── Token Management ──────────────────────────────────────────────────────

function saveTokens(access, refresh) {
    localStorage.setItem('medai_access', access);
    localStorage.setItem('medai_refresh', refresh);
}

function getAccessToken() {
    return localStorage.getItem('medai_access');
}

function clearTokens() {
    localStorage.removeItem('medai_access');
    localStorage.removeItem('medai_refresh');
    localStorage.removeItem('medai_user');
}

function saveUser(user) {
    localStorage.setItem('medai_user', JSON.stringify(user));
}

function getSavedUser() {
    try {
        return JSON.parse(localStorage.getItem('medai_user'));
    } catch { return null; }
}

// ─── Core Fetch ────────────────────────────────────────────────────────────

async function apiFetch(endpoint, options = {}) {
    const token = getAccessToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
    };

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers,
        });

        if (response.status === 401) {
            // Token expired — try to refresh
            const refreshed = await refreshAccessToken();
            if (refreshed) {
                // Retry original request with new token
                return apiFetch(endpoint, options);
            } else {
                clearTokens();
                handleLogout();
                return null;
            }
        }

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || err.detail || `HTTP ${response.status}`);
        }

        if (response.status === 204) return null;
        return await response.json();

    } catch (e) {
        if (e.message && e.message.includes('Failed to fetch')) {
            showToast('❌ Нет соединения с сервером. Убедитесь что бэкенд запущен.', 'error');
            return null;
        }
        throw e;
    }
}

async function refreshAccessToken() {
    const refresh = localStorage.getItem('medai_refresh');
    if (!refresh) return false;
    try {
        const res = await fetch(`${API_BASE}/auth/refresh/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        localStorage.setItem('medai_access', data.access);
        return true;
    } catch {
        return false;
    }
}

// ─── Auth API ──────────────────────────────────────────────────────────────

async function apiLogin(email, password, options = {}) {
    const res = await fetch(`${API_BASE}/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        ...options,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Неверный email или пароль');
    }
    return await res.json();
}

// ─── Restore session on page load ─────────────────────────────────────────

async function restoreSession() {
    const user = getSavedUser();
    const token = getAccessToken();
    if (user && token) {
        loginAs(user.role, user);
    }
}

window.addEventListener('DOMContentLoaded', restoreSession);
